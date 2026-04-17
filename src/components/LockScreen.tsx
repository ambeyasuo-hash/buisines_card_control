'use client';

/**
 * Lock Screen Component — Phase 9 (顔認証ファースト)
 *
 * モード:
 *   biometric  … platform 認証を自動起動（デフォルト）
 *   recovery   … 24単語フレーズ入力（緊急時）
 *
 * 生体認証失敗時のみ「リカバリフレーズを使用」リンクを表示。
 *
 * Zero-Knowledge 原則:
 *   - リカバリフレーズはクライアント側のみで処理
 *   - 復元されたキーは localStorage のみに保存（サーバー非送信）
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Lock, AlertTriangle, FileText, Loader, Check } from 'lucide-react';
import {
  deriveMasterKeyFromMnemonic,
  exportKeyAsBase64,
  ENCRYPTION_LS_KEY,
} from '@/lib/crypto';
import { deriveWrappingKeyFromMnemonic, loadVaultFromSupabase, unwrapDataKey } from '@/lib/vault';
import { isValidMnemonic } from '@/lib/mnemonic';
import { isWebAuthnSupported, isWebAuthnEnabled } from '@/lib/webauthn';

interface LockScreenProps {
  onAuthenticateWebAuthn: () => Promise<boolean>;
  isAuthenticating?: boolean;
  error?: string;
  onResetSession?: () => void;
}

export function LockScreen({
  onAuthenticateWebAuthn,
  isAuthenticating = false,
  error,
  onResetSession,
}: LockScreenProps) {
  const [mode, setMode] = useState<'biometric' | 'recovery'>('biometric');
  const [localError, setLocalError] = useState<string | null>(error || null);
  const [authFailed, setAuthFailed] = useState(false);

  // ── Recovery state ────────────────────────────────────────────────────────
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  // マウント時に platform 認証を自動起動
  useEffect(() => {
    if (!isWebAuthnSupported() || !isWebAuthnEnabled()) return;
    triggerBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerBiometric = async () => {
    setLocalError(null);
    setAuthFailed(false);
    try {
      const success = await onAuthenticateWebAuthn();
      if (!success) {
        setAuthFailed(true);
        setLocalError('生体認証に失敗しました。');
      }
    } catch (e) {
      setAuthFailed(true);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('NotAllowed') || msg.includes('Timeout')) {
        setLocalError('生体認証がキャンセル / タイムアウトしました。');
      } else {
        setLocalError('生体認証に失敗しました。');
      }
    }
  };

  // ── Recovery ───────────────────────────────────────────────────────────────
  const handleRecovery = async () => {
    const normalized = recoveryPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
    const wordCount = normalized.split(' ').filter(Boolean).length;
    if (wordCount !== 24) {
      setRecoveryError(`24単語が必要です（現在: ${wordCount}単語）`);
      return;
    }
    if (!isValidMnemonic(normalized)) {
      setRecoveryError('リカバリフレーズが正しくありません（チェックサムエラー）。');
      return;
    }

    try {
      setIsRecovering(true);
      setRecoveryError(null);

      // Vault 経由で Data Key を復元（Supabase に wrapped_data_key_beta がある場合）
      const encryptionSalt = localStorage.getItem('encryption_salt');
      let restored = false;

      if (encryptionSalt) {
        try {
          const vault = await loadVaultFromSupabase(encryptionSalt);
          if (vault?.wrapped_data_key_beta) {
            const wrappingKeyBeta = await deriveWrappingKeyFromMnemonic(normalized);
            const dataKey = await unwrapDataKey(vault.wrapped_data_key_beta, wrappingKeyBeta);
            const keyB64 = await exportKeyAsBase64(dataKey);
            localStorage.setItem(ENCRYPTION_LS_KEY, keyB64);
            restored = true;
          }
        } catch {
          // Vault 復元失敗 → 旧来の直接復元にフォールバック
        }
      }

      if (!restored) {
        // フォールバック: mnemonic から Data Key を直接導出（旧設計互換）
        const masterKey = await deriveMasterKeyFromMnemonic(normalized);
        const keyB64 = await exportKeyAsBase64(masterKey);
        localStorage.setItem(ENCRYPTION_LS_KEY, keyB64);
      }

      // WebAuthn / PIN の再登録を促す
      localStorage.removeItem('encryption_key_wrapped_b64');
      localStorage.removeItem('pin_enabled');
      localStorage.removeItem('webauthn_enabled');
      localStorage.removeItem('mnemonic_backed_up');

      setRecoverySuccess(true);
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      setRecoveryError(
        err instanceof Error ? err.message : 'リカバリに失敗しました。フレーズを確認してください。',
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
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                     w-64 h-64 rounded-full blur-3xl ${
                       mode === 'recovery'
                         ? 'bg-gradient-to-r from-purple-500/30 to-violet-500/30'
                         : 'bg-gradient-to-r from-blue-500/30 to-cyan-500/30'
                     }`}
        />
      </div>

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
            {mode === 'recovery' ? 'リカバリフレーズで復元' : '生体認証で保護されています'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'recovery'
              ? '24単語を入力してデータキーを復元します'
              : '顔認証または指紋認証で解除してください'}
          </p>
        </div>

        {/* Error */}
        {(localError || error) && mode === 'biometric' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{localError || error}</p>
          </motion.div>
        )}

        {/* ── Biometric Mode ───────────────────────────────────────────────── */}
        {mode === 'biometric' && (
          <>
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={triggerBiometric}
              disabled={isAuthenticating}
              className="w-full bg-gradient-to-r from-blue-500 to-cyan-400 text-white
                         font-semibold py-4 rounded-xl transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:from-blue-600 hover:to-cyan-500 shadow-lg shadow-blue-500/20"
            >
              {isAuthenticating ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  認証中...
                </span>
              ) : '認証'}
            </motion.button>

            {/* リカバリリンク: 失敗後のみ表示 */}
            {authFailed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2 mt-2 pt-4 border-t border-white/10 w-full"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode('recovery');
                    setLocalError(null);
                    setRecoveryPhrase('');
                    setRecoveryError(null);
                    setRecoverySuccess(false);
                  }}
                  className="text-sm font-semibold text-blue-300 hover:text-blue-200
                             flex items-center gap-1.5 underline transition-colors duration-200"
                >
                  <FileText className="w-4 h-4" />
                  リカバリフレーズを使用
                </motion.button>
                {onResetSession && (
                  <button
                    onClick={onResetSession}
                    className="text-xs text-red-400 hover:text-red-300 underline transition-colors duration-200"
                  >
                    セットアップをリセット
                  </button>
                )}
              </motion.div>
            )}
          </>
        )}

        {/* ── Recovery Mode ───────────────────────────────────────────────── */}
        {mode === 'recovery' && (
          <div className="w-full space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                復元後、生体認証の再登録が必要です。フレーズはサーバーに送信されません。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/70">
                24単語のリカバリフレーズ（スペース区切り）
              </label>
              <textarea
                value={recoveryPhrase}
                onChange={(e) => { setRecoveryPhrase(e.target.value); setRecoveryError(null); }}
                disabled={isRecovering || recoverySuccess}
                placeholder="apple banana cat dog ..."
                rows={4}
                className="w-full bg-white/5 border border-white/20 rounded-xl p-3
                           text-sm text-white placeholder:text-white/30
                           focus:border-purple-500/50 outline-none resize-none font-mono
                           disabled:opacity-50"
              />
              <p className={`text-xs ${recoveryWordCount === 24 ? 'text-emerald-400' : 'text-white/40'}`}>
                {recoveryWordCount} / 24 単語{recoveryWordCount === 24 && ' ✓'}
              </p>
            </div>

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

            {recoverySuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-300">
                  キーを復元しました。再セットアップ画面に移動します…
                </p>
              </motion.div>
            )}

            <div className="flex gap-3">
              <motion.button
                whileHover={recoveryReady ? { scale: 1.02, y: -2 } : {}}
                whileTap={recoveryReady ? { scale: 0.98 } : {}}
                onClick={handleRecovery}
                disabled={!recoveryReady}
                className="flex-1 bg-gradient-to-r from-purple-500 to-violet-400 text-white
                           font-semibold py-3 rounded-xl transition-all duration-300
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRecovering ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    復元中...
                  </span>
                ) : recoverySuccess ? '復元完了' : 'キーを復元'}
              </motion.button>

              {!recoverySuccess && (
                <motion.button
                  whileHover={{ opacity: 0.8 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setMode('biometric'); setRecoveryPhrase(''); setRecoveryError(null); }}
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
      </motion.div>

      {/* Footer */}
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
