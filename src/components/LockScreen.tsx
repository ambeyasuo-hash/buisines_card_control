'use client';

/**
 * Lock Screen Component
 *
 * Phase 6-6: WebAuthn + PIN Fallback Integration
 * Phase 7:   Mnemonic Recovery (Emergency Bypass)
 *
 * 表示条件: SessionState === 'LOCKED'
 *
 * UI:
 *   - WebAuthn対応: 「認証」ボタン → FaceID/指紋プロンプト
 *   - PIN Fallback: PIN pad（4～8桁）
 *   - Recovery: 24単語のリカバリフレーズ入力（緊急時）
 *
 * フォールバック自動切り替え:
 *   - WebAuthn がハードウェア的に利用不可 → 自動的に PIN mode に切り替え
 *   - WebAuthn 認証失敗 → PIN での再認証を提案
 *
 * Zero-Knowledge 原則:
 *   - リカバリフレーズはクライアント側のみで処理
 *   - 復元されたキーは localStorage のみに保存（サーバー非送信）
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertTriangle, Keyboard, FileText, Loader, Check } from 'lucide-react';
import { validatePINStrength, deriveMasterKeyFromMnemonic, exportKeyAsBase64, ENCRYPTION_LS_KEY } from '@/lib/crypto';
import { isValidMnemonic } from '@/lib/mnemonic';
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

  const [supportsWebAuthn, setSupportsWebAuthn] = useState(true);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(true);
  const [mode, setMode] = useState<'webauthn' | 'pin' | 'recovery'>('webauthn');
  const [webAuthnFailed, setWebAuthnFailed] = useState(false);

  // ── Recovery state ────────────────────────────────────────────────────────
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  useEffect(() => {
    const supports = isWebAuthnSupported();
    const enabled = isWebAuthnEnabled();
    setSupportsWebAuthn(supports);
    setWebAuthnEnabled(enabled);
    if (!supports || !enabled) {
      setMode('pin');
    }
  }, []);

  const handleWebAuthnClick = async () => {
    setLocalError(null);
    setWebAuthnFailed(false);
    try {
      const success = await onAuthenticateWebAuthn();
      if (!success) {
        setWebAuthnFailed(true);
        if (supportsPIN) {
          setLocalError('生体認証に失敗しました。PIN での認証をお試しください。');
          setMode('pin');
          setPin('');
        } else {
          setLocalError('認証に失敗しました。もう一度お試しください。');
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setWebAuthnFailed(true);
      if (
        errorMessage.includes('NotAllowedError') ||
        errorMessage.includes('NotAllowed') ||
        errorMessage.includes('TimeoutError') ||
        errorMessage.includes('Timeout')
      ) {
        if (supportsPIN) {
          setLocalError('生体認証がキャンセル/タイムアウトしました。PIN での認証をお試しください。');
          setMode('pin');
          setPin('');
        } else {
          setLocalError('生体認証がキャンセルされました。');
        }
      } else {
        if (supportsPIN) {
          setLocalError('生体認証に失敗しました。PIN での認証をお試しください。');
          setMode('pin');
          setPin('');
        } else {
          setLocalError('認証に失敗しました。もう一度お試しください。');
        }
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

  // ── Recovery handler ───────────────────────────────────────────────────────
  const handleRecovery = async () => {
    const normalized = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    const wordCount = normalized.split(' ').filter(Boolean).length;
    if (wordCount !== 24) {
      setRecoveryError(`24単語が必要です（現在: ${wordCount}単語）`);
      return;
    }
    if (!isValidMnemonic(normalized)) {
      setRecoveryError('リカバリフレーズが正しくありません。単語を確認してください（チェックサムエラー）。');
      return;
    }

    try {
      setIsRecovering(true);
      setRecoveryError(null);

      // 1. Derive master key from mnemonic (client-only, Zero-Knowledge)
      const masterKey = await deriveMasterKeyFromMnemonic(normalized);

      // 2. Persist raw key to localStorage (existing design)
      const keyB64 = await exportKeyAsBase64(masterKey);
      localStorage.setItem(ENCRYPTION_LS_KEY, keyB64);

      // 3. Clear old auth registrations so user re-registers PIN/WebAuthn
      localStorage.removeItem('encryption_key_wrapped_b64');
      localStorage.removeItem('pin_enabled');
      localStorage.removeItem('webauthn_enabled');
      localStorage.removeItem('mnemonic_backed_up'); // Show backup phrase again

      setRecoverySuccess(true);

      // 4. Reload after brief success display — no security config → UNLOCKED + setup prompt
      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err) {
      setRecoveryError(
        err instanceof Error ? err.message : 'リカバリに失敗しました。フレーズを確認してください。'
      );
    } finally {
      setIsRecovering(false);
    }
  };

  const recoveryWordCount = recoveryPhrase.trim().split(/\s+/).filter(Boolean).length;
  const recoveryReady = recoveryWordCount === 24 && !isRecovering && !recoverySuccess;

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
        className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full"
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: isAuthenticating ? 1.1 : 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10 }}
          className={`flex h-24 w-24 items-center justify-center rounded-full border ${
            mode === 'recovery'
              ? 'bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/30'
              : 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30'
          }`}
        >
          {mode === 'recovery' ? (
            <FileText className="h-12 w-12 text-purple-400" />
          ) : (
            <Lock className="h-12 w-12 text-blue-400" />
          )}
        </motion.div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {mode === 'recovery'
              ? 'リカバリフレーズで復元'
              : mode === 'webauthn'
              ? '生体認証で保護されています'
              : 'PIN で保護されています'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'recovery'
              ? '24単語を入力してマスターキーを復元します'
              : mode === 'webauthn'
              ? '顔認証または指紋認証で解除してください'
              : 'PIN を入力してください'}
          </p>
        </div>

        {/* Error Message */}
        {(localError || error) && mode !== 'recovery' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{localError || error}</p>
          </motion.div>
        )}

        {/* Security Configuration Error */}
        {!supportsWebAuthn && !supportsPIN && mode !== 'recovery' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300 mb-3">
                認証情報が登録されていません。リカバリフレーズを使用してください。
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

        {/* ── WebAuthn Mode ───────────────────────────────────────────────── */}
        {mode === 'webauthn' && (
          <>
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
                onClick={() => { setMode('pin'); setLocalError(null); setPin(''); setWebAuthnFailed(false); }}
                className="text-sm text-blue-400 hover:text-blue-300
                           flex items-center gap-2 underline transition-colors duration-200"
              >
                <Keyboard className="w-4 h-4" />
                生体認証が使えませんか？ PIN でログイン
              </button>
            )}
          </>
        )}

        {/* ── PIN Mode ────────────────────────────────────────────────────── */}
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
                <p className={`text-xs ${pinValidation.valid ? 'text-emerald-400' : 'text-amber-400'}`}>
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

            {supportsWebAuthn && webAuthnEnabled && (
              <button
                onClick={() => { setMode('webauthn'); setLocalError(null); setPin(''); }}
                className="text-sm text-muted-foreground hover:text-foreground
                           flex items-center gap-2 underline transition-colors duration-200"
              >
                ← 生体認証に戻る
              </button>
            )}
          </>
        )}

        {/* ── Recovery Mode ───────────────────────────────────────────────── */}
        {mode === 'recovery' && (
          <div className="w-full space-y-4">
            {/* Critical warning */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                復元後、PIN/生体認証の再登録が必要です。
                フレーズはサーバーに送信されません（Zero-Knowledge 原則）。
              </p>
            </div>

            {/* Mnemonic textarea */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/70">
                24単語のリカバリフレーズ（スペース区切り）
              </label>
              <textarea
                value={recoveryPhrase}
                onChange={(e) => {
                  setRecoveryPhrase(e.target.value);
                  setRecoveryError(null);
                }}
                disabled={isRecovering || recoverySuccess}
                placeholder="apple banana cat dog ..."
                rows={4}
                className="w-full bg-white/5 border border-white/20 rounded-xl p-3
                           text-sm text-white placeholder:text-white/30
                           focus:border-purple-500/50 outline-none resize-none font-mono
                           disabled:opacity-50"
              />
              <p className={`text-xs ${recoveryWordCount === 24 ? 'text-emerald-400' : 'text-white/40'}`}>
                {recoveryWordCount} / 24 単語
                {recoveryWordCount === 24 && ' ✓'}
              </p>
            </div>

            {/* Recovery error */}
            {recoveryError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{recoveryError}</p>
              </motion.div>
            )}

            {/* Recovery success */}
            {recoverySuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-300">
                  マスターキーを復元しました。再セットアップ画面に移動します…
                </p>
              </motion.div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <motion.button
                whileHover={recoveryReady ? { scale: 1.02, y: -2 } : {}}
                whileTap={recoveryReady ? { scale: 0.98 } : {}}
                onClick={handleRecovery}
                disabled={!recoveryReady}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-400 text-white
                           font-semibold py-3 rounded-xl transition-all duration-300
                           disabled:opacity-50 disabled:cursor-not-allowed
                           hover:from-purple-600 hover:to-violet-500"
              >
                {isRecovering ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    復元中...
                  </span>
                ) : recoverySuccess ? (
                  '復元完了'
                ) : (
                  'マスターキーを復元'
                )}
              </motion.button>

              {!recoverySuccess && (
                <motion.button
                  whileHover={{ opacity: 0.8 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode(supportsWebAuthn && webAuthnEnabled ? 'webauthn' : 'pin');
                    setRecoveryPhrase('');
                    setRecoveryError(null);
                  }}
                  disabled={isRecovering}
                  className="px-4 py-3 rounded-xl border border-slate-500/30 text-slate-400
                             hover:text-white hover:border-slate-500/50 transition-colors duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  戻る
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* ── Bottom links (always visible) ───────────────────────────────── */}
        {mode !== 'recovery' && (
          <div className="flex flex-col items-center gap-2 mt-4 pt-4 border-t border-white/10">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setMode('recovery');
                setLocalError(null);
                setRecoveryPhrase('');
                setRecoveryError(null);
                setRecoverySuccess(false);
                onShowRecovery?.();
              }}
              className="text-sm font-semibold text-blue-300 hover:text-blue-200
                         flex items-center gap-1.5 underline transition-colors duration-200"
            >
              <FileText className="w-4 h-4" />
              🔑 鍵を紛失しましたか？ リカバリフレーズで復元
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
        )}
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
