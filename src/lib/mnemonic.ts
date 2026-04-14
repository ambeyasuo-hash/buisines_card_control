/**
 * Mnemonic (BIP-39) ↔ AES-256 Key conversion
 *
 * Zero-Knowledge Architecture:
 *   - すべての変換はクライアントサイドのみで行われる
 *   - フレーズやキーはサーバーに一切送信されない
 *
 * 仕様: 32バイト (256 bit) のエントロピー → 24単語のシークレットフレーズ
 */

import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Base64 エンコードされた AES-256 キー (32 bytes) → 24単語のシークレットフレーズ
 */
export function keyB64ToMnemonic(keyB64: string): string {
  const bytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('キーは32バイトである必要があります');
  return entropyToMnemonic(bytes, wordlist);
}

/**
 * 24単語のシークレットフレーズ → Base64 エンコードされた AES-256 キー (32 bytes)
 */
export function mnemonicToKeyB64(mnemonic: string): string {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('シークレットフレーズが正しくありません。24単語を正確に入力してください。');
  }
  const bytes = mnemonicToEntropy(normalized, wordlist);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * フレーズが有効かどうかを確認 (入力途中の検証用)
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
    return validateMnemonic(normalized, wordlist);
  } catch {
    return false;
  }
}
