/**
 * QR Code Generation & Parsing
 *
 * Phase 7-1: QR code generation for device pairing
 * On-the-fly generation (no server involvement)
 *
 * Dependencies: qrcode (npm install qrcode)
 */

import QRCode from 'qrcode';

// Type: QR Payload
export interface QRPayload {
  version: 1;
  deviceUUID: string;
  deviceName: string;
  publicKey: string; // RSA-2048 PEM format
  timestamp: number; // Unix timestamp (ms)
}

// ─── QR Code Generation ───────────────────────────────────────────────────

/**
 * QR code を生成（Device A が表示用）
 *
 * @param payload Device metadata + public key
 * @returns PNG data URL for display
 *
 * Usage:
 *   const qr = await generateQRCode(payload);
 *   <img src={qr} alt="Pairing QR Code" />
 */
export async function generateQRCode(payload: QRPayload): Promise<string> {
  // Serialize payload to JSON
  const json = JSON.stringify(payload);

  // Encode to Base64 for safe QR embedding
  const base64Encoded = btoa(json);

  // Generate QR code using qrcode library
  const qrImage = await QRCode.toDataURL(base64Encoded, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 1,
    width: QR_CONFIG.size,
  });

  return qrImage;
}

/**
 * QR code をスキャン後、payload を解析
 *
 * @param qrText QR code から取得したテキスト
 * @returns QRPayload object or null (invalid)
 */
export function parseQRPayload(qrText: string): QRPayload | null {
  try {
    // Decode Base64
    const decoded = atob(qrText);

    // Parse JSON
    const payload = JSON.parse(decoded);

    // Validate schema
    if (
      typeof payload.version !== 'number' ||
      typeof payload.deviceUUID !== 'string' ||
      typeof payload.deviceName !== 'string' ||
      typeof payload.publicKey !== 'string' ||
      typeof payload.timestamp !== 'number'
    ) {
      console.error('Invalid QR payload schema');
      return null;
    }

    // Check timestamp freshness (reject if > 5 minutes old)
    const now = Date.now();
    const age = now - payload.timestamp;
    if (age > 5 * 60 * 1000) {
      console.error('QR code expired (> 5 minutes old)');
      return null;
    }

    return payload as QRPayload;
  } catch (error) {
    console.error('Failed to parse QR payload:', error);
    return null;
  }
}

// ─── Public Key Extraction from QR ────────────────────────────────────────

/**
 * QR payload から RSA-2048 公開鍵を抽出
 * (Device B が Device A の公開鍵を取得)
 *
 * @param payload Parsed QR code
 * @returns RSA public key as PEM (Base64)
 */
export function extractPublicKeyFromPayload(payload: QRPayload): string {
  return payload.publicKey;
}

// ─── QR Display Parameters ────────────────────────────────────────────────

export const QR_CONFIG = {
  size: 300, // pixel
  errorCorrectionLevel: 'H', // High (30%)
  margin: 1,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
  expirySeconds: 300, // 5 minutes
};

/**
 * Phase 7-1 実装チェックリスト:
 *
 * [x] npm install qrcode ✅
 * [x] generateQRCode() を qrcode ライブラリで実装 ✅
 * [ ] DevicePairingModal.tsx で generateQRCode(payload) 呼び出し
 * [x] QR スキャン後 parseQRPayload() で payload 復号 ✅
 * [x] Timestamp freshness check (5 min expiry) ✅
 * [x] Schema validation テスト ✅
 * [ ] エラーハンドリング: 無効な QR → graceful error message
 * [ ] Device B が QR スキャン → payload 取得 → Device A の public key 解析確認
 */
