/**
 * Supabase Client Factory — Singleton Pattern
 *
 * Zero-Knowledge Architecture:
 *   - URL / Anon Key は端末の localStorage からのみ読み込む
 *   - サーバーサイドでは一切インスタンスを生成しない
 *
 * Singleton 戦略:
 *   - モジュールスコープでインスタンスをキャッシュ
 *   - URL/Key が変わった場合（設定変更後など）は自動的に再生成
 *   - auth.storageKey を固有名 ('phoenix-auth-token') に固定し、
 *     他アプリや別ウィンドウコンテキストとの競合を物理的に回避
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LS_KEYS = {
  url:     'supabase_url',
  anonKey: 'supabase_anon_key',
} as const;

/** Supabase Auth セッションのストレージキー (競合防止) */
const AUTH_STORAGE_KEY = 'phoenix-auth-token';

// ─── Singleton cache ──────────────────────────────────────────────────────────
let _instance:   SupabaseClient | null = null;
let _cachedUrl:  string = '';
let _cachedKey:  string = '';

/**
 * Supabase クライアントを返す (シングルトン)
 *
 * - 同じ URL + Key の組み合わせなら既存インスタンスを再利用
 * - 設定変更後は新しいインスタンスを生成してキャッシュを更新
 * - SSR / サーバーサイドでは呼び出さないこと (localStorage 非対応)
 *
 * @throws Error — Supabase URL または Anon Key が未設定の場合
 */
export function createSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('createSupabaseClient はブラウザ環境でのみ使用できます');
  }

  const url     = localStorage.getItem(LS_KEYS.url)?.trim()     ?? '';
  const anonKey = localStorage.getItem(LS_KEYS.anonKey)?.trim() ?? '';

  if (!url || !anonKey) {
    throw new Error(
      'Supabase が未設定です。\n\n' +
      'Settings タブで Supabase URL と Anon Key を入力して保存してください。',
    );
  }

  // 認証情報が変わっていなければ既存インスタンスを返す
  if (_instance && _cachedUrl === url && _cachedKey === anonKey) {
    return _instance;
  }

  // 新規 or 設定変更後: インスタンスを再生成してキャッシュ
  _instance  = createClient(url, anonKey, {
    auth: {
      storageKey:      AUTH_STORAGE_KEY, // ブラウザコンテキスト競合を物理的に回避
      persistSession:  true,
      autoRefreshToken: true,
    },
  });
  _cachedUrl = url;
  _cachedKey = anonKey;

  return _instance;
}

/**
 * Supabase が設定済みかチェック (インスタンス生成なし)
 */
export function isSupabaseConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  const url     = localStorage.getItem(LS_KEYS.url)?.trim();
  const anonKey = localStorage.getItem(LS_KEYS.anonKey)?.trim();
  return !!url && !!anonKey;
}

/**
 * シングルトンキャッシュを破棄 (設定クリア時などに呼び出す)
 */
export function invalidateSupabaseClient(): void {
  _instance  = null;
  _cachedUrl = '';
  _cachedKey = '';
}
