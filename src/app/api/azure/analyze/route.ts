/**
 * Azure Document Intelligence OCR — サーバーサイドプロキシ v2
 *
 * 処理パイプライン (すべてサーバー側で完結):
 *   1. sharp でガイド枠クロップ + コントラスト/シャープネス最適化
 *   2. Azure Document Intelligence 呼び出し
 *      - mode:'front' → prebuilt-businessCard → 構造化 OcrResult
 *      - mode:'back'  → prebuilt-read          → 全文抽出 → notes (検索用テキスト)
 *   3. locale: ja-JP 固定
 *
 * POST /api/azure/analyze
 * Body: {
 *   imageBase64: string          // フルフレーム base64 (max ~2560px wide)
 *   cropRegion?: { x,y,w,h }    // ガイド枠 — キャプチャ座標系でのピクセル値
 *   mode?: 'front' | 'back'     // default: 'front'
 *   endpoint?: string
 *   apiKey?: string
 * }
 * Response: { ok: boolean; result?: OcrResult; notes?: string; error?: string }
 */

import sharp from 'sharp';

// ─── Request / Response Types ─────────────────────────────────────────────────

interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RequestBody {
  imageBase64?: string;
  cropRegion?: CropRegion;
  mode?: 'front' | 'back';
  endpoint?: string;
  apiKey?: string;
}

/** フロント面の構造化結果 (scan/page.tsx の OcrResult と同一) */
export interface OcrResult {
  name?:    string;
  company?: string;
  title?:   string;
  email?:   string;
  tel?:     string;
  address?: string;
  raw?:     string;
}

interface AnalyzeResponse {
  ok: boolean;
  result?: OcrResult;  // mode:'front' 時
  notes?: string;      // mode:'back'  時 — DB の notes カラムへ格納
  error?: string;
}

// ─── Azure Field Types (prebuilt-businessCard) ────────────────────────────────

interface BcField {
  content?: string;
  valueString?: string;
}
interface BcFieldArray {
  valueArray?: Array<{
    content?: string;
    valueString?: string;
    valueObject?: Record<string, BcField>;
  }>;
}
interface BcFields {
  ContactNames?:  BcFieldArray;
  CompanyNames?:  BcFieldArray;
  JobTitles?:     BcFieldArray;
  Emails?:        BcFieldArray;
  MobilePhones?:  BcFieldArray;
  WorkPhones?:    BcFieldArray;
  OtherPhones?:   BcFieldArray;
  Addresses?:     BcFieldArray;
  Websites?:      BcFieldArray;
}

// prebuilt-read のポーリング結果型
interface ReadAnalyzeResult {
  content?: string;
  pages?: Array<{ lines?: Array<{ content?: string }> }>;
}

// ─── Image Preprocessing (server-side) ───────────────────────────────────────

/**
 * base64 画像 → ガイド枠クロップ → コントラスト最適化 → ArrayBuffer
 * Azure が最高精度で認識できる状態に整える
 * 戻り値を ArrayBuffer にすることで fetch の body として渡せる
 */
async function preprocessImage(base64: string, crop?: CropRegion): Promise<ArrayBuffer> {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const inputBuf = Buffer.from(raw, 'base64');

  let pipeline = sharp(inputBuf);

  // ガイド枠クロップ (座標が有効な場合のみ)
  if (crop && crop.w > 20 && crop.h > 20) {
    pipeline = pipeline.extract({
      left:   Math.max(0, Math.round(crop.x)),
      top:    Math.max(0, Math.round(crop.y)),
      width:  Math.max(1, Math.round(crop.w)),
      height: Math.max(1, Math.round(crop.h)),
    });
  }

  // コントラスト・シャープネス最適化 + EXIF 向き補正
  const outputBuf = await pipeline
    .withMetadata()                  // EXIF メタデータ保持 (向き情報含む)
    .rotate()                        // EXIF 向き情報に基づいて自動回転
    .normalize()                     // ヒストグラム正規化 → コントラスト自動補正
    .sharpen({ sigma: 0.9 })         // エッジシャープネス (文字の輪郭強調)
    .modulate({ brightness: 1.04 })  // 微細な輝度補正
    .toFormat('jpeg', { quality: 96 })
    .toBuffer();

  // Buffer → ArrayBuffer (fetch の BodyInit として渡すため)
  return outputBuf.buffer.slice(
    outputBuf.byteOffset,
    outputBuf.byteOffset + outputBuf.byteLength,
  ) as ArrayBuffer;
}

