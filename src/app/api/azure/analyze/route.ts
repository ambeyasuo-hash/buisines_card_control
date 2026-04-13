/**
 * Azure Document Intelligence OCR — サーバーサイドプロキシ
 * フロントエンドの CORS 制限を回避するためサーバー経由で Azure を呼び出す
 *
 * POST /api/azure/analyze
 * Body: { imageBase64: string }  ← data:image/jpeg;base64,... 形式
 * Response: { ok: boolean; lines?: string[]; error?: string }
 */

interface RequestBody {
  imageBase64?: string;
  endpoint?: string;  // localStorage から渡す（環境変数のフォールバック）
  apiKey?: string;    // localStorage から渡す（環境変数のフォールバック）
}

interface AnalyzeResponse {
  ok: boolean;
  lines?: string[];
  error?: string;
}

/** Base64 data URL → ArrayBuffer */
function base64ToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** ポーリング：succeeded になるまで最大 30 秒待つ */
async function pollResult(
  operationUrl: string,
  apiKey: string,
): Promise<string[]> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const res = await fetch(operationUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!res.ok) {
      throw new Error(`ポーリング失敗: HTTP ${res.status}`);
    }

    const data = await res.json() as {
      status: string;
      analyzeResult?: {
        content?: string;
        pages?: Array<{
          lines?: Array<{ content?: string }>;
        }>;
      };
    };

    if (data.status === 'failed') {
      throw new Error('Azure Document Intelligence の解析に失敗しました');
    }

    if (data.status === 'succeeded') {
      const lines: string[] = [];

      // Document Intelligence 形式: pages[].lines[].content
      if (data.analyzeResult?.pages) {
        for (const page of data.analyzeResult.pages) {
          for (const line of page.lines ?? []) {
            if (line.content?.trim()) lines.push(line.content.trim());
          }
        }
      }

      // フォールバック: content フィールド全体を行分割
      if (lines.length === 0 && data.analyzeResult?.content) {
        lines.push(
          ...data.analyzeResult.content
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        );
      }

      return lines;
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

    // 環境変数を優先、なければクライアントから受け取った値を使用
    const endpoint = (
      process.env.AZURE_OCR_ENDPOINT ?? bodyEndpoint ?? ''
    ).trim().replace(/\/$/, '');
    const apiKey = (
      process.env.AZURE_OCR_KEY ?? bodyApiKey ?? ''
    ).trim();

    if (!endpoint || !apiKey) {
      return Response.json(
        {
          ok: false,
          error:
            'Azure の設定が見つかりません。\n\n' +
            '設定画面でエンドポイントと API Key を入力して保存してください。',
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    const imageBuffer = base64ToArrayBuffer(imageBase64);

    // Document Intelligence: prebuilt-read モデルで OCR
    const analyzeUrl =
      `${endpoint}/documentintelligence/document-models/prebuilt-read:analyze` +
      `?api-version=2024-02-29-preview&locale=ja-JP`;

    const submitRes = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'image/jpeg',
      },
      body: imageBuffer,
    });

    if (!submitRes.ok) {
      if (submitRes.status === 401 || submitRes.status === 403) {
        return Response.json(
          {
            ok: false,
            error:
              'API Key が無効です。\n\n' +
              '設定画面で Azure の API Key を確認してください。',
          } as AnalyzeResponse,
          { status: 200 },
        );
      }

      if (submitRes.status === 404) {
        return Response.json(
          {
            ok: false,
            error:
              'Azure Document Intelligence のエンドポイントが見つかりません。\n\n' +
              '設定画面でエンドポイント URL を確認してください。',
          } as AnalyzeResponse,
          { status: 200 },
        );
      }

      return Response.json(
        {
          ok: false,
          error: `Azure へのリクエストに失敗しました（HTTP ${submitRes.status}）`,
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    // 202 Accepted → Operation-Location でポーリング
    const operationUrl = submitRes.headers.get('Operation-Location');
    if (!operationUrl) {
      return Response.json(
        {
          ok: false,
          error: 'Azure からの応答に Operation-Location がありません',
        } as AnalyzeResponse,
        { status: 200 },
      );
    }

    const lines = await pollResult(operationUrl, apiKey);

    return Response.json(
      { ok: true, lines } as AnalyzeResponse,
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('[Azure Analyze] Error:', error.message);

    return Response.json(
      {
        ok: false,
        error:
          '名刺の読み取り中にエラーが発生しました。\n\n' +
          '光の反射を抑えて、もう少し近づいて撮影してみてください。',
      } as AnalyzeResponse,
      { status: 200 },
    );
  }
}
