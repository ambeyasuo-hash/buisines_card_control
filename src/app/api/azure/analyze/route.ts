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

// ─── Error Classifier ─────────────────────────────────────────────────────────

/**
 * fetch が throw した Error を「ユーザーへの日本語アドバイス付きカテゴリ」に分類する
 *
 * ユーザーが「次にとるべき行動」を明示するのが目的。
 * 技術的な error.name / message はコンソールにのみ残す。
 */
function classifyFetchError(err: unknown): string {
  const name    = err instanceof Error ? err.name    : '';
  const message = err instanceof Error ? err.message.toLowerCase() : '';

  // TypeError: Load failed (Safari/iOS) / TypeError: fetch failed (Node) / Failed to fetch (Chrome)
  // → URL 形式の誤りやネットワーク到達不能が原因
  if (
    name === 'TypeError' ||
    message.includes('load failed') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error')
  ) {
    return (
      'Azure エンドポイントへの接続に失敗しました。\n\n' +
      '以下を確認してください:\n' +
      '① 設定画面のエンドポイント URL が正しい形式か\n' +
      '   例: https://your-name.cognitiveservices.azure.com\n' +
      '② インターネット接続が正常か\n' +
      '③ Azure リソースが削除・停止されていないか'
    );
  }

  if (name === 'AbortError' || message.includes('abort') || message.includes('timeout')) {
    return (
      'Azure への接続がタイムアウトしました。\n\n' +
      'しばらく待ってから再試行してください。\n' +
      '繰り返す場合はインターネット接続を確認してください。'
    );
  }

  return '予期しないネットワークエラーが発生しました。しばらく後に再試行してください。';
}

/**
 * Azure polling 中の analysis failure をユーザー向けメッセージにマッピング
 *
 * "光の反射" や "撮影のコツ" を示す Elegant Resilience ガイダンス。
 */
function classifyAnalysisFailure(mode: 'front' | 'back'): string {
  if (mode === 'back') {
    return (
      '裏面のテキストを読み取れませんでした。\n\n' +
      '① 文字が正面に向くように角度を調整してください\n' +
      '② 光の反射を避けて撮影してください\n' +
      '③ 手ブレのないよう端末を固定してください'
    );
  }
  return (
    '名刺として認識できませんでした。\n\n' +
    '撮影のコツ:\n' +
    '① 光の反射を抑え、明るい場所で撮影してください\n' +
    '② 名刺全体がガイド枠に収まるようにしてください\n' +
    '③ 文字がはっきり見える距離・角度で撮影してください'
  );
}

// ─── Retry & Timeout Helpers ──────────────────────────────────────────────────

/** submit fetch のリトライ設定 */
const SUBMIT_RETRY_MAX    = 3;   // 最大試行回数（初回 + 最大2回リトライ）
const SUBMIT_TIMEOUT_MS   = 20_000; // 1回の submit fetch タイムアウト (20s)
const SUBMIT_RETRY_DELAYS = [1000, 2000, 4000] as const; // 指数バックオフ

/** HTTP ステータスが自動リトライ対象か (429 / 5xx) */
function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/** Retry-After ヘッダー (秒) → ms。存在しない or 過大な場合は undefined */
function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get('Retry-After');
  if (!h) return undefined;
  const secs = parseInt(h, 10);
  // 最大 8s に制限（ポーリング全体のタイムアウトを圧迫しないよう）
  return isNaN(secs) ? undefined : Math.min(secs * 1000, 8_000);
}

/**
 * 指数バックオフ付き fetch (submit フェーズ専用)
 *
 * - 429 / 5xx のみリトライ (最大 SUBMIT_RETRY_MAX 回)
 * - AbortController で 1 回あたり SUBMIT_TIMEOUT_MS 以内に制限
 * - TypeError (Load failed / ネットワーク到達不能) → 即座に再 throw（リトライ無効）
 * - AbortError (タイムアウト)                      → 'FETCH_TIMEOUT' エラーを throw
 *
 * ZK 原則: API キーは options.headers に含まれるが、ログには URL とステータスのみ出力。
 * headers の内容は一切ログに出力しない。
 */