// ─── Field Mappers ────────────────────────────────────────────────────────────

/** BcFieldArray の先頭 content を取り出す */
function firstContent(f?: BcFieldArray): string | undefined {
  return f?.valueArray?.[0]?.content?.trim() || undefined;
}

/** prebuilt-businessCard の fields → OcrResult */
function mapBusinessCardFields(fields: BcFields): OcrResult {
  // 氏名: LastName + FirstName を結合
  let name: string | undefined;
  const nameArr = fields.ContactNames?.valueArray ?? [];
  if (nameArr.length > 0) {
    const obj   = nameArr[0].valueObject ?? {};
    const last  = obj.LastName?.content?.trim()  ?? '';
    const first = obj.FirstName?.content?.trim() ?? '';
    name = [last, first].filter(Boolean).join(' ') || nameArr[0].content?.trim();
  }

  // 電話: モバイル優先
  const tel = firstContent(fields.MobilePhones)
           ?? firstContent(fields.WorkPhones)
           ?? firstContent(fields.OtherPhones);

  // raw: 全フィールドを改行結合
  const rawParts: string[] = [];
  if (name)                              rawParts.push(name);
  if (firstContent(fields.CompanyNames)) rawParts.push(firstContent(fields.CompanyNames)!);
  if (firstContent(fields.JobTitles))    rawParts.push(firstContent(fields.JobTitles)!);
  if (firstContent(fields.Emails))       rawParts.push(firstContent(fields.Emails)!);
  if (tel)                               rawParts.push(tel);
  if (firstContent(fields.Addresses))    rawParts.push(firstContent(fields.Addresses)!);

  return {
    name,
    company: firstContent(fields.CompanyNames),
    title:   firstContent(fields.JobTitles),
    email:   firstContent(fields.Emails),
    tel,
    address: firstContent(fields.Addresses),
    raw:     rawParts.join('\n'),
  };
}

// ─── Azure Polling ────────────────────────────────────────────────────────────

/** ポーリング — 表面 (prebuilt-businessCard → OcrResult) */
async function pollFront(operationUrl: string, apiKey: string): Promise<OcrResult> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    if (!res.ok) throw new Error(`ポーリング失敗: HTTP ${res.status}`);

    const data = await res.json() as {
      status: string;
      analyzeResult?: { documents?: Array<{ fields?: BcFields }> };
    };

    if (data.status === 'failed') throw new Error('Azure の解析に失敗しました');
    if (data.status === 'succeeded') {
      const fields = data.analyzeResult?.documents?.[0]?.fields;
      if (!fields) throw new Error('名刺フィールドの取得に失敗しました');
      return mapBusinessCardFields(fields);
    }
    // running / notStarted → 次のループへ
  }
  throw new Error('タイムアウト: Azure が 30 秒以内に結果を返しませんでした');
}

