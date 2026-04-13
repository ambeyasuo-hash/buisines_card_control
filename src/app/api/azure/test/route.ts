/**
 * Azure Document Intelligence 接続テスト
 * クライアントサイドから受け取ったエンドポイント・キーを使用してサーバーサイドでテスト
 * CORS制限を回避するため、NextJS Route Handlerを使用
 *
 * POST /api/azure/test
 * Body: { endpoint: string, apiKey: string }
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

    // バリデーション
    if (!endpoint?.trim() || !apiKey?.trim()) {
      return Response.json(
        {
          ok: false,
          message: 'Endpoint と API Key を入力してください',
        } as TestResponse,
        { status: 400 },
      );
    }

    // URL サニタイズ
    let baseUrl = endpoint.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    // 末尾のスラッシュを削除
    baseUrl = baseUrl.replace(/\/$/, '');

    // Document Intelligence API テスト
    // 複数のエンドポイント形式に対応
    const testUrls = [
      // 新しい形式: documentintelligence
      `${baseUrl}/documentintelligence/document-models:list?api-version=2024-02-29-preview`,
      // 旧形式: formrecognizer
      `${baseUrl}/formrecognizer/documentModels:list?api-version=2023-10-31-preview`,
      // 代替形式
      `${baseUrl}/formrecognizer/v2.1/recognizeBusinessCards?language=ja`,
    ];

    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

    // 複数の API パスを試す
    for (const testUrl of testUrls) {
      try {
        // AbortController でタイムアウトを実装
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey.trim(),
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        lastResponse = response;

        // 200: 成功
        if (response.ok) {
          return Response.json(
            {
              ok: true,
              message: 'Azure Document Intelligence に接続しました ✓',
              statusCode: response.status,
            } as TestResponse,
            { status: 200 },
          );
        }

        // 401/403: API キーエラー
        if (response.status === 401 || response.status === 403) {
          return Response.json(
            {
              ok: false,
              message:
                'API Key が無効です。\n\n' +
                'Azure Portal で正しい API Key を確認し、\n' +
                '設定画面で再度入力してください。',
              statusCode: response.status,
            } as TestResponse,
            { status: 200 },
          );
        }

        // 404: エンドポイント形式が合致しない可能性
        if (response.status === 404) {
          lastError = new Error(`Endpoint not found (HTTP 404)`);
          continue; // 次のパスを試す
        }

        // その他のエラー
        if (response.status >= 400) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
      } catch (err) {
        lastError = err as Error;
        continue; // 次のパスを試す
      }
    }

    // すべてのパスが失敗した場合
    if (lastError) {
      const errorMsg = (lastError as Error).message;

      // ネットワークエラー
      if (
        errorMsg.includes('ENOTFOUND') ||
        errorMsg.includes('getaddrinfo') ||
        errorMsg.includes('ECONNREFUSED')
      ) {
        return Response.json(
          {
            ok: false,
            message:
              'Azure エンドポイントに接続できません。\n\n' +
              'エンドポイント URL を確認してください。\n' +
              '例：https://buisinesscard.cognitiveservices.azure.com',
          } as TestResponse,
          { status: 200 },
        );
      }

      // タイムアウト
      if (errorMsg.includes('timeout')) {
        return Response.json(
          {
            ok: false,
            message:
              'リクエストがタイムアウトしました。\n\n' +
              'ネットワーク接続を確認してから、\n' +
              'もう一度お試しください。',
          } as TestResponse,
          { status: 200 },
        );
      }
    }

    // 最後のレスポンスがある場合、そのステータスコードに基づいてエラーを返す
    if (lastResponse) {
      const statusCode = lastResponse.status;

      if (statusCode === 404) {
        return Response.json(
          {
            ok: false,
            message:
              'Document Intelligence リソースが見つかりません。\n\n' +
              '以下を確認してください：\n' +
              '1. Azure Portal でリソースが存在するか\n' +
              '2. リソースの種類が「Document Intelligence」か\n' +
              '3. エンドポイント URL が正しいか\n' +
              '（例：https://buisinesscard.cognitiveservices.azure.com）',
            statusCode,
          } as TestResponse,
          { status: 200 },
        );
      }

      return Response.json(
        {
          ok: false,
          message: `Azure からエラーが返されました（HTTP ${statusCode}）。\n\n` +
            'エンドポイントと API Key を確認してください。',
          statusCode,
        } as TestResponse,
        { status: 200 },
      );
    }

    // 予期しないエラー
    return Response.json(
      {
        ok: false,
        message:
          '予期しないエラーが発生しました。\n\n' +
          'エンドポイントと API Key を確認してから、\n' +
          'もう一度お試しください。',
      } as TestResponse,
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    return Response.json(
      {
        ok: false,
        message: `エラー: ${error.message}`,
      } as TestResponse,
      { status: 500 },
    );
  }
}