async function fetchWithRetry(
  url: string,
  options: Omit<RequestInit, 'signal'>,
): Promise<Response> {
  // URL にシークレットが混入していないことを確認（念のためマスク）
  const safeUrl = url.split('?')[0] + '?[params]';
  let lastErr: unknown;

  for (let attempt = 0; attempt < SUBMIT_RETRY_MAX; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (!isRetryable(res.status)) return res; // 成功 or リトライ不要

      // 429 / 5xx → バックオフ後にリトライ
      const delay = parseRetryAfter(res) ?? SUBMIT_RETRY_DELAYS[attempt] ?? 4000;
      console.warn(
        `[Azure/analyze] HTTP ${res.status} attempt=${attempt + 1}/${SUBMIT_RETRY_MAX}` +
        ` — retrying in ${delay}ms (${safeUrl})`,
      );
      await new Promise((r) => setTimeout(r, delay));
      lastErr = new Error(`SUBMIT_HTTP_${res.status}`);

    } catch (err) {
      clearTimeout(timer);
      const name = err instanceof Error ? err.name : '';

      if (name === 'AbortError') {
        throw new Error('FETCH_TIMEOUT'); // タイムアウト → リトライしない
      }
      if (name === 'TypeError') {
        throw err; // ネットワーク到達不能 → リトライしない
      }

      lastErr = err;
      const delay = SUBMIT_RETRY_DELAYS[attempt] ?? 4000;
      console.warn(
        `[Azure/analyze] fetch error [${name}] attempt=${attempt + 1}/${SUBMIT_RETRY_MAX}` +
        ` — retrying in ${delay}ms`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // リトライ上限に達した場合
  throw lastErr ?? new Error('SUBMIT_EXHAUSTED');
}

// ─── Azure Polling ────────────────────────────────────────────────────────────

/**
 * ポーリング 1 回分の fetch (429/5xx は 1 回だけ短いバックオフでリトライ)
 *
 * ZK 原則: apiKey はヘッダーにのみ使用し、ログに出力しない。
 */
async function pollOnce(operationUrl: string, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000); // ポーリング 1 回: 10s timeout
  try {
    const res = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      signal: controller.signal,
    });
    clearTimeout(timer);

    // 429 / 5xx はポーリング内で 1 回だけリトライ（長いリトライはしない）
    if (isRetryable(res.status)) {
      const delay = parseRetryAfter(res) ?? 2000;
      console.warn(`[Azure/analyze] poll HTTP ${res.status} — waiting ${delay}ms then retrying once`);
      await new Promise((r) => setTimeout(r, delay));

      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 10_000);
      try {
        const res2 = await fetch(operationUrl, {
          headers: { 'Ocp-Apim-Subscription-Key': apiKey },
          signal: controller2.signal,
        });
        clearTimeout(timer2);
        return res2;
      } catch {
        clearTimeout(timer2);
        throw new Error(`POLL_HTTP_${res.status}`);
      }
    }
    return res;
  } catch (err) {
    clearTimeout(timer);
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError') throw new Error('POLL_TIMEOUT');
    throw err;
  }
}

/** ポーリング — 表面 (prebuilt-businessCard → OcrResult) */
async function pollFront(operationUrl: string, apiKey: string): Promise<OcrResult> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await pollOnce(operationUrl, apiKey);
    if (!res.ok) throw new Error(`POLL_HTTP_${res.status}`);

    const data = await res.json() as {
      status: string;
      analyzeResult?: { documents?: Array<{ fields?: BcFields }> };
    };

    if (data.status === 'failed') throw new Error('ANALYSIS_FAILED');
    if (data.status === 'succeeded') {
      const fields = data.analyzeResult?.documents?.[0]?.fields;
      if (!fields) throw new Error('EMPTY_FIELDS');
      return mapBusinessCardFields(fields);
    }
    // running / notStarted → 次のループへ
  }
  throw new Error('POLL_TIMEOUT');
}

/** ポーリング — 裏面 (prebuilt-read → 検索用テキスト) */
async function pollBack(operationUrl: string, apiKey: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await pollOnce(operationUrl, apiKey);
    if (!res.ok) throw new Error(`POLL_HTTP_${res.status}`);

    const data = await res.json() as {
      status: string;
      analyzeResult?: ReadAnalyzeResult;
    };

    if (data.status === 'failed') throw new Error('ANALYSIS_FAILED');
    if (data.status === 'succeeded') {
      const ar = data.analyzeResult;
      if (ar?.content?.trim()) return ar.content.trim();
      const lines: string[] = [];
      for (const page of ar?.pages ?? []) {
        for (const line of page.lines ?? []) {
          if (line.content?.trim()) lines.push(line.content.trim());
        }
      }
      return lines.join('\n');
    }
  }
  throw new Error('POLL_TIMEOUT');
}

/**
 * polling / analysis のエラーコードをユーザー向けメッセージに変換
 */
function mapPollError(err: unknown, mode: 'front' | 'back'): string {
  const msg = err instanceof Error ? err.message : '';

  if (msg === 'ANALYSIS_FAILED' || msg === 'EMPTY_FIELDS') {
    return classifyAnalysisFailure(mode);
  }
  if (msg === 'POLL_TIMEOUT') {
    return (
      'Azure の解析に時間がかかりすぎています（30秒超過）。\n\n' +
      'ネットワーク状態を確認してから再試行してください。'
    );
  }
  if (msg.startsWith('POLL_HTTP_')) {
    const code = msg.replace('POLL_HTTP_', '');
    return `解析結果の取得に失敗しました（HTTP ${code}）。しばらく後に再試行してください。`;
  }
  // TypeError などのネットワーク系
  return classifyFetchError(err);
}

/**
 * fetchWithRetry が throw したエラーをユーザー向けメッセージに変換
 * (submit フェーズのリトライ上限到達 / タイムアウト)
 */
