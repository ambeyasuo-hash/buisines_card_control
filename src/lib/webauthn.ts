/**
 * WebAuthn / Passkey Integration
 *
 * Phase 6: Biometric Security & PAA Integration
 *
 * 責務:
 *   - WebAuthn credential の生成・登録・管理
 *   - FaceID / 指紋認証による assertion 検証
 *   - credential.id + public key の localStorage 保持
 *   - 生体認証失敗時のエラーハンドリング
 *
 * Zero-Knowledge 原則:
 *   - credential ID / public key はクライアント側のみ保持（サーバー非送信）
 *   - 生体認証プロセスはローカル Secure Enclave 内のみで実行
 *   - assertion signature はマスターキーの wrapping key 導出にのみ使用
 */

import { getOrCreateEncryptionKey } from './crypto';

// ─── Constants ────────────────────────────────────────────────────────────

const LS_KEYS = {
  credentialId: 'webauthn_credential_id',
  publicKeyB64: 'webauthn_public_key_b64',
  enabled: 'webauthn_enabled',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────

interface WebAuthnSetupResult {
  success: boolean;
  message: string;
  credentialId?: string;
}

interface WebAuthnAssertionResult {
  success: boolean;
  message: string;
  signature?: ArrayBuffer;
  clientDataJSON?: ArrayBuffer;
}

// ─── Feature Detection ────────────────────────────────────────────────────

/**
 * ユーザーのデバイス / ブラウザが WebAuthn をサポートしているか確認
 *
 * 対応環境:
 *   - iOS 16+ (Face ID / Touch ID)
 *   - Android 9+ (Biometric API)
 *   - macOS 13+ (Touch ID)
 *   - Windows Hello
 *   - Chrome 67+, Firefox 60+, Safari 13+, Edge 18+
 */
export function isWebAuthnSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !!window.PublicKeyCredential &&
    !!navigator.credentials &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

/**
 * このデバイスで WebAuthn が既に有効か確認
 */
export function isWebAuthnEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(LS_KEYS.enabled) === 'true';
}

// ─── Credential Registration ──────────────────────────────────────────────

/**
 * WebAuthn Credential の初回登録フロー
 *
 * ユーザーが「生体認証をセットアップ」をタップ時に呼び出す
 */
export async function registerWebAuthnCredential(): Promise<WebAuthnSetupResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      message: 'このデバイスは生体認証に対応していません。PIN による保護をご使用ください。',
    };
  }

  try {
    // Step 1: Encryption salt（ユーザー固有）を取得 or 生成
    // TODO: Supabase から encryption_salt を取得、なければ UUID を生成
    const encryptionSalt = 'placeholder-salt'; // 実装時に Supabase から取得

    // Step 2: Challenge を生成（32 bytes ランダム）
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Step 3: PublicKeyCredential 作成オプションを構築
    const creationOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'あんべ',
        id: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
      },
      user: {
        id: new TextEncoder().encode(encryptionSalt),
        name: encryptionSalt,
        displayName: 'Ambe User',
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // FaceID / 指紋のみ（セキュリティキー非対応）
        userVerification: 'preferred',
      },
      attestation: 'none', // プライバシー保護のため attestation 不要
      timeout: 60000,
    };

    // Step 4: credential.create() を呼び出し（OS に委譲）
    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential || !credential.id) {
      return {
        success: false,
        message: '生体認証がキャンセルされました。',
      };
    }

    // Step 5: Credential ID と public key を localStorage に保存
    // credential.id は既に DOMString なため、直接 base64 でエンコード
    const credentialIdBase64 = typeof credential.id === 'string'
      ? btoa(credential.id)
      : btoa(String.fromCharCode(...new Uint8Array(credential.id as ArrayBuffer)));
    localStorage.setItem(LS_KEYS.credentialId, credentialIdBase64);
    localStorage.setItem(LS_KEYS.enabled, 'true');

    // TODO: public key の抽出と保存は attested credential data より
    // 実装時: credential.response.attestationObject → attestedCredentialData.credentialPublicKey

    return {
      success: true,
      message: '生体認証がセットアップされました。',
      credentialId: credential.id.toString(),
    };
  } catch (error) {
    console.error('[WebAuthn] Registration error:', error);
    return {
      success: false,
      message: `セットアップエラー: ${(error as Error).message}`,
    };
  }
}

// ─── Credential Assertion (Authentication) ────────────────────────────────

/**
 * WebAuthn Assertion — ユーザー認証時に呼び出し
 *
 * マスターキー unwrap の前ステップ。
 * Assertion signature は src/lib/crypto.ts の deriveWrappingKey() で使用。
 */
export async function assertWebAuthnCredential(): Promise<WebAuthnAssertionResult> {
  if (!isWebAuthnSupported() || !isWebAuthnEnabled()) {
    return {
      success: false,
      message: 'WebAuthn が有効化されていません。',
    };
  }

  try {
    const credentialIdB64 = localStorage.getItem(LS_KEYS.credentialId);
    if (!credentialIdB64) {
      return {
        success: false,
        message: 'Credential が見つかりません。セットアップをやり直してください。',
      };
    }

    // Challenge を生成（32 bytes ランダム）
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Get assertion options
    const assertionOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'preferred',
    };

    // navigator.credentials.get() を呼び出し（OS に委譲）
    const assertion = (await navigator.credentials.get({
      publicKey: assertionOptions,
    })) as PublicKeyCredential | null;

    if (!assertion || assertion.type !== 'public-key') {
      return {
        success: false,
        message: '認証がキャンセルされました。',
      };
    }

    const response = assertion.response as AuthenticatorAssertionResponse;

    // TODO: signature 検証（stored public key と照合）
    // 実装時: response.signature を stored public key で verify

    return {
      success: true,
      message: '認証成功',
      signature: response.signature,
      clientDataJSON: response.clientDataJSON,
    };
  } catch (error) {
    console.error('[WebAuthn] Assertion error:', error);
    return {
      success: false,
      message: `認証エラー: ${(error as Error).message}`,
    };
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────

/**
 * WebAuthn 設定をクリア（SettingsPage 「リセット」ボタン用）
 */
export function clearWebAuthnCredential(): void {
  localStorage.removeItem(LS_KEYS.credentialId);
  localStorage.removeItem(LS_KEYS.publicKeyB64);
  localStorage.setItem(LS_KEYS.enabled, 'false');
}

/**
 * Phase 6 実装チェックリスト:
 *
 * [ ] AttestationObject パース & public key 抽出ロジック
 * [ ] Assertion signature 検証ロジック
 * [ ] エラーメッセージの日本語化と UX 統一
 * [ ] Fallback PIN 機能の統合
 * [ ] ブラウザ互換性テスト (iOS Safari, Chrome Android, etc.)
 */
