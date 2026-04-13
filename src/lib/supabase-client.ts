/**
 * Supabase Client Factory
 * Initializes Supabase client from localStorage configuration
 * (SettingsPage で設定済みの URL/Key を使用)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LS_KEYS = {
  url: 'supabase_url',
  anonKey: 'supabase_anon_key',
} as const;

/**
 * Create and return Supabase client using stored configuration
 * @throws Error if Supabase URL or anon key is not configured
 */
export function createSupabaseClient(): SupabaseClient {
  const url = typeof window !== 'undefined'
    ? localStorage.getItem(LS_KEYS.url)?.trim()
    : null;
  const anonKey = typeof window !== 'undefined'
    ? localStorage.getItem(LS_KEYS.anonKey)?.trim()
    : null;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase が未設定です。\n\n' +
      'Settings タブで Supabase URL と Anon Key を入力して保存してください。',
    );
  }

  return createClient(url, anonKey);
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  const url = localStorage.getItem(LS_KEYS.url)?.trim();
  const anonKey = localStorage.getItem(LS_KEYS.anonKey)?.trim();
  return !!url && !!anonKey;
}
