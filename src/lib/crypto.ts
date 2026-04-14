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

// ─── Phase 6-6: PIN Fallback & Key Wrapping ──────────────────────────────

/**
 * PIN（4～8桁）から wrapping key を導出
 * PBKDF2-SHA256, 100,000 iterations で計算量攻撃に耐性
 *
 * WebAuthn 非対応環境向けのフォールバック認証
 *
 * @param pin 4～8 桁の数字 (e.g., "1234")
 * @param salt Device 固有 UUID （encryption_salt として保存）
 * @returns AES-256-GCM 用の CryptoKey
 */
export async function deriveWrappingKeyFromPIN(
  pin: string,
  salt: string
): Promise<CryptoKey> {
  // Input validation
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN は4～8桁の数字である必要があります');
  }
  if (!salt || salt.length < 16) {
    throw new Error('Invalid salt');
  }

  // PIN + salt を Uint8Array に変換
  const pinEncoded = new TextEncoder().encode(pin);
  const saltEncoded = new TextEncoder().encode(salt);

  // PBKDF2-SHA256 で wrapping key を導出
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinEncoded,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltEncoded,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256 // 256-bit key for AES-256
  );

  // Derived bits を CryptoKey に変換
  return crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * マスターキー（Base64）を wrapping key で暗号化
 * WebAuthn assertion signature または PIN から導出した鍵で保護
 *
 * @param masterKeyB64 Base64-encoded master key (32 bytes AES-256)
 * @param wrappingKey CryptoKey (AES-256-GCM) from WebAuthn or PIN
 * @returns Wrapped key as "v1:<iv_b64>:<ciphertext_b64>"
 */
export async function wrapMasterKey(
  masterKeyB64: string,
  wrappingKey: CryptoKey
): Promise<string> {
  // Decode master key from Base64
  const masterKeyBytes = Uint8Array.from(
    atob(masterKeyB64),
    (c) => c.charCodeAt(0)
  );

  // Generate random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt with AES-256-GCM
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    masterKeyBytes
  );

  // Return as version-prefixed Base64
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ciphertextB64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));

  return `v1:${ivB64}:${ciphertextB64}`;
}

/**
 * 暗号化されたマスターキーを wrapping key で復号
 * WebAuthn または PIN ベースの認証後に呼び出し
 *
 * @param wrappedKeyB64 "v1:<iv_b64>:<ciphertext_b64>" format
 * @param wrappingKey CryptoKey (AES-256-GCM)
 * @returns Decrypted master key as CryptoKey
 */
export async function unwrapMasterKey(
  wrappedKeyB64: string,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  // Parse version-prefixed format
  const parts = wrappedKeyB64.split(':');
  if (parts[0] !== 'v1' || parts.length !== 3) {
    throw new Error('Invalid wrapped key format');
  }

  const iv = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));

  // Decrypt with AES-256-GCM
  const decryptedBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ciphertext
  );

  // Import decrypted bytes as CryptoKey
  return crypto.subtle.importKey(
    'raw',
    decryptedBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * PIN の強度チェック（UI用）
 * LockScreen から PIN pad に入力中にリアルタイムで呼び出し
 *
 * @param pin 入力中の PIN
 * @returns { valid: boolean, message: string }
 */
export function validatePINStrength(pin: string): {
  valid: boolean;
  message: string;
} {
  if (!pin) {
    return { valid: false, message: '4～8桁の数字を入力してください' };
  }

  if (!/^\d+$/.test(pin)) {
    return { valid: false, message: '数字のみ入力してください' };
  }

  if (pin.length < 4) {
    return { valid: false, message: `あと${4 - pin.length}桁必要です` };
  }

  if (pin.length > 8) {
    return { valid: false, message: '8桁以下にしてください' };
  }

  return { valid: true, message: '有効な PIN です' };
}
