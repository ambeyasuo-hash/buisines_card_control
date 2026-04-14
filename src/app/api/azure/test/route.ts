/**
 * Azure Document Intelligence 接続テスト
 * サーバーサイドから Azure にリクエストを送信して接続を確認
 * クライアントの CORS 制限を回避
 *
 * POST /api/azure/test
 * Body: { endpoint: string, apiKey: string }
 * Response: { ok: boolean, message: string, statusCode?: number }
 */

interface RequestBody {
  endpoint?: string;
  apiKey?: string;
}

interface TestResponse {
  ok: boolean;
  message: string;
  statusCode?: number;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as RequestBody;
    const { endpoint, apiKey } = body;

    // 入力チェック
    if (!endpoint?.trim()) {
      return Response.json(
        { ok: false, message: 'Endpoint を入力してください' } as TestResponse,
        { status: 400 },
      );
    }

    if (!apiKey?.trim()) {
      return Response.json(
        { ok: false, message: 'API Key を入力してください' } as TestResponse,
        { status: 400 },
      );
    }

    // URL サニタイズ
    let baseUrl = endpoint.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');


    // Azure Document Intelligence への POST リクエスト
    // 複数の API バージョンを試す
    const paths = [
      '/documentintelligence/document-models/prebuilt-read:analyze?api-version=2023-10-31-preview',
      '/documentintelligence/document-models/prebuilt-read:analyze?api-version=2023-07-31-preview',
      '/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31',
    ];

    let lastError: { status?: number; message?: string } | null = null;

    for (const path of paths) {
      try {
        const testUrl = `${baseUrl}${path}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey.trim(),
            'Content-Type': 'image/jpeg',
          },
          // 無効な JPEG ヘッダーを送信（エンドポイント存在確認用）
          body: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 200-299: 成功
        if (response.status >= 200 && response.status < 300) {
          return Response.json(
            {
              ok: true,
              message: 'Azure Document Intelligence に接続しました ✓',
              statusCode: response.status,
            } as TestResponse,
            { status: 200 },
          );
        }

        // 400: Bad Request - エンドポイントは存在するが、ボディが無効（期待動作）
        if (response.status === 400) {
          return Response.json(
            {
              ok: true,
              message: 'Azure Document Intelligence に接続しました ✓',
              statusCode: response.status,
            } as TestResponse,
            { status: 200 },
          );
        }

        // 401/403: Unauthorized/Forbidden - API キーが無効
        if (response.status === 401 || response.status === 403) {
          return Response.json(
            {
              ok: false,
              message:
                'API Key が無効です。\n\n' +
                'Azure Portal で以下を確認してください：\n' +
                '1. リソースが存在するか\n' +
                '2. API Key が正しいか（複製貼り付けエラーがないか）\n' +
                '3. API Key の有効期限が切れていないか',
              statusCode: response.status,
            } as TestResponse,
            { status: 200 },
          );
        }

        // 404: Not Found - このパスは存在しない、次を試す
        if (response.status === 404) {
          lastError = { status: 404, message: 'Path not found, trying next...' };
          continue;
        }

        // その他のエラー
        if (response.status >= 500) {
          return Response.json(
            {
              ok: false,
              message:
                'Azure サービスが利用できません。\n\n' +
                'Azure のステータスページを確認するか、\n' +
                'しばらく時間をおいてから再度お試しください。',
              statusCode: response.status,
            } as TestResponse,
            { status: 200 },
          );
        }

        // その他の 4xx エラー
        lastError = { status: response.status, message: `HTTP ${response.status}` };
        continue;
      } catch (err) {
        const error = err as Error;

        // ネットワークエラー
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          return Response.json(
            {
              ok: false,
              message:
                'エンドポイントのドメインが見つかりません。\n\n' +
                'Azure Portal で Endpoint URL を確認して、\n' +
                '正確に入力してください。\n\n' +
                '例: https://businesscard-ngtest.cognitiveservices.azure.com',
              statusCode: 0,
            } as TestResponse,
            { status: 200 },
          );
        }

        // 接続拒否
        if (error.message.includes('ECONNREFUSED')) {
          return Response.json(
            {
              ok: false,
              message:
                'Azure エンドポイントに接続できません。\n\n' +
                'ネットワーク接続を確認して、\n' +
                'Endpoint URL が正しいか確認してください。',
              statusCode: 0,
            } as TestResponse,
            { status: 200 },
          );
        }

        // タイムアウト
        if (error.message.includes('abort')) {
          return Response.json(
            {
              ok: false,
              message:
                'リクエストがタイムアウトしました。\n\n' +
                'ネットワーク接続が遅い可能性があります。\n' +
                'しばらく時間をおいてから再度お試しください。',
              statusCode: 0,
            } as TestResponse,
            { status: 200 },
          );
        }

        lastError = { message: error.message };
        continue;
      }
    }

    // すべてのパスが 404 を返した場合
    if (lastError?.status === 404) {
      return Response.json(
        {
          ok: false,
          message:
            'Document Intelligence リソースが見つかりません。\n\n' +
            'Azure Portal で以下を確認してください：\n' +
            '1. リソースの種類が「Document Intelligence」か\n' +
            '2. リソース名が正しいか\n' +
            '3. Endpoint URL が https://RESOURCE.cognitiveservices.azure.com の形式か',
          statusCode: 404,
        } as TestResponse,
        { status: 200 },
      );
    }

    // デフォルトエラー
    return Response.json(
      {
        ok: false,
        message:
          'Azure に接続できません。\n\n' +
          'Endpoint と API Key を確認してから、\n' +
          'もう一度お試しください。',
      } as TestResponse,
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;

    return Response.json(
      {
        ok: false,
        message: `エラーが発生しました：${error.message}`,
      } as TestResponse,
      { status: 500 },
    );
  }
}
