/**
 * Server-side Azure OCR endpoint validator
 * Avoids CORS issues by testing from backend
 * POST /api/test-azure { endpoint, apiKey }
 */

export async function POST(request: Request) {
  try {
    const { endpoint, apiKey } = await request.json() as {
      endpoint?: string;
      apiKey?: string;
    };

    if (!endpoint?.trim() || !apiKey?.trim()) {
      return Response.json(
        { ok: false, message: 'Endpoint と API Key を入力してください' },
        { status: 400 },
      );
    }

    // Sanitize URL
    let baseUrl = endpoint.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/$/, '');

    // Test with minimal invalid image (server-side, no CORS)
    const testUrl = `${baseUrl}/vision/v3.2/read/analyze?language=ja`;

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey.trim(),
        'Content-Type': 'image/jpeg',
      },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      // Note: No CORS headers needed on server-side
    });

    // Interpret response
    if (response.ok || response.status === 400) {
      // 200 = success (unlikely with invalid image), 400 = bad image but endpoint reachable
      return Response.json(
        { ok: true, message: 'Azure に接続しました ✓' },
        { status: 200 },
      );
    }

    if (response.status === 401 || response.status === 403) {
      return Response.json(
        { ok: false, message: 'Azure API Key が無効です。\n\n設定画面で API Key を再度確認してください。' },
        { status: 200 },
      );
    }

    if (response.status === 404) {
      return Response.json(
        { ok: false, message: 'Azure エンドポイントが見つかりません。\n\n設定されているエンドポイント URL が正しいか確認してください。' },
        { status: 200 },
      );
    }

    if (response.status >= 500) {
      return Response.json(
        { ok: false, message: 'Azure サービスが一時的に利用できません。\n\nしばらく時間をおいてから、もう一度お試しください。' },
        { status: 200 },
      );
    }

    return Response.json(
      {
        ok: false,
        message: `Azure エンドポイントがエラーを返しました（HTTP ${response.status}）。\n\nURL と API Key を確認してください。`,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;

    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      return Response.json(
        {
          ok: false,
          message: 'エンドポイントのドメインが見つかりません。\n\nURL を確認してください（例: your-resource.cognitiveservices.azure.com）。',
        },
        { status: 200 },
      );
    }

    if (error.message.includes('ECONNREFUSED')) {
      return Response.json(
        {
          ok: false,
          message: 'Azure エンドポイントに接続できません。\n\nネットワーク接続を確認して、URL が正しいか確認してください。',
        },
        { status: 200 },
      );
    }

    return Response.json(
      {
        ok: false,
        message: `エラー: ${error.message}`,
      },
      { status: 200 },
    );
  }
}
