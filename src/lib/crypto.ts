/**
 * Client-side End-to-End Encryption (E2EE)
 * Web Crypto API — AES-256-GCM
 *
 * Zero-Knowledge Architecture:
 *   - 暗号化キーは端末の localStorage にのみ存在
 *   - サーバー（Vercel）はプレーンテキストの PII を一切受け取らない
 *   - Supabase の encrypted_data カラムには暗号文のみ格納
 *
 * フォーマット: "v1:<iv_base64>:<ciphertext_base64>"
 */

export const ENCRYPTION_LS_KEY = 'encryption_key_b64';
const KEY_ID = 'v1';

// ─── Key Operations ───────────────────────────────────────────────────────────

/** 新しい AES-256-GCM キーを生成 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,              // extractable (localStorage 保存用)
    ['encrypt', 'decrypt'],
  );
}

/** CryptoKey → Base64 文字列 (localStorage 保存用) */
export async function exportKeyAsBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

/** Base64 文字列 → CryptoKey */
export async function importKeyFromBase64(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/**
 * localStorage から暗号化キーを取得、なければ新規生成して保存
 * @returns { key, keyB64, isNew } — isNew=true のときは初回生成
 */
export async function getOrCreateEncryptionKey(): Promise<{
  key: CryptoKey;
  keyB64: string;
  isNew: boolean;
}> {
  const stored = localStorage.getItem(ENCRYPTION_LS_KEY)?.trim();
  if (stored) {
    const key = await importKeyFromBase64(stored);
    return { key, keyB64: stored, isNew: false };
  }
  // 初回: 新しいキーを生成して localStorage に保存
  const key    = await generateEncryptionKey();
  const keyB64 = await exportKeyAsBase64(key);
  localStorage.setItem(ENCRYPTION_LS_KEY, keyB64);
  return { key, keyB64, isNew: true };
}

// ─── Encrypt / Decrypt ───────────────────────────────────────────────────────

/**
 * 任意の JSON データを AES-256-GCM で暗号化
 * @returns "v1:<iv_base64>:<ciphertext_base64>"
 */
export async function encryptData(data: unknown, key: CryptoKey): Promise<string> {
  const iv      = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  const ivB64     = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));

  return `${KEY_ID}:${ivB64}:${cipherB64}`;
}

/**
 * 暗号化文字列を復号して元のデータに戻す
 */
export async function decryptData<T = unknown>(
  encrypted: string,
  key: CryptoKey,
): Promise<T> {
  const parts = encrypted.split(':');
  if (parts.length < 3) throw new Error('不正な暗号化フォーマットです');

  const [, ivB64, cipherB64] = parts;
  const iv           = Uint8Array.from(atob(ivB64),     (c) => c.charCodeAt(0));
  const cipherBuffer = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBuffer,
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}
