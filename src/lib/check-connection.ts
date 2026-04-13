/**
 * Connection Test Module
 * Lightweight health checks for external APIs
 * Each function returns { ok: boolean; message: string }
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ConnectionResult {
  ok: boolean;
  message: string;
  code?: string;
}

// ─── Supabase ─────────────────────────────────────────────────────────────────
/**
 * Test Supabase connection with minimal query
 * Executes: SELECT id FROM business_cards LIMIT 1
 */
export async function checkSupabaseConnection(
  supabaseUrl: string,
  anonKey: string,
): Promise<ConnectionResult> {
  if (!supabaseUrl?.trim() || !anonKey?.trim()) {
    return { ok: false, message: 'Supabase URL と Anon Key を入力してください' };
  }

  try {
    const baseUrl = supabaseUrl.trim().replace(/\/$/, ''); // Remove trailing slash

    const response = await fetch(`${baseUrl}/rest/v1/business_cards?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey.trim()}`,
        'apikey': anonKey.trim(),
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    if (response.ok || response.status === 401) {
      // 200 OK = table exists, 401 = auth failed (but API reachable)
      return { ok: true, message: 'Supabase に接続しました ✓' };
    }

    if (response.status === 404) {
      return { ok: false, message: 'テーブルが見つかりません。Supabase で business_cards テーブルを作成してください' };
    }

    return {
      ok: false,
      message: `HTTP ${response.status}: ${response.statusText}`,
      code: `HTTP_${response.status}`,
    };
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('Failed to fetch')) {
      return { ok: false, message: 'CORS エラーまたはネットワーク接続エラー。URL が正しいか確認してください' };
    }
    if (error.message.includes('Invalid URL')) {
      return { ok: false, message: 'URL の形式が不正です。https:// で始まっていますか？' };
    }
    return { ok: false, message: `エラー: ${error.message}` };
  }
}

// ─── Azure OCR (Server-side) ──────────────────────────────────────────────────
/**
 * Test Azure via Next.js Route Handler (avoids CORS)
 * More reliable than client-side test
 */
export async function checkAzureConnectionViaServer(
  endpoint: string,
  apiKey: string,
): Promise<ConnectionResult> {
  if (!endpoint?.trim() || !apiKey?.trim()) {
    return { ok: false, message: 'Azure Endpoint と API Key を入力してください' };
  }

  try {
    // 新しい Azure Document Intelligence テストエンドポイントを使用
    const response = await fetch('/api/azure/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: endpoint.trim(), apiKey: apiKey.trim() }),
    });

    const result = (await response.json()) as ConnectionResult;
    return result;
  } catch (err) {
    const error = err as Error;
    return { ok: false, message: `エラー: ${error.message}` };
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
/**
 * Test Gemini API key
 * Attempts to list models (lightweight operation)
 */
export async function checkGeminiConnection(apiKey: string): Promise<ConnectionResult> {
  if (!apiKey?.trim()) {
    return { ok: false, message: 'Gemini API Key を入力してください' };
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    // Add API key to response inspection (fetch doesn't include it in params for security)
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
    url.searchParams.set('key', apiKey.trim());

    // Retry with key in URL
    const keyResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
    });

    if (keyResponse.ok) {
      return { ok: true, message: 'Gemini に接続しました ✓' };
    }

    if (keyResponse.status === 401 || keyResponse.status === 403) {
      return { ok: false, message: 'Gemini API Key が無効です。キーを確認してください' };
    }

    if (keyResponse.status === 400) {
      return { ok: false, message: 'API Key の形式が不正です（AIza で始まっていますか？）' };
    }

    return {
      ok: false,
      message: `HTTP ${keyResponse.status}: Gemini API に接続できません`,
      code: `GEMINI_${keyResponse.status}`,
    };
  } catch (err) {
    const error = err as Error;
    if (error.message.includes('Failed to fetch')) {
      return { ok: false, message: 'ネットワーク接続エラー。インターネット接続を確認してください' };
    }
    return { ok: false, message: `エラー: ${error.message}` };
  }
}

// ─── All-in-One Test ──────────────────────────────────────────────────────────
/**
 * Batch test all configured services
 */
export async function checkAllConnections(config: {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  azureEndpoint?: string;
  azureKey?: string;
  geminiKey?: string;
}): Promise<Record<string, ConnectionResult>> {
  const results: Record<string, ConnectionResult> = {
    supabase: { ok: false, message: '未テスト' },
    azure: { ok: false, message: '未テスト' },
    gemini: { ok: false, message: '未テスト' },
  };

  // Test Supabase
  if (config.supabaseUrl && config.supabaseAnonKey) {
    results.supabase = await checkSupabaseConnection(config.supabaseUrl, config.supabaseAnonKey);
  }

  // Test Azure (via server-side handler)
  if (config.azureEndpoint && config.azureKey) {
    results.azure = await checkAzureConnectionViaServer(config.azureEndpoint, config.azureKey);
  }

  // Test Gemini
  if (config.geminiKey) {
    results.gemini = await checkGeminiConnection(config.geminiKey);
  }

  return results;
}