function mapSubmitError(err: unknown): string {
  const msg = err instanceof Error ? err.message : '';

  if (msg === 'FETCH_TIMEOUT') {
    return (
      'Azure への接続がタイムアウトしました（20秒以内に応答なし）。\n\n' +
      '① ネットワーク接続を確認してください\n' +
      '② しばらく待ってから再試行してください\n' +
      '③ 問題が続く場合は Azure Portal でリソースの状態を確認してください'
    );
  }
  if (msg.startsWith('SUBMIT_HTTP_')) {
    const code = msg.replace('SUBMIT_HTTP_', '');
    return (
      `Azure へのリクエストが繰り返し失敗しました（HTTP ${code}）。\n\n` +
      'しばらく時間をおいてから再試行してください。'
    );
  }
  if (msg === 'SUBMIT_EXHAUSTED') {
    return (
      'Azure へのリクエストが最大試行回数に達しました。\n\n' +
      'しばらく待ってから再試行してください。\n' +
      'ネットワーク接続も合わせて確認してください。'
    );
  }
  // TypeError: Load failed などのネットワーク到達不能
  return classifyFetchError(err);
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
    let fetchError: unknown = null;

    for (const analyzeUrl of analyzePaths) {
      let res: Response;
      try {
        // 指数バックオフ付きリトライ (429/5xx のみ、最大 SUBMIT_RETRY_MAX 回)
        res = await fetchWithRetry(analyzeUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'image/jpeg',
          },
          body: imageBuffer,
        });
      } catch (err) {
        const errName = err instanceof Error ? err.name    : 'unknown';
        const errMsg  = err instanceof Error ? err.message : String(err);
        console.error(`[Azure/analyze] fetchWithRetry threw [${errName}]: ${errMsg}`);
        fetchError = err;
        break; // TypeError / FETCH_TIMEOUT → 両パスで同じ結果のため break
      }

      lastStatus = res.status;

      if (res.status === 401 || res.status === 403) {
        return Response.json(
          {
            ok: false,
            error:
              'API キーが無効または期限切れです。\n\n' +
              '設定画面で Azure の API キーをコピーし直して保存してください。',
          } as AnalyzeResponse,
          { status: 200 },
        );
      }

      if (res.status !== 404) {
        submitRes = res;
        break;
      }
      // 404 → 次のパスへ
    }

    // fetchWithRetry が throw (TypeError / FETCH_TIMEOUT / リトライ上限) の場合
    if (fetchError !== null) {
      return Response.json(
        { ok: false, error: mapSubmitError(fetchError) } as AnalyzeResponse,
        { status: 200 },
      );
    }

    if (!submitRes || !submitRes.ok) {
      const errMsg =
        lastStatus === 404
          ? 'Azure のエンドポイントが見つかりません。\n\n' +
            '設定画面でエンドポイント URL を確認してください。\n' +
            '例: https://your-name.cognitiveservices.azure.com'
          : `Azure へのリクエストに失敗しました（HTTP ${lastStatus}）。しばらく後に再試行してください。`;
      return Response.json({ ok: false, error: errMsg } as AnalyzeResponse, { status: 200 });
    }

    const operationUrl = submitRes.headers.get('Operation-Location');
    if (!operationUrl) {
      return Response.json(
        {
          ok: false,
          error:
            'Azure からの応答が不正です（Operation-Location ヘッダーがありません）。\n\n' +
            'エンドポイントのリージョンが設定画面と一致しているか確認してください。',
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    // ── Step 3: ポーリング & 結果返却 ─────────────────────────────────────────
    try {
      if (mode === 'back') {
        const notes = await pollBack(operationUrl, apiKey);
        return Response.json({ ok: true, notes } as AnalyzeResponse, { status: 200 });
      }
      const result = await pollFront(operationUrl, apiKey);
      return Response.json({ ok: true, result } as AnalyzeResponse, { status: 200 });
    } catch (pollErr) {
      const errName = pollErr instanceof Error ? pollErr.name : 'unknown';
      const errMsg  = pollErr instanceof Error ? pollErr.message : String(pollErr);
      console.error(`[Azure/analyze] polling failed [${errName}]: ${errMsg}`);
      return Response.json(
        { ok: false, error: mapPollError(pollErr, mode) } as AnalyzeResponse,
        { status: 200 },
      );
    }

  } catch (err) {
    // 画像前処理 (sharp) などのエラーを捕捉
    const errName = err instanceof Error ? err.name : 'unknown';
    const errMsg  = err instanceof Error ? err.message : String(err);
    console.error(`[Azure/analyze] unexpected error [${errName}]: ${errMsg}`);
    return Response.json(
      {
        ok: false,
        error:
          '画像の処理中にエラーが発生しました。\n\n' +
          '別の角度や明るさで撮影し直してください。\n' +
          '問題が続く場合はアプリを再起動してください。',
      } as AnalyzeResponse,
      { status: 200 },
    );
  }
}