/** ポーリング — 裏面 (prebuilt-read → 検索用テキスト) */
async function pollBack(operationUrl: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    if (!res.ok) throw new Error(`ポーリング失敗: HTTP ${res.status}`);

    const data = await res.json() as {
      status: string;
      analyzeResult?: ReadAnalyzeResult;
    };

    if (data.status === 'failed') throw new Error('裏面の解析に失敗しました');
    if (data.status === 'succeeded') {
      const ar = data.analyzeResult;
      // content フィールド優先 (新 Document Intelligence 形式)
      if (ar?.content?.trim()) return ar.content.trim();
      // pages[].lines[] フォールバック (旧 Form Recognizer 形式)
      const lines: string[] = [];
      for (const page of ar?.pages ?? []) {
        for (const line of page.lines ?? []) {
          if (line.content?.trim()) lines.push(line.content.trim());
        }
      }
      return lines.join('\n');
    }
  }
  throw new Error('タイムアウト: Azure が 30 秒以内に結果を返しませんでした');
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as RequestBody;
    const {
      imageBase64,
      cropRegion,
      mode = 'front',
      endpoint: bodyEndpoint,
      apiKey: bodyApiKey,
    } = body;

    if (!imageBase64) {
      return Response.json(
        { ok: false, error: '画像データがありません' } as AnalyzeResponse,
        { status: 400 },
      );
    }

    // Zero-Knowledge: サーバー環境変数は使用しない
    // キーは端末の localStorage から毎回リクエストで渡される
    const endpoint = (bodyEndpoint ?? '').trim().replace(/\/$/, '');
    const apiKey   = (bodyApiKey  ?? '').trim();

    if (!endpoint || !apiKey) {
      return Response.json(
        {
          ok: false,
          error: 'Azure の設定が見つかりません。\n\n設定画面でエンドポイントと API Key を入力して保存してください。',
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    // ── Step 1: 画像前処理 (クロップ + コントラスト最適化) ──────────────────
    const imageBuffer = await preprocessImage(imageBase64, cropRegion);

    // ── Step 2: Azure モデル選択 ──────────────────────────────────────────────
    // front → prebuilt-businessCard (構造化フィールド抽出)
    // back  → prebuilt-read         (全文テキスト抽出)
    const model  = mode === 'back' ? 'prebuilt-read' : 'prebuilt-businessCard';
    const locale = 'ja-JP';

    // 旧 formrecognizer パス → 新 documentintelligence パスの順に試行
    const analyzePaths = [
      `${endpoint}/formrecognizer/documentModels/${model}:analyze?api-version=2023-07-31&locale=${locale}`,
      `${endpoint}/documentintelligence/document-models/${model}:analyze?api-version=2023-10-31-preview&locale=${locale}`,
    ];

    let submitRes: Response | null = null;
    let lastStatus = 0;

    for (const analyzeUrl of analyzePaths) {
      const res = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'image/jpeg',
        },
        body: imageBuffer,
      });

      lastStatus = res.status;

      if (res.status === 401 || res.status === 403) {
        return Response.json(
          {
            ok: false,
            error: 'API Key が無効です。\n\n設定画面で Azure の API Key を確認してください。',
          } as AnalyzeResponse,
          { status: 200 },
        );
      }

      if (res.status !== 404) {
        submitRes = res;
        break;
      }
    }

    if (!submitRes || !submitRes.ok) {
      return Response.json(
        {
          ok: false,
          error:
            lastStatus === 404
              ? 'Azure のエンドポイントが見つかりません。\n\n設定画面でエンドポイント URL を確認してください。'
              : `Azure へのリクエストに失敗しました（HTTP ${lastStatus}）`,
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    const operationUrl = submitRes.headers.get('Operation-Location');
    if (!operationUrl) {
      return Response.json(
        { ok: false, error: 'Azure からの応答に Operation-Location がありません' } as AnalyzeResponse,
        { status: 200 },
      );
    }

    // ── Step 3: ポーリング & 結果返却 ─────────────────────────────────────────
    if (mode === 'back') {
      const notes = await pollBack(operationUrl, apiKey);
      return Response.json({ ok: true, notes } as AnalyzeResponse, { status: 200 });
    }

    const result = await pollFront(operationUrl, apiKey);
    return Response.json({ ok: true, result } as AnalyzeResponse, { status: 200 });

  } catch (err) {
    const error = err as Error;
    return Response.json(
      {
        ok: false,
        error: '名刺の読み取り中にエラーが発生しました。\n\n光の反射を抑えて、もう少し近づいて撮影してみてください。',
      } as AnalyzeResponse,
      { status: 200 },
    );
  }
}
