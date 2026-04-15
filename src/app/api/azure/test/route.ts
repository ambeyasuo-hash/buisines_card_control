/**
 * Azure Document Intelligence Connection Test
 * Tests connectivity to Azure Document Intelligence (Form Recognizer) API
 *
 * Success Criteria:
 * - 200, 201, 202: Full success
 * - 400: Connection successful (image data missing, but API responded)
 * - 401, 403: Authentication failure (invalid key)
 * - 404: Path not found (try next API version)
 *
 * POST /api/azure/test
 * Body: { endpoint: string; apiKey: string }
 * Response: { ok: boolean; message: string; code?: string; debug?: string }
 */

interface TestRequest {
  endpoint?: string;
  apiKey?: string;
}

interface TestResponse {
  ok: boolean;
  message: string;
  code?: string;
  debug?: string;
}

/**
 * Normalize endpoint URL: extract origin, remove trailing slashes
 */
function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();

  try {
    const url = new URL(trimmed);
    // Return origin (protocol + hostname) without pathname
    return url.origin;
  } catch {
    // If URL constructor fails, do manual normalization
    return trimmed.replace(/\/+$/, '');
  }
}

/**
 * Build complete API request URL
 */
function buildApiUrl(endpoint: string, path: string): string {
  const normalized = normalizeEndpoint(endpoint);
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return normalized + cleanPath;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TestRequest;

    const rawEndpoint = (body.endpoint ?? '').trim();
    const apiKey = (body.apiKey ?? '').trim();

    // ─── Validation ──────────────────────────────────────────────────────────

    if (!rawEndpoint) {
      return Response.json(
        {
          ok: false,
          message: 'Azure Endpoint が空です',
          code: 'EMPTY_ENDPOINT',
        } as TestResponse,
        { status: 200 }
      );
    }

    if (!apiKey) {
      return Response.json(
        {
          ok: false,
          message: 'Azure API Key が空です',
          code: 'EMPTY_KEY',
        } as TestResponse,
        { status: 200 }
      );
    }

    // Normalize endpoint
    let endpoint: string;
    try {
      endpoint = normalizeEndpoint(rawEndpoint);
    } catch (err) {
      return Response.json(
        {
          ok: false,
          message: 'エンドポイント URL の形式が不正です',
          code: 'INVALID_URL',
        } as TestResponse,
        { status: 200 }
      );
    }

    // ─── Endpoint validation ──────────────────────────────────────────────────

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
          code: 'INVALID_DOMAIN',
        } as TestResponse,
        { status: 200 }
      );
    }

    // ─── API Key validation ───────────────────────────────────────────────────

    if (apiKey.length < 20) {
      return Response.json(
        {
          ok: false,
          message: 'API キーが短すぎます（最小20文字）',
          code: 'KEY_TOO_SHORT',
        } as TestResponse,
        { status: 200 }
      );
    }

    // ─── Test connection with both API versions ───────────────────────────────

    // API paths to try (in order of priority)
    const apiPaths = [
      // v3.1 GA (stable)
      '/formrecognizer/documentModels/prebuilt-businessCard:analyze?api-version=2023-07-31',
      // v4.0 Preview (latest)
      '/documentintelligence/document-models/prebuilt-businessCard:analyze?api-version=2024-02-29-preview',
    ];

    let lastStatus = 0;
    let lastErrorBody = '';
    let successfulPath = '';

    for (const apiPath of apiPaths) {
      try {
        // Build complete URL
        const fullUrl = buildApiUrl(endpoint, apiPath);

        // Debug: log URL with masked key
        const debugUrl = fullUrl + ' (key: ' + apiKey.substring(0, 4) + '***' + apiKey.substring(apiKey.length - 4) + ')';
        console.log('[Azure Test] Testing path:', debugUrl);

        // Create minimal test payload (empty JPEG header)
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

        // Send test request
        const res = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'image/jpeg',
          },
          body: minimalImage,
        });

        lastStatus = res.status;
        const responseText = await res.text();
        lastErrorBody = responseText;

        console.log(`[Azure Test] Path: ${apiPath.split('?')[0]} - Status: ${res.status}`);

        // ─── Success cases ────────────────────────────────────────────────────
        if (res.status === 202 || res.status === 201 || res.status === 200) {
          console.log('[Azure Test] ✓ Connection successful (202/201/200)');
          return Response.json(
            {
              ok: true,
              message: 'Azure Document Intelligence に接続しました ✓',
              code: `HTTP_${res.status}`,
            } as TestResponse,
            { status: 200 }
          );
        }

        // ─── 400 Bad Request = Connection successful (no image data) ──────────
        if (res.status === 400) {
          console.log('[Azure Test] ✓ Connection successful (400 - no image)');
          successfulPath = apiPath;
          // Return success - the API responded, meaning the endpoint exists and auth works
          return Response.json(
            {
              ok: true,
              message:
                'Azure Document Intelligence に接続しました ✓\n\n' +
                '（400エラーは正常です。テストペイロードに有効な画像がないため。実際の解析時は正常に動作します。）',
              code: 'HTTP_400_EXPECTED',
            } as TestResponse,
            { status: 200 }
          );
        }

        // ─── Authentication errors ────────────────────────────────────────────
        if (res.status === 401 || res.status === 403) {
          console.log('[Azure Test] ✗ Authentication failed');
          const errorMsg = responseText
            ? `${responseText.substring(0, 200)}`
            : 'API キーが無効です';
          return Response.json(
            {
              ok: false,
              message: `認証エラー (${res.status}):\n${errorMsg}`,
              code: 'INVALID_KEY',
            } as TestResponse,
            { status: 200 }
          );
        }

        // ─── Not found - try next API version ──────────────────────────────────
        if (res.status === 404) {
          console.log('[Azure Test] Path not found (404), trying next version...');
          continue;
        }

        // ─── Other errors ─────────────────────────────────────────────────────
        console.log(`[Azure Test] Unexpected status: ${res.status}`);
        const errorMsg = responseText.substring(0, 300);
        continue;
      } catch (err) {
        const error = err as Error;
        console.log(`[Azure Test] Error: ${error.message}`);
        // Continue to next path
        continue;
      }
    }

    // ─── All paths failed ──────────────────────────────────────────────────────

    console.log(`[Azure Test] ✗ All paths failed. Last status: ${lastStatus}`);

    if (lastStatus === 404) {
      return Response.json(
        {
          ok: false,
          message:
            'Azure エンドポイント が見つかりません。\n\n' +
            'エンドポイント URL を確認してください:\n' +
            'https://businesscard-ngtest.cognitiveservices.azure.com/\n\n' +
            '（末尾の / は自動的に削除されます）',
          code: 'PATH_NOT_FOUND',
          debug: `Last status: ${lastStatus}`,
        } as TestResponse,
        { status: 200 }
      );
    }

    if (lastStatus === 0) {
      return Response.json(
        {
          ok: false,
          message:
            'エンドポイント への接続に失敗しました。\n\n' +
            '以下を確認してください:\n' +
            '1. エンドポイント URL が正しい\n' +
            '2. インターネット接続がある\n' +
            '3. Azure ファイアウォール設定を確認',
          code: 'NETWORK_ERROR',
        } as TestResponse,
        { status: 200 }
      );
    }

    return Response.json(
      {
        ok: false,
        message:
          `Azure への リクエストが失敗しました。\n\n` +
          `ステータス: ${lastStatus}\n\n` +
          (lastErrorBody ? `エラー詳細:\n${lastErrorBody.substring(0, 300)}` : 'エラー詳細なし'),
        code: `HTTP_${lastStatus}`,
      } as TestResponse,
      { status: 200 }
    );
  } catch (err) {
    const error = err as Error;
    console.log('[Azure Test] Unexpected error:', error.message);

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
