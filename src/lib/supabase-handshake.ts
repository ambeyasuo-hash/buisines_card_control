/**
 * Supabase Handshake Transfer
 *
 * Phase 7-2: E2EE Master Key Transfer Protocol
 *
 * Protocol:
 *   Device B (Responder):
 *     1. Scans QR code → extracts Device A's public key + session_id
 *     2. Gets current master key (from UNLOCKED state)
 *     3. Calls transferMasterKeyToDevice() → RSA-wrap + AES-wrap
 *     4. POSTs { session_id, wrapped_session_key, wrapped_master_key } to handshake_transfers
 *
 *   Device A (Initiator):
 *     1. Polls handshake_transfers for pending session_id
 *     2. Extracts { wrapped_session_key, wrapped_master_key }
 *     3. Calls receiveMasterKeyFromDevice() with own RSA private key
 *     4. Unwraps → imports master key → stores in session memory
 *
 * Zero-Knowledge:
 *   - RSA private keys never leave device memory (export: false)
 *   - Master key is only in memory (UNLOCKED state)
 *   - Supabase only sees encrypted data
 */

import {
  transferMasterKeyToDevice,
  receiveMasterKeyFromDevice,
} from '@/lib/e2ee-keytransfer';
import { createSupabaseClient } from '@/lib/supabase-client';
import { type QRPayload } from '@/lib/qr-generator';
import { getOrCreateDeviceUUID } from '@/lib/device-pairing';

// ─── Responder Side (Master Key Sender) ────────────────────────────────────

/**
 * Device B (Responder) が QR をスキャンして、Device A へマスターキーを送信
 *
 * @param qrPayload Parsed QR code (Device A's public key, session_id, etc.)
 * @param masterKeyB64 Current master key (Base64) from session memory
 * @returns true if transfer successful, false otherwise
 */
export async function sendMasterKeyToInitiator(
  qrPayload: QRPayload,
  masterKeyB64: string
): Promise<boolean> {
  try {
    console.log('[Handshake] Responder: Preparing master key transfer...');

    // Step 1: Transfer (RSA wrap + AES wrap)
    const { wrappedSessionKey, wrappedMasterKey } = await transferMasterKeyToDevice(
      masterKeyB64,
      qrPayload.publicKey
    );

    console.log('[Handshake] Responder: Master key wrapped successfully');

    // Step 2: Get Responder device UUID
    const responderUUID = getOrCreateDeviceUUID();

    // Step 3: POST to Supabase
    const supabase = createSupabaseClient();

    // Generate a session ID (use payload timestamp + device UUID for uniqueness)
    const handshakeSessionId = `${qrPayload.timestamp}-${responderUUID}`;

    const { error } = await supabase.from('handshake_transfers').insert({
      session_id: qrPayload.timestamp, // Use QR timestamp as session identifier
      initiator_device_uuid: qrPayload.deviceUUID,
      responder_device_uuid: responderUUID,
      wrapped_session_key: wrappedSessionKey,
      wrapped_master_key: wrappedMasterKey,
      status: 'pending',
    });

    if (error) {
      console.error('[Handshake] Responder: Supabase insert error:', error);
      throw error;
    }

    console.log('[Handshake] Responder: Master key sent to Supabase');
    return true;
  } catch (err) {
    console.error('[Handshake] Responder: Transfer failed:', err);
    return false;
  }
}

// ─── Initiator Side (Master Key Receiver) ──────────────────────────────────

/**
 * Device A (Initiator) がペアリング session を待機し、Device B からマスターキーを受け取る
 *
 * @param sessionId QR code timestamp (session identifier)
 * @param privateKey RSA private key (from memory, not exported)
 * @param timeoutMs Polling timeout (default: 5 min)
 * @returns Unwrapped CryptoKey (master key) or null
 */
export async function receiveMasterKeyFromResponder(
  sessionId: number, // QR timestamp
  privateKey: CryptoKey,
  timeoutMs: number = 5 * 60 * 1000
): Promise<CryptoKey | null> {
  try {
    console.log('[Handshake] Initiator: Waiting for master key from responder...');

    const supabase = createSupabaseClient();

    const initiatorUUID = getOrCreateDeviceUUID();
    const startTime = Date.now();

    // Poll with exponential backoff (100ms → 2s max)
    let pollInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      // Query for pending handshake matching this session
      const { data, error } = await supabase
        .from('handshake_transfers')
        .select('*')
        .eq('session_id', sessionId)
        .eq('initiator_device_uuid', initiatorUUID)
        .eq('status', 'pending')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (not an error)
        console.warn('[Handshake] Initiator: Query error:', error);
      }

      if (data) {
        console.log('[Handshake] Initiator: Handshake transfer found!');

        // Step 1: Receive (RSA unwrap + AES unwrap)
        const masterKey = await receiveMasterKeyFromDevice(
          data.wrapped_session_key,
          data.wrapped_master_key,
          privateKey
        );

        if (masterKey) {
          console.log('[Handshake] Initiator: Master key unwrapped successfully');

          // Step 2: Update status to acknowledged
          await supabase
            .from('handshake_transfers')
            .update({ status: 'acknowledged' })
            .eq('id', data.id);

          return masterKey;
        } else {
          console.error('[Handshake] Initiator: Failed to unwrap master key');
          return null;
        }
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      // Exponential backoff: max 2s
      if (pollInterval < 2000) {
        pollInterval = Math.min(pollInterval * 1.5, 2000);
      }
    }

    console.warn('[Handshake] Initiator: Timeout waiting for master key');
    return null;
  } catch (err) {
    console.error('[Handshake] Initiator: Receive failed:', err);
    return null;
  }
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * ペアリング session をクリア（キャンセル時）
 * Supabase の handshake_transfers から pending entries を削除
 */
export async function cancelHandshakeSession(sessionId: number): Promise<void> {
  try {
    const supabase = createSupabaseClient();

    await supabase
      .from('handshake_transfers')
      .update({ status: 'expired' })
      .eq('session_id', sessionId)
      .eq('status', 'pending');

    console.log('[Handshake] Session cancelled');
  } catch (err) {
    console.error('[Handshake] Cancel error:', err);
  }
}

/**
 * Phase 7-2 実装チェックリスト:
 *
 * [x] sendMasterKeyToInitiator() — Device B が master key を送信 ✅
 * [x] receiveMasterKeyFromResponder() — Device A が master key を受け取り ✅
 * [x] Polling with exponential backoff — 5 分のタイムアウト ✅
 * [ ] Supabase handshake_transfers テーブル作成済みか確認
 * [ ] Device B の DevicePairingModal で sendMasterKeyToInitiator() 呼び出し
 * [ ] Device A の DevicePairingModal で receiveMasterKeyFromResponder() 呼び出し
 * [ ] E2E: Device A → Device B マスターキー転送の動作確認
 * [ ] エラーハンドリング: タイムアウト → graceful error message
 * [ ] Supabase RLS: anonymous access properly configured
 */
