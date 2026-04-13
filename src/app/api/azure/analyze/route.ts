/**
 * Azure Document Intelligence OCR — サーバーサイドプロキシ
 * フロントエンドの CORS 制限を回避するためサーバー経由で Azure を呼び出す
 * モデル: prebuilt-businessCard（名刺専用）
 *
 * POST /api/azure/analyze
 * Body: { imageBase64: string, endpoint?: string, apiKey?: string }
 * Response: { ok: boolean; result?: OcrResult; error?: string }
 */

interface RequestBody {
  imageBase64?: string;
  endpoint?: string;
  apiKey?: string;
}

// scan/page.tsx の OcrResult と同じ構造
interface OcrResult {
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
  result?: OcrResult;
  error?: string;
}

// prebuilt-businessCard の documents[].fields 型定義
interface BusinessCardField {
  content?: string;
  valueString?: string;
}
interface BusinessCardFieldArray {
  valueArray?: Array<{
    content?: string;
    valueString?: string;
    valueObject?: Record<string, BusinessCardField>;
  }>;
}
interface BusinessCardFields {
  ContactNames?:  BusinessCardFieldArray;
  CompanyNames?:  BusinessCardFieldArray;
  JobTitles?:     BusinessCardFieldArray;
  Emails?:        BusinessCardFieldArray;
  MobilePhones?:  BusinessCardFieldArray;
  WorkPhones?:    BusinessCardFieldArray;
  OtherPhones?:   BusinessCardFieldArray;
  Addresses?:     BusinessCardFieldArray;
  Websites?:      BusinessCardFieldArray;
}

/** Base64 data URL → ArrayBuffer */
function base64ToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** valueArray の先頭 content を取り出す */
function firstContent(field?: BusinessCardFieldArray): string | undefined {
  return field?.valueArray?.[0]?.content?.trim() || undefined;
}

/** prebuilt-businessCard の documents[].fields を OcrResult にマッピング */
function mapBusinessCardFields(fields: BusinessCardFields): OcrResult {
  // 氏名: LastName + FirstName を結合
  let name: string | undefined;
  const nameArr = fields.ContactNames?.valueArray ?? [];
  if (nameArr.length > 0) {
    const obj = nameArr[0].valueObject ?? {};
    const last  = obj.LastName?.content?.trim()  ?? '';
    const first = obj.FirstName?.content?.trim() ?? '';
    name = [last, first].filter(Boolean).join(' ') || nameArr[0].content?.trim();
  }

  // 電話: モバイル優先、なければ会社番号
  const tel = firstContent(fields.MobilePhones)
           ?? firstContent(fields.WorkPhones)
           ?? firstContent(fields.OtherPhones);

  // raw テキスト: 全フィールドを結合
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

/** ポーリング: succeeded になるまで最大 30 秒待つ */
async function pollResult(
  operationUrl: string,
  apiKey: string,
): Promise<OcrResult> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!res.ok) throw new Error(`ポーリング失敗: HTTP ${res.status}`);

    const data = await res.json() as {
      status: string;
      analyzeResult?: {
        documents?: Array<{ fields?: BusinessCardFields }>;
      };
    };

    if (data.status === 'failed') {
      throw new Error('Azure の解析に失敗しました');
    }

    if (data.status === 'succeeded') {
      const fields = data.analyzeResult?.documents?.[0]?.fields;
      if (!fields) {
        throw new Error('名刺フィールドの取得に失敗しました');
      }
      return mapBusinessCardFields(fields);
    }
    // running / notStarted → 次のループへ
  }

  throw new Error('タイムアウト: Azure が 30 秒以内に結果を返しませんでした');
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as RequestBody;
    const { imageBase64, endpoint: bodyEndpoint, apiKey: bodyApiKey } = body;

    if (!imageBase64) {
      return Response.json(
        { ok: false, error: '画像データがありません' } as AnalyzeResponse,
        { status: 400 },
      );
    }

    const endpoint = (process.env.AZURE_OCR_ENDPOINT ?? bodyEndpoint ?? '').trim().replace(/\/$/, '');
    const apiKey   = (process.env.AZURE_OCR_KEY      ?? bodyApiKey  ?? '').trim();

    if (!endpoint || !apiKey) {
      return Response.json(
        {
          ok: false,
          error: 'Azure の設定が見つかりません。\n\n設定画面でエンドポイントと API Key を入力して保存してください。',
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    const imageBuffer = base64ToArrayBuffer(imageBase64);

    // prebuilt-businessCard で locale=ja-JP を明示指定
    // 旧 formrecognizer パスを先に試し、新 documentintelligence をフォールバック
    const analyzePaths = [
      `${endpoint}/formrecognizer/documentModels/prebuilt-businessCard:analyze?api-version=2023-07-31&locale=ja-JP`,
      `${endpoint}/documentintelligence/document-models/prebuilt-businessCard:analyze?api-version=2023-10-31-preview&locale=ja-JP`,
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
          error: lastStatus === 404
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

    const result = await pollResult(operationUrl, apiKey);

    return Response.json({ ok: true, result } as AnalyzeResponse, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('[Azure Analyze] Error:', error.message);
    return Response.json(
      {
        ok: false,
        error: '名刺の読み取り中にエラーが発生しました。\n\n光の反射を抑えて、もう少し近づいて撮影してみてください。',
      } as AnalyzeResponse,
      { status: 200 },
    );
  }
}
