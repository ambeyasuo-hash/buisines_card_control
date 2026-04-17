'use client';

/**
 * Vault — 階層型 Data Key バケット構造
 *
 * 鍵階層:
 *   Level 1 (WebAuthn / platform): assertion signature → wrapping key alpha
 *   Level 2 (Recovery):            24単語 BIP-39 mnemonic → wrapping key beta
 *   Data Key:                      PII (名刺データ・APIキー) を暗号化する唯一の鍵
 *
 * Supabase user_vault テーブルに以下を保存:
 *   wrapped_data_key_alpha  … WebAuthn で保護された Data Key
 *   wrapped_data_key_beta   … リカバリフレーズで保護された Data Key
 *
 * Zero-Knowledge 原則:
 *   - Data Key の平文はクライアントメモリにのみ存在
 *   - wrapped key だけがサーバーに送信される
 */

import { mnemonicToKeyB64 } from './mnemonic';
import { createSupabaseClient } from './supabase-client';

const FORMAT_VERSION = 'v1';

// ─── Data Key Operations ──────────────────────────────────────────────────────

/** PII 暗号化用 Data Key を新規生成 (AES-256-GCM, extractable) */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** Data Key → Base64 (バックアップ用) */
export async function exportDataKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/** Base64 → Data Key */
export async function importDataKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Wrap / Unwrap ────────────────────────────────────────────────────────────

/**
 * Data Key を wrapping key (Level 1 or Level 2) で暗号化
 * @returns "v1:<iv_b64>:<ciphertext_b64>"
 */
export async function wrapDataKey(
  dataKey: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', dataKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    rawKey,
  );
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
  return `${FORMAT_VERSION}:${ivB64}:${ctB64}`;
}

/**
 * wrapped Data Key を wrapping key で復号して Data Key を復元
 */
export async function unwrapDataKey(
  wrapped: string,
  wrappingKey: CryptoKey,
): Promise<CryptoKey> {
  const parts = wrapped.split(':');
  if (parts[0] !== FORMAT_VERSION || parts.length !== 3) {
    throw new Error('Invalid vault format');
  }
  const iv = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));
  const rawKey = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ct);
  return crypto.subtle.importKey(
    'raw', rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Level 2: Recovery Key Derivation ────────────────────────────────────────

/**
 * 24単語 BIP-39 mnemonic から Level 2 wrapping key を導出
 *
 * mnemonic のエントロピー (256 bits) を直接 AES-256-GCM キーとして利用。
 * 同じ mnemonic からは常に同じ wrapping key が得られる（決定論的）。
 */
export async function deriveWrappingKeyFromMnemonic(mnemonic: string): Promise<CryptoKey> {
  const keyB64 = mnemonicToKeyB64(mnemonic);
  const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Supabase Vault Storage ───────────────────────────────────────────────────

export interface UserVaultEntry {
  wrapped_data_key_alpha: string;
  wrapped_data_key_beta: string;
}

/**
 * user_vault テーブルに wrapped keys を保存 (upsert by encryption_salt)
 *
 * Zero-Knowledge: サーバーは wrapped (暗号化済み) key のみ受け取る。
 *
 * RLS デバッグ:
 *   - user_vault に anon INSERT/UPDATE ポリシーが必要
 *   - Supabase Dashboard → Authentication → Policies で確認
 */
export async function saveVaultToSupabase(
  entry: UserVaultEntry,
  encryptionSalt: string,
): Promise<void> {
  const client = createSupabaseClient();

  // RLS 診断: 認証状態をログ出力（匿名の場合は null）
  try {
    const { data: { user }, error: authErr } = await client.auth.getUser();
    console.log('[Vault] Auth state:', user ? `user=${user.id}` : 'anonymous (anon key)', authErr ? `authErr=${authErr.message}` : '');
  } catch {
    console.log('[Vault] Auth check skipped');
  }

  console.log('[Vault] Upserting user_vault... salt prefix:', encryptionSalt.slice(0, 8) + '***');

  const { data, error } = await client
    .from('user_vault')
    .upsert(
      {
        encryption_salt: encryptionSalt,
        wrapped_data_key_alpha: entry.wrapped_data_key_alpha,
        wrapped_data_key_beta: entry.wrapped_data_key_beta,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'encryption_salt' },
    )
    .select();

  if (error) {
    console.error('[Vault] Supabase upsert FAILED:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    // RLS ブロックの場合、hint に "insufficient privilege" 等が含まれる
    throw new Error(`Vault保存エラー (${error.code}): ${error.message}${error.hint ? ` — ヒント: ${error.hint}` : ''}`);
  }

  console.log('[Vault] Vault saved OK. rows returned:', data?.length ?? 0);
  if (!data || data.length === 0) {
    // upsert は成功したが行が返らない場合 = RLS の SELECT ポリシー欠如の可能性
    console.warn('[Vault] upsert returned 0 rows — verify RLS SELECT policy on user_vault');
  }
}

/**
 * user_vault テーブルから wrapped keys を取得
 */
export async function loadVaultFromSupabase(
  encryptionSalt: string,
): Promise<UserVaultEntry | null> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from('user_vault')
    .select('wrapped_data_key_alpha, wrapped_data_key_beta')
    .eq('encryption_salt', encryptionSalt)
    .single();
  if (error || !data) return null;
  return data as UserVaultEntry;
}
