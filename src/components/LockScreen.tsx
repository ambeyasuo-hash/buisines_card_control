'use client';

/**
 * Lock Screen Component
 *
 * Phase 6-6: WebAuthn + PIN Fallback Integration
 *
 * 表示条件: SessionState === 'LOCKED'
 *
 * UI:
 *   - WebAuthn対応: 「認証」ボタン → FaceID/指紋プロンプト
 *   - PIN Fallback: PIN pad（4～8桁）
 *   - 代替: 「リカバリキーで復旧」リンク（緊急時）
 *
 * フォールバック自動切り替え:
 *   - WebAuthn がハードウェア的に利用不可 → 自動的に PIN mode に切り替え
 *   - WebAuthn 認証失敗 → PIN での再認証を提案
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertTriangle, Keyboard } from 'lucide-react';
import { validatePINStrength } from '@/lib/crypto';
import { isWebAuthnSupported, isWebAuthnEnabled } from '@/lib/webauthn';

interface LockScreenProps {
  onAuthenticateWebAuthn: () => Promise<boolean>;
  onAuthenticatePIN: (pin: string) => Promise<boolean>;
  onShowRecovery?: () => void;
  onResetSession?: () => void;
  isAuthenticating?: boolean;
  error?: string;
  supportsPIN?: boolean;
}

export function LockScreen({
  onAuthenticateWebAuthn,
  onAuthenticatePIN,
  onShowRecovery,
  onResetSession,
  isAuthenticating = false,
  error,
  supportsPIN = true,
}: LockScreenProps) {
  const [localError, setLocalError] = useState<string | null>(error || null);
  const [pin, setPin] = useState('');
  const pinValidation = validatePINStrength(pin);

  // WebAuthn サポート状態を判定（クライアント側のみで実行）
  const [supportsWebAuthn, setSupportsWebAuthn] = useState(true);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(true);
  const [mode, setMode] = useState<'webauthn' | 'pin'>('webauthn');
  const [webAuthnFailed, setWebAuthnFailed] = useState(false);

  // クライアント側で WebAuthn サポート状態を確認
  useEffect(() => {
    const supports = isWebAuthnSupported();
    const enabled = isWebAuthnEnabled();

    setSupportsWebAuthn(supports);
    setWebAuthnEnabled(enabled);

    // WebAuthn が利用不可な場合、自動的に PIN mode に切り替え
    if (!supports || !enabled) {
      setMode('pin');
    }
  }, []);

  const handleWebAuthnClick = async () => {
    setLocalError(null);
    setWebAuthnFailed(false);

    const success = await onAuthenticateWebAuthn();
    if (!success) {
      setWebAuthnFailed(true);

      // WebAuthn 失敗時：PIN への自動切り替えを提案（supportsPIN が有効な場合）
      if (supportsPIN) {
        setLocalError('生体認証に失敗しました。PIN での認証をお試しください。');
        setMode('pin');
        setPin('');
      } else {
        setLocalError('認証に失敗しました。もう一度お試しください。');
      }
    }
  };

  const handlePINSubmit = async () => {
    if (!pinValidation.valid) {
      setLocalError(pinValidation.message);
      return;
    }

    setLocalError(null);
    const success = await onAuthenticatePIN(pin);
    if (!success) {
      setLocalError('PIN が正しくありません。もう一度お試しください。');
      setPin('');
    }
  };

  const handlePINKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePINSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50 p-6"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                     w-64 h-64 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full blur-3xl"
        />
      </div>

      {/* Content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="relative z-10 flex flex-col items-center gap-6 max-w-sm"
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: isAuthenticating ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          className="flex h-24 w-24 items-center justify-center rounded-full
                     bg-gradient-to-br from-blue-500/20 to-cyan-500/20
                     border border-blue-500/30"
        >
          <Lock className="h-12 w-12 text-blue-400" />
        </motion.div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {mode === 'webauthn' ? '生体認証で保護されています' : 'PIN で保護されています'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'webauthn'
              ? '顔認証または指紋認証で解除してください'
              : 'PIN を入力してください'}
          </p>
        </div>

        {/* Error Message */}
        {(localError || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300">{localError || error}</p>
            </div>
          </motion.div>
        )}

        {/* Security Configuration Error */}
        {!supportsWebAuthn && !supportsPIN && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300 mb-3">
                認証情報が登録されていません。再セットアップしてください。
              </p>
              {onResetSession && (
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onResetSession}
                  className="text-xs px-3 py-2 rounded-lg bg-red-500/30 hover:bg-red-500/50
                             text-red-200 font-medium transition-colors duration-200
                             border border-red-500/50"
                >
                  セットアップをリセット
                </motion.button>
              )}
            </div>
          </motion.div>
        )}

        {/* WebAuthn Mode */}
        {mode === 'webauthn' && (
          <>
            {/* WebAuthn サポート状態の警告 */}
            {!supportsWebAuthn && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-3"
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  このデバイスは生体認証に対応していません。PIN をご使用ください。
                </p>
              </motion.div>
            )}

            {!webAuthnEnabled && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-start gap-3"
              >
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  生体認証がセットアップされていません。PIN をご使用ください。
                </p>
              </motion.div>
            )}

            <motion.button
              whileHover={supportsWebAuthn && webAuthnEnabled ? { scale: 1.02, y: -2 } : {}}
              whileTap={supportsWebAuthn && webAuthnEnabled ? { scale: 0.98 } : {}}
              onClick={handleWebAuthnClick}
              disabled={isAuthenticating || !supportsWebAuthn || !webAuthnEnabled}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white
                         font-semibold py-4 rounded-xl transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:from-blue-600 hover:to-cyan-500 shadow-lg shadow-blue-500/20"
            >
              {isAuthenticating ? '認証中...' : '認証'}
            </motion.button>

            {supportsPIN && (
              <button
                onClick={() => {
                  setMode('pin');
                  setLocalError(null);
                  setPin('');
                  setWebAuthnFailed(false);
                }}
                className="text-sm text-muted-foreground hover:text-foreground
                           flex items-center gap-1 underline transition-colors duration-200"
              >
                <Keyboard className="w-3 h-3" />
                PIN を使用
              </button>
            )}
          </>
        )}

        {/* PIN Mode */}
        {mode === 'pin' && (
          <>
            <div className="w-full space-y-3">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  const newPin = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setPin(newPin);
                  setLocalError(null);
                }}
                onKeyDown={handlePINKeyDown}
                placeholder="••••"
                maxLength={8}
                autoFocus
                className="w-full text-center text-4xl tracking-widest font-mono
                           border border-blue-500/30 bg-white/5 rounded-xl p-4
                           text-foreground placeholder:text-muted-foreground
                           focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none"
              />

              {pin && (
                <p
                  className={`text-xs ${
                    pinValidation.valid ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {pinValidation.message}
                </p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePINSubmit}
              disabled={isAuthenticating || !pinValidation.valid}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white
                         font-semibold py-4 rounded-xl transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:from-emerald-600 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
            >
              {isAuthenticating ? '認証中...' : '認証'}
            </motion.button>

            <button
              onClick={() => {
                setMode('webauthn');
                setLocalError(null);
                setPin('');
              }}
              className="text-sm text-muted-foreground hover:text-foreground
                         underline transition-colors duration-200"
            >
              ← 戻る
            </button>
          </>
        )}

        {/* Recovery & Reset Options */}
        <div className="flex flex-col items-center gap-2 mt-2">
          <motion.button
            whileHover={{ opacity: 0.8 }}
            onClick={onShowRecovery}
            className="text-sm text-muted-foreground hover:text-foreground
                       underline transition-colors duration-200"
          >
            リカバリキーで復旧
          </motion.button>

          {onResetSession && (
            <motion.button
              whileHover={{ opacity: 0.8 }}
              onClick={onResetSession}
              className="text-xs text-red-400 hover:text-red-300
                         underline transition-colors duration-200"
            >
              セットアップをリセット
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Footer Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-8 text-center text-xs text-muted-foreground"
      >
        <p>あんべ ～ Zero-Knowledge 名刺管理</p>
      </motion.div>
    </motion.div>
  );
}
