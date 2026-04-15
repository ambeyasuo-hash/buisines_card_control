/**
 * Azure Connection Test Endpoint
 * Lightweight health check for Azure Document Intelligence API
 *
 * POST /api/azure/test
 * Body: { endpoint: string; apiKey: string }
 * Response: { ok: boolean; message: string; code?: string }
 */

interface TestRequest {
  endpoint?: string;
  apiKey?: string;
}

interface TestResponse {
  ok: boolean;
  message: string;
  code?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TestRequest;

    const endpoint = (body.endpoint ?? '').trim().replace(/\/$/, '');
    const apiKey = (body.apiKey ?? '').trim();

    // ─── Validation ──────────────────────────────────────────────────────────

    if (!endpoint) {
      return Response.json(
        { ok: false, message: 'Azure Endpoint が空です', code: 'EMPTY_ENDPOINT' } as TestResponse,
        { status: 200 }
      );
    }

    if (!apiKey) {
      return Response.json(
        { ok: false, message: 'Azure API Key が空です', code: 'EMPTY_KEY' } as TestResponse,
        { status: 200 }
      );
    }

    // ─── Endpoint URL format validation ───────────────────────────────────────

    if (!endpoint.startsWith('https://')) {
      return Response.json(
        {
          ok: false,
          message: 'エンドポイントは https:// で始まる必要があります',
          code: 'INVALID_PROTOCOL',
        } as TestResponse,
        { status: 200 }
      );
    }

    if (!endpoint.includes('.cognitiveservices.azure.com')) {
      return Response.json(
        {
          ok: false,
          message: 'エンドポイントに .cognitiveservices.azure.com が含まれていません',
          code: 'INVALID_ENDPOINT_DOMAIN',
        } as TestResponse,
        { status: 200 }
      );
    }

    // Extract region and resource name from endpoint
    // Format: https://{region}.api.cognitive.microsoft.com or https://{resourceName}.cognitiveservices.azure.com
    const urlObj = new URL(endpoint);
    const hostname = urlObj.hostname;

    if (!hostname.includes('cognitiveservices.azure.com')) {
      return Response.json(
        {
          ok: false,
          message: '有効な Azure エンドポイントのホスト名ではありません',
          code: 'INVALID_HOST',
        } as TestResponse,
        { status: 200 }
      );
    }

    // ─── API Key format validation ────────────────────────────────────────────

    if (apiKey.length < 30) {
      return Response.json(
        {
          ok: false,
          message: 'API キーが短すぎます（最小30文字）',
          code: 'KEY_TOO_SHORT',
        } as TestResponse,
        { status: 200 }
      );
    }

    // ─── Test connection ─────────────────────────────────────────────────────

    // Build test URL using both possible API paths
    const testUrls = [
      `${endpoint}/formrecognizer/documentModels/prebuilt-businessCard:analyze?api-version=2023-07-31&locale=ja-JP`,
      `${endpoint}/documentintelligence/document-models/prebuilt-businessCard:analyze?api-version=2023-10-31-preview&locale=ja-JP`,
    ];

    let lastError: Error | null = null;
    let lastStatus = 0;

    for (const testUrl of testUrls) {
      try {
        // Create a minimal test payload (empty JPEG header)
        const minimalImage = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
          0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
          0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
          0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
          0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
          0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
          0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
          0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
          0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
          0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
          0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
          0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
          0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
          0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
          0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
          0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
          0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2,
          0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
          0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6,
          0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
          0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0x51, 0x50, 0xff, 0xd9,
        ]);

        const res = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'image/jpeg',
          },
          body: minimalImage,
        });

        lastStatus = res.status;

        // ─── Handle Azure responses ──────────────────────────────────────────

        if (res.status === 202 || res.status === 201 || res.status === 200) {
          // Success: API accepted the request
          return Response.json(
            { ok: true, message: 'Azure に接続しました ✓' } as TestResponse,
            { status: 200 }
          );
        }

        if (res.status === 401 || res.status === 403) {
          return Response.json(
            {
              ok: false,
              message: 'API キーが無効です。Azure ポータルでキーを確認してください',
              code: 'INVALID_KEY',
            } as TestResponse,
            { status: 200 }
          );
        }

        if (res.status === 404) {
          // Try next URL
          continue;
        }

        if (res.status === 400) {
          // Might be malformed request (from test image), but endpoint exists
          // Try next URL or report success if both fail with 400
          continue;
        }

        // Other error codes
        const text = await res.text();
        lastError = new Error(`HTTP ${res.status}: ${text}`);
      } catch (err) {
        lastError = err as Error;
      }
    }

    // ─── If we get here, all URLs failed ──────────────────────────────────────

    if (lastStatus === 404) {
      return Response.json(
        {
          ok: false,
          message: 'Azure エンドポイントが見つかりません。エンドポイント URL を確認してください',
          code: 'ENDPOINT_NOT_FOUND',
        } as TestResponse,
        { status: 200 }
      );
    }

    if (lastStatus === 400) {
      return Response.json(
        {
          ok: false,
          message:
            'エンドポイントが正しくない形式です。以下の形式を確認してください:\n' +
            'https://{region}.api.cognitive.microsoft.com\n' +
            'または\n' +
            'https://{resourceName}.cognitiveservices.azure.com',
          code: 'INVALID_ENDPOINT_FORMAT',
        } as TestResponse,
        { status: 200 }
      );
    }

    return Response.json(
      {
        ok: false,
        message: lastError
          ? `Azure へのリクエストに失敗: ${lastError.message}`
          : 'Azure への接続に失敗しました',
        code: `HTTP_${lastStatus}`,
      } as TestResponse,
      { status: 200 }
    );
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('Invalid URL')) {
      return Response.json(
        {
          ok: false,
          message: 'エンドポイント URL の形式が不正です',
          code: 'INVALID_URL_FORMAT',
        } as TestResponse,
        { status: 200 }
      );
    }

    if (error.message.includes('did not match the expected pattern')) {
      return Response.json(
        {
          ok: false,
          message:
            'エンドポイント URL またはキーの形式が Azure の要件と一致していません\n\n' +
            'エンドポイント形式例:\n' +
            'https://japaneast.api.cognitive.microsoft.com\n' +
            'または\n' +
            'https://myresourcename.cognitiveservices.azure.com',
          code: 'PATTERN_MISMATCH',
        } as TestResponse,
        { status: 200 }
      );
    }

    return Response.json(
      {
        ok: false,
        message: `エラー: ${error.message}`,
        code: 'UNKNOWN_ERROR',
      } as TestResponse,
      { status: 200 }
    );
  }
}
