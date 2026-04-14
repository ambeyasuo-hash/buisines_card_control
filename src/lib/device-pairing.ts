/**
 * Device Pairing Management
 *
 * Phase 7-1: Device UUID, metadata, pairing logic
 *
 * Zero-Knowledge: Device metadata は Supabase に保存されるが、
 * 暗号化鍵は一切見られない（paired_devices.public_key_pem は公開鍵のみ）
 */

import { v4 as uuidv4 } from 'uuid';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DeviceMetadata {
  uuid: string; // Unique identifier for this device
  name: string; // e.g., "iPhone 15 Pro", "MacBook Pro M3"
  os: string; // iOS, Android, macOS, Windows
  type: 'mobile' | 'desktop';
  pairedAt: string; // ISO 8601 timestamp
}

export interface PairedDevice extends DeviceMetadata {
  publicKeyPEM: string; // RSA-2048 public key (PEM, Base64)
}

// ─── Device UUID Management ───────────────────────────────────────────────

const DEVICE_UUID_LS_KEY = 'device_uuid';
const DEVICE_NAME_LS_KEY = 'device_name';

/**
 * このデバイスの UUID を取得または新規生成
 * （初回実行時に生成、以降は localStorage から読み込み）
 */
export function getOrCreateDeviceUUID(): string {
  let uuid = localStorage.getItem(DEVICE_UUID_LS_KEY);

  if (!uuid) {
    uuid = uuidv4();
    localStorage.setItem(DEVICE_UUID_LS_KEY, uuid);
  }

  return uuid;
}

/**
 * デバイス名を取得
 * デフォルト: ブラウザ・OS から推定
 */
export function getDeviceName(): string {
  const saved = localStorage.getItem(DEVICE_NAME_LS_KEY);
  if (saved) return saved;

  // Infer from userAgent
  const ua = navigator.userAgent;
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android Device';
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows PC';

  return 'Unknown Device';
}

/**
 * デバイス名をカスタマイズ（SettingsPage から）
 */
export function setDeviceName(name: string): void {
  if (name.length < 1 || name.length > 32) {
    throw new Error('Device name must be 1-32 characters');
  }
  localStorage.setItem(DEVICE_NAME_LS_KEY, name);
}

// ─── Device Metadata ──────────────────────────────────────────────────────

/**
 * このデバイスのメタデータを取得
 */
export function getDeviceMetadata(): DeviceMetadata {
  const ua = navigator.userAgent;

  let os = 'Unknown';
  let type: 'mobile' | 'desktop' = 'desktop';

  if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
    type = ua.includes('iPhone') ? 'mobile' : 'desktop';
  } else if (ua.includes('Android')) {
    os = 'Android';
    type = 'mobile';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
    type = 'desktop';
  } else if (ua.includes('Windows')) {
    os = 'Windows';
    type = 'desktop';
  }

  return {
    uuid: getOrCreateDeviceUUID(),
    name: getDeviceName(),
    os,
    type,
    pairedAt: new Date().toISOString(),
  };
}

// ─── Device Pairing State ─────────────────────────────────────────────────

/**
 * Paired devices を localStorage に保存
 * （Supabase にも保存されるが、ローカルキャッシュとして使用）
 */
export function savePairedDevice(device: PairedDevice): void {
  const pairedDevices = getPairedDevices();
  const index = pairedDevices.findIndex((d) => d.uuid === device.uuid);

  if (index >= 0) {
    pairedDevices[index] = device;
  } else {
    pairedDevices.push(device);
  }

  localStorage.setItem('paired_devices', JSON.stringify(pairedDevices));
}

/**
 * ローカルキャッシュから paired devices を取得
 */
export function getPairedDevices(): PairedDevice[] {
  const cached = localStorage.getItem('paired_devices');
  return cached ? JSON.parse(cached) : [];
}

/**
 * デバイスのペアリングを削除
 */
export function removePairedDevice(uuid: string): void {
  const devices = getPairedDevices();
  const filtered = devices.filter((d) => d.uuid !== uuid);
  localStorage.setItem('paired_devices', JSON.stringify(filtered));
}

// ─── Pairing Session State ────────────────────────────────────────────────

const PAIRING_SESSION_LS_KEY = 'pairing_session';

export interface PairingSession {
  sessionId: string;
  initiatorUUID: string;
  initiatorPublicKey: string; // RSA-2048 PEM (Base64)
  createdAt: string;
  expiresAt: string;
}

/**
 * ペアリングセッションを開始
 * (Device A が QR を生成する際に）
 */
export function createPairingSession(publicKeyPEM: string): PairingSession {
  const session: PairingSession = {
    sessionId: crypto.randomUUID(),
    initiatorUUID: getOrCreateDeviceUUID(),
    initiatorPublicKey: publicKeyPEM,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
  };

  localStorage.setItem(PAIRING_SESSION_LS_KEY, JSON.stringify(session));
  return session;
}

/**
 * ペアリングセッションを取得
 */
export function getPairingSession(): PairingSession | null {
  const cached = localStorage.getItem(PAIRING_SESSION_LS_KEY);
  if (!cached) return null;

  const session: PairingSession = JSON.parse(cached);

  // チェック: 有効期限確認
  if (new Date() > new Date(session.expiresAt)) {
    localStorage.removeItem(PAIRING_SESSION_LS_KEY);
    return null;
  }

  return session;
}

/**
 * ペアリングセッションをクリア
 */
export function clearPairingSession(): void {
  localStorage.removeItem(PAIRING_SESSION_LS_KEY);
}

/**
 * Phase 7-1 実装チェックリスト:
 *
 * [ ] Device UUID の初回生成とキャッシュ確認
 * [ ] Device metadata の推定ロジック (iOS/Android/Mac/Windows判定)
 * [ ] Supabase `paired_devices` テーブル作成
 * [ ] DevicePairingModal.tsx で createPairingSession() 呼び出し
 * [ ] DeviceList.tsx で getPairedDevices() + removePairedDevice() 呼び出し
 * [ ] セッション有効期限（5分）の動作確認
 */
