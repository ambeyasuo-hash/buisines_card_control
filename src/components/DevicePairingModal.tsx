'use client';

/**
 * Device Pairing Modal
 *
 * Phase 7-1: Multi-Device Sync
 *
 * Flow:
 *   1. Device A (Initiator) generates RSA-2048 key pair
 *   2. Device A displays QR code with public key + metadata
 *   3. Device B (Responder) scans QR
 *   4. Device B extracts Device A's public key
 *   5. Device B sends master key (RSA-wrapped) to Supabase
 *   6. Device A polls and receives master key
 *
 * UX:
 *   - 「端末同士の鍵を安全に受け渡します」（技術用語隠蔽）
 *   - QR コードの有効期限: 5 分
 *   - キャンセル: ペアリングセッションクリア
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, Loader, Check, AlertTriangle, X } from 'lucide-react';
import { generateRSAKeyPair } from '@/lib/e2ee-keytransfer';
import { generateQRCode, type QRPayload } from '@/lib/qr-generator';
import {
  getOrCreateDeviceUUID,
  getDeviceName,
  createPairingSession,
} from '@/lib/device-pairing';

type PairingStep = 'init' | 'qr-display' | 'waiting' | 'success' | 'error';

interface DevicePairingModalProps {
  onClose: () => void;
  onPairingComplete?: (pairedDeviceUUID: string) => void;
}

export function DevicePairingModal({
  onClose,
  onPairingComplete,
}: DevicePairingModalProps) {
  const [step, setStep] = useState<PairingStep>('init');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize pairing session
  useEffect(() => {
    if (step === 'init') {
      initializePairing();
    }
  }, [step]);

  const initializePairing = async () => {
    try {
      setError(null);

      // Step 1: Generate RSA-2048 key pair
      const { publicKeyPEM, privateKey: privKey } = await generateRSAKeyPair();
      setPrivateKey(privKey);

      // Step 2: Get device metadata
      const deviceUUID = getOrCreateDeviceUUID();
      const deviceName = getDeviceName();

      // Step 3: Create QR payload
      const payload: QRPayload = {
        version: 1,
        deviceUUID,
        deviceName,
        publicKey: publicKeyPEM,
        timestamp: Date.now(),
      };

      // Step 4: Generate QR code
      const qrDataUrl = await generateQRCode(payload);
      setQrCode(qrDataUrl);

      // Step 5: Create pairing session
      const session = createPairingSession(publicKeyPEM);
      setSessionId(session.sessionId);

      // Transition to QR display
      setStep('qr-display');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ペアリング初期化に失敗しました';
      setError(message);
      setStep('error');
    }
  };

  const handleStartWaiting = () => {
    setStep('waiting');
    // TODO: Implement polling logic to check for incoming master key
    // Poll Supabase `handshake_transfers` table for this session
  };

  const handleRetry = () => {
    setQrCode(null);
    setError(null);
    setStep('init');
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-slate-700 p-6 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">端末をペアリング</h2>
          <button
            onClick={handleCancel}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {step === 'init' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">
                複数のデバイスであんべを使う場合、端末同士で鍵を安全に受け渡します。
              </p>
              <button
                onClick={() => setStep('qr-display')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                次へ
              </button>
            </div>
          )}

          {step === 'qr-display' && qrCode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-sm text-slate-300 text-center">
                別の端末のカメラでこの QR コードをスキャンしてください
              </p>

              {/* QR Code Display */}
              <div className="bg-white p-4 rounded-lg flex justify-center">
                <img
                  src={qrCode}
                  alt="Device Pairing QR Code"
                  className="w-64 h-64"
                />
              </div>

              <p className="text-xs text-slate-400 text-center">
                QR コードの有効期限: 5 分
              </p>

              <button
                onClick={handleStartWaiting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                スキャンしました
              </button>

              <button
                onClick={handleCancel}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors text-sm"
              >
                キャンセル
              </button>
            </motion.div>
          )}

          {step === 'waiting' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 py-6 flex flex-col items-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Loader className="w-8 h-8 text-blue-400" />
              </motion.div>

              <p className="text-sm text-slate-300 text-center">
                マスターキーを受け取り中...
              </p>

              <div className="text-xs text-slate-400 space-y-1 text-center">
                <p>別の端末で QR コードをスキャンしてください</p>
                <p>タイムアウト: 5 分</p>
              </div>

              <button
                onClick={handleCancel}
                className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors text-sm"
              >
                キャンセル
              </button>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4 py-6 flex flex-col items-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>

              <p className="text-sm text-slate-300 text-center">
                ペアリング完了！
              </p>

              <p className="text-xs text-slate-400 text-center">
                これからは 2 つの端末でデータが自動で同期されます
              </p>

              <button
                onClick={handleCancel}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                閉じる
              </button>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-300 font-semibold">エラーが発生しました</p>
                  <p className="text-xs text-red-400 mt-1">{error}</p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  もう一度試す
                </button>

                <button
                  onClick={handleCancel}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors text-sm"
                >
                  キャンセル
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
