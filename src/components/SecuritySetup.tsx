'use client';

/**
 * Security Setup Component
 *
 * WebAuthn (Biometric) & PIN Registration
 *
 * 責務:
 *   - WebAuthn 登録フロー（FaceID/指紋）
 *   - PIN 登録フロー（代替）
 *   - 設定状態の表示
 *   - Wrapped master key の生成・保存
 *   - [Phase 7] 初回セットアップ時に24単語バックアップフレーズを表示・確認
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Smartphone, Lock, CheckCircle, AlertCircle, AlertTriangle,
  Loader, Eye, EyeOff, Copy, Check, Zap, FileText, ChevronRight,
} from 'lucide-react';
import {
  registerWebAuthnCredential,
  isWebAuthnSupported,
  isWebAuthnEnabled,
  isSecurityConfigured,
} from '@/lib/webauthn';
import { getSessionManager } from '@/lib/auth-session';
import { getOrCreateEncryptionKey, validatePINStrength } from '@/lib/crypto';
import { keyB64ToMnemonic } from '@/lib/mnemonic';

interface SecuritySetupProps {
  onComplete?: () => void;
}

export function SecuritySetup({ onComplete }: SecuritySetupProps) {
  const [webAuthnReady, setWebAuthnReady] = useState(false);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'webauthn' | 'pin' | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // ── Backup Phrase Step ─────────────────────────────────────────────────────
  const [backupStep, setBackupStep] = useState<'loading' | 'show-phrase' | 'confirmed'>('loading');
  const [mnemonicWords, setMnemonicWords] = useState<string[]>([]);
  const [confirmedBackup, setConfirmedBackup] = useState(false);
  const [showMnemonicWords, setShowMnemonicWords] = useState(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState(false);

  // Initialize: check if backup phrase needs to be shown
  useEffect(() => {
    const init = async () => {
      const supported = isWebAuthnSupported();
      const enabled = isWebAuthnEnabled();
      const pinSet = localStorage.getItem('pin_enabled') === 'true';

      setWebAuthnReady(supported);
      setWebAuthnEnabled(enabled);
      setPinEnabled(pinSet);

      const alreadyBackedUp = localStorage.getItem('mnemonic_backed_up') === 'true';
      if (alreadyBackedUp) {
        setBackupStep('confirmed');
        return;
      }

      // Generate/get key and compute mnemonic for display
      try {
        const { keyB64 } = await getOrCreateEncryptionKey();
        const mnemonic = keyB64ToMnemonic(keyB64);
        setMnemonicWords(mnemonic.split(' '));
        setBackupStep('show-phrase');
      } catch (err) {
        console.error('[SecuritySetup] Failed to generate mnemonic:', err);
        setBackupStep('confirmed'); // Non-blocking: skip on error
      }
    };
    init();
  }, []);

  const handleConfirmBackup = () => {
    localStorage.setItem('mnemonic_backed_up', 'true');
    setBackupStep('confirmed');
  };

  const handleCopyMnemonic = async () => {
    try {
      await navigator.clipboard.writeText(mnemonicWords.join(' '));
      setCopiedMnemonic(true);
      setTimeout(() => setCopiedMnemonic(false), 2000);
    } catch {
      // Clipboard not available (PWA security context)
    }
  };

  // ── WebAuthn registration handler ──────────────────────────────────────────
  const handleWebAuthnRegister = async () => {
    try {
      setIsRegistering(true);
      setRegistrationStatus({ type: null, message: '' });

      const { key } = await getOrCreateEncryptionKey();
      const result = await registerWebAuthnCredential();

      if (!result.success) {
        setRegistrationStatus({ type: 'error', message: result.message });
        return;
      }

      const manager = getSessionManager();
      manager.setMasterKey(key);

      setWebAuthnEnabled(true);
      setRegistrationMode(null);
      setRegistrationStatus({ type: 'success', message: '生体認証が登録されました！' });
      onComplete?.();
    } catch (error) {
      setRegistrationStatus({
        type: 'error',
        message: `登録エラー: ${(error as Error).message}`,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // ── PIN registration handler ───────────────────────────────────────────────
  const handlePinRegister = async () => {
    try {
      const pinValidation = validatePINStrength(pin);
      if (!pinValidation.valid) {
        setRegistrationStatus({ type: 'error', message: pinValidation.message });
        return;
      }
      if (pin !== pinConfirm) {
        setRegistrationStatus({ type: 'error', message: 'PIN が一致しません' });
        return;
      }

      setIsRegistering(true);
      setRegistrationStatus({ type: null, message: '' });

      const { key } = await getOrCreateEncryptionKey();
      const manager = getSessionManager();
      manager.setMasterKey(key);

      const success = await manager.registerPIN(pin);
      if (!success) {
        setRegistrationStatus({ type: 'error', message: 'PIN 登録に失敗しました' });
        return;
      }

      setPinEnabled(true);
      setPin('');
      setPinConfirm('');
      setRegistrationMode(null);
      setRegistrationStatus({ type: 'success', message: 'PIN が登録されました！' });
      onComplete?.();
    } catch (error) {
      setRegistrationStatus({
        type: 'error',
        message: `登録エラー: ${(error as Error).message}`,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const pinValidation = validatePINStrength(pin);
  const canRegisterPin = pin.length >= 4 && pin === pinConfirm;

  // ── Render: Loading ────────────────────────────────────────────────────────
  if (backupStep === 'loading') {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  // ── Render: Backup Phrase Gate ─────────────────────────────────────────────
  if (backupStep === 'show-phrase') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-lg font-semibold text-white">リカバリフレーズを保存</h2>
            <p className="text-xs text-white/50 mt-1">セキュリティ設定の前に必ず行ってください</p>
          </div>
        </div>

        {/* Critical Warning */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/40 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-300 space-y-1">
            <p className="font-bold text-red-200">
              ⚠ このフレーズを失うと、二度とデータにアクセスできません
            </p>
            <p>
              キャッシュクリア・機種変更・アプリ削除の際、このフレーズのみがマスターキーを復元できます。
              サーバーには一切保存されていません（Zero-Knowledge 原則）。
            </p>
          </div>
        </motion.div>

        {/* Mnemonic Display */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="p-4 rounded-xl bg-slate-800/60 border border-slate-600/40"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white/70">24単語のリカバリフレーズ</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowMnemonicWords(!showMnemonicWords)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showMnemonicWords ? (
                  <><EyeOff className="w-3.5 h-3.5" /> 隠す</>
                ) : (
                  <><Eye className="w-3.5 h-3.5" /> 表示</>
                )}
              </button>
              <button
                onClick={handleCopyMnemonic}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                {copiedMnemonic ? (
                  <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">コピー済み</span></>
                ) : (
                  <><Copy className="w-3.5 h-3.5" /> コピー</>
                )}
              </button>
            </div>
          </div>

          {showMnemonicWords ? (
            <div className="grid grid-cols-4 gap-1.5">
              {mnemonicWords.map((word, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-700/60 border border-slate-600/40"
                >
                  <span className="text-[10px] text-white/30 w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-xs font-mono text-white truncate">{word}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => setShowMnemonicWords(true)}
              className="h-24 flex items-center justify-center rounded-lg bg-slate-700/40 border border-slate-600/30
                         cursor-pointer hover:bg-slate-700/60 transition-colors"
            >
              <div className="text-center">
                <Eye className="w-5 h-5 text-white/30 mx-auto mb-1" />
                <p className="text-xs text-white/40">タップして表示</p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Confirmation Checkbox */}
        <motion.label
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-start gap-3 cursor-pointer group"
        >
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={confirmedBackup}
              onChange={(e) => setConfirmedBackup(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                confirmedBackup
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-500 group-hover:border-slate-400'
              }`}
            >
              {confirmedBackup && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
          <span className="text-sm text-white/80 leading-snug">
            24単語を紙に書き留めました。このフレーズを安全な場所に保管します。
          </span>
        </motion.label>

        {/* Next Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={handleConfirmBackup}
          disabled={!confirmedBackup}
          whileHover={confirmedBackup ? { scale: 1.02, y: -2 } : {}}
          whileTap={confirmedBackup ? { scale: 0.98 } : {}}
          className="w-full flex items-center justify-center gap-2
                     bg-gradient-to-r from-blue-500 to-cyan-400 text-white
                     font-semibold py-3 rounded-xl transition-all duration-300
                     disabled:opacity-40 disabled:cursor-not-allowed
                     hover:from-blue-600 hover:to-cyan-500"
        >
          保存を確認して次へ
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    );
  }

  // ── Render: Normal Setup UI (backupStep === 'confirmed') ───────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-5 h-5 text-blue-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">セキュリティ設定</h2>
          <p className="text-xs text-white/50 mt-1">
            生体認証または PIN で、あなたの名刺を保護します
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* WebAuthn Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border transition-colors duration-200 ${
            webAuthnEnabled
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-slate-500/10 border-slate-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-white">生体認証</span>
          </div>
          {webAuthnEnabled ? (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">設定済み</span>
            </div>
          ) : (
            <p className="text-xs text-slate-300">{webAuthnReady ? '未設定' : '非対応'}</p>
          )}
        </motion.div>

        {/* PIN Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`p-4 rounded-xl border transition-colors duration-200 ${
            pinEnabled
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-slate-500/10 border-slate-500/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-white">PIN</span>
          </div>
          {pinEnabled ? (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300">設定済み</span>
            </div>
          ) : (
            <p className="text-xs text-slate-300">未設定</p>
          )}
        </motion.div>
      </div>

      {/* Registration Status Message */}
      {registrationStatus.type && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-start gap-3 ${
            registrationStatus.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}
        >
          {registrationStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              registrationStatus.type === 'success' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {registrationStatus.message}
          </p>
        </motion.div>
      )}

      {/* Registration Forms */}
      {registrationMode === null && (
        <div className="grid gap-3">
          {/* WebAuthn Button */}
          {webAuthnReady && !webAuthnEnabled && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setRegistrationMode('webauthn')}
              className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/15 border border-blue-500/30
                         hover:bg-blue-500/25 hover:border-blue-500/50 transition-all duration-200
                         text-left"
            >
              <Smartphone className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">生体認証を登録</p>
                <p className="text-xs text-white/50">FaceID または 指紋認証</p>
              </div>
              <Zap className="w-4 h-4 text-blue-300" />
            </motion.button>
          )}

          {/* PIN Button */}
          {!pinEnabled && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: webAuthnReady ? 0.05 : 0 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setRegistrationMode('pin')}
              className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30
                         hover:bg-amber-500/25 hover:border-amber-500/50 transition-all duration-200
                         text-left"
            >
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-white text-sm">PIN を登録</p>
                <p className="text-xs text-white/50">4～8 桁の数字</p>
              </div>
              <Zap className="w-4 h-4 text-amber-300" />
            </motion.button>
          )}

          {/* Setup Complete */}
          {webAuthnEnabled && pinEnabled && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-semibold text-emerald-300">セットアップ完了</p>
                  <p className="text-xs text-emerald-200/70 mt-1">セキュリティが有効になりました</p>
                </div>
              </div>
            </div>
          )}

          {/* No biometric + no PIN available */}
          {!webAuthnEnabled && !pinEnabled && !webAuthnReady && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs text-amber-300">
                このデバイスは生体認証に対応していません。PIN をご使用ください。
              </p>
            </div>
          )}
        </div>
      )}

      {/* WebAuthn Registration Form */}
      {registrationMode === 'webauthn' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20"
        >
          <p className="text-sm text-white/80">
            デバイスの生体認証でセットアップします。認証ボタンをタップしてください。
          </p>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWebAuthnRegister}
              disabled={isRegistering}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-400 text-white
                         font-semibold py-3 rounded-xl transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:from-blue-600 hover:to-cyan-500"
            >
              {isRegistering ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  認証中...
                </span>
              ) : (
                '生体認証を登録'
              )}
            </motion.button>

            <motion.button
              whileHover={{ opacity: 0.8 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setRegistrationMode(null)}
              disabled={isRegistering}
              className="px-4 py-3 rounded-xl border border-slate-500/30 text-slate-400
                         hover:text-white hover:border-slate-500/50 transition-colors duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* PIN Registration Form */}
      {registrationMode === 'pin' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
        >
          <div className="space-y-3">
            {/* PIN Input */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                PIN を設定（4～8 桁）
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setPin(val);
                  }}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full text-center text-2xl tracking-widest font-mono
                             border border-amber-500/30 bg-white/5 rounded-lg p-3
                             text-white placeholder:text-white/30
                             focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none"
                />
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50
                             hover:text-white/70 transition-colors"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pin && (
                <p className={`text-xs mt-2 ${pinValidation.valid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {pinValidation.message}
                </p>
              )}
            </div>

            {/* PIN Confirm */}
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">PIN を確認</label>
              <input
                type={showPin ? 'text' : 'password'}
                value={pinConfirm}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setPinConfirm(val);
                }}
                placeholder="••••"
                maxLength={8}
                className="w-full text-center text-2xl tracking-widest font-mono
                           border border-amber-500/30 bg-white/5 rounded-lg p-3
                           text-white placeholder:text-white/30
                           focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none"
              />
              {pinConfirm && pin !== pinConfirm && (
                <p className="text-xs text-red-400 mt-2">PIN が一致しません</p>
              )}
              {pinConfirm && pin === pinConfirm && (
                <p className="text-xs text-emerald-400 mt-2">✓ 一致しました</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePinRegister}
              disabled={isRegistering || !canRegisterPin}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-400 text-white
                         font-semibold py-3 rounded-xl transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:from-amber-600 hover:to-orange-500"
            >
              {isRegistering ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  登録中...
                </span>
              ) : (
                'PIN を登録'
              )}
            </motion.button>

            <motion.button
              whileHover={{ opacity: 0.8 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setRegistrationMode(null);
                setPin('');
                setPinConfirm('');
              }}
              disabled={isRegistering}
              className="px-4 py-3 rounded-xl border border-slate-500/30 text-slate-400
                         hover:text-white hover:border-slate-500/50 transition-colors duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              キャンセル
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
