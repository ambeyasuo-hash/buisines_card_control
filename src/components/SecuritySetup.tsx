'use client';

/**
 * Security Setup Component — Phase 9 (顔認証ファースト)
 *
 * 設計思想:
 *   - 24単語の確認ゲートを廃止し、「生体認証を有効にする」ボタン1つで完結
 *   - 登録成功時に Data Key を生成し、wrapped_data_key_alpha/beta を Supabase user_vault へ保存
 *   - リカバリフレーズは Settings → Emergency Recovery で任意のタイミングで確認可能
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Smartphone, Lock, CheckCircle, AlertTriangle,
  Loader, Zap,
} from 'lucide-react';
import {
  registerWebAuthnCredential,
  assertWebAuthnCredential,
  isWebAuthnSupported,
  isWebAuthnEnabled,
} from '@/lib/webauthn';
import { deriveWrappingKeyFromAssertion } from '@/lib/crypto';
import { getSessionManager } from '@/lib/auth-session';
import { getOrCreateEncryptionKey, validatePINStrength } from '@/lib/crypto';
import { keyB64ToMnemonic } from '@/lib/mnemonic';
import {
  generateDataKey,
  exportDataKey,
  wrapDataKey,
  deriveWrappingKeyFromMnemonic,
  saveVaultToSupabase,
} from '@/lib/vault';
import { ENCRYPTION_LS_KEY } from '@/lib/crypto';
import { isSupabaseConfigured } from '@/lib/supabase-client';

interface SecuritySetupProps {
  onComplete?: () => void;
}

export function SecuritySetup({ onComplete }: SecuritySetupProps) {
  const [webAuthnReady, setWebAuthnReady] = useState(false);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'pin' | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  useEffect(() => {
    setWebAuthnReady(isWebAuthnSupported());
    setWebAuthnEnabled(isWebAuthnEnabled());
    setPinEnabled(localStorage.getItem('pin_enabled') === 'true');
  }, []);

  // ── WebAuthn registration (顔認証ファースト) ───────────────────────────────
  const handleWebAuthnRegister = async () => {
    try {
      setIsRegistering(true);
      setRegistrationStatus({ type: null, message: '' });

      // Step 1: Data Key を生成（または既存を取得）
      const dataKey = await generateDataKey();
      const dataKeyB64 = await exportDataKey(dataKey);

      // Step 2: WebAuthn credential を登録
      const result = await registerWebAuthnCredential();
      if (!result.success) {
        setRegistrationStatus({ type: 'error', message: result.message });
        return;
      }

      // Step 3: 直後に assertion で署名を取得 → Level 1 wrapping key を導出
      const assertion = await assertWebAuthnCredential();

      let wrappedAlpha: string | null = null;
      if (assertion.success && assertion.signature) {
        const wrappingKeyAlpha = await deriveWrappingKeyFromAssertion(assertion.signature);
        wrappedAlpha = await wrapDataKey(dataKey, wrappingKeyAlpha);
      }

      // Step 4: リカバリ wrapping key (Level 2) を生成
      // Data Key とは独立した 32-byte ランダムエントロピー → 24 単語に変換
      const recoveryBytes = crypto.getRandomValues(new Uint8Array(32));
      const recoveryB64 = btoa(String.fromCharCode(...recoveryBytes));
      const recoveryMnemonic = keyB64ToMnemonic(recoveryB64);
      const wrappingKeyBeta = await deriveWrappingKeyFromMnemonic(recoveryMnemonic);
      const wrappedBeta = await wrapDataKey(dataKey, wrappingKeyBeta);

      // Step 5: localStorage に Data Key + wrapped alpha を保存（後方互換）
      localStorage.setItem(ENCRYPTION_LS_KEY, dataKeyB64);
      if (wrappedAlpha) {
        localStorage.setItem('encryption_key_wrapped_b64', wrappedAlpha);
      }

      // Step 6: リカバリフレーズを pending として保存（Settings で表示可能）
      localStorage.setItem('recovery_mnemonic_pending', recoveryMnemonic);
      localStorage.removeItem('mnemonic_backed_up'); // 未バックアップ状態にリセット

      // Step 7: Supabase user_vault へ保存
      if (wrappedAlpha) {
        const encryptionSalt =
          localStorage.getItem('encryption_salt') || crypto.randomUUID();
        localStorage.setItem('encryption_salt', encryptionSalt);

        if (isSupabaseConfigured()) {
          // Supabase 設定済み → 必ず保存（失敗したら登録を中断）
          try {
            await saveVaultToSupabase(
              { wrapped_data_key_alpha: wrappedAlpha, wrapped_data_key_beta: wrappedBeta },
              encryptionSalt,
            );
            console.log('[SecuritySetup] Vault saved to Supabase successfully');
          } catch (err) {
            // Vault 保存失敗 → localStorage をロールバックして登録を中断
            console.error('[SecuritySetup] Vault save failed:', err);
            localStorage.removeItem(ENCRYPTION_LS_KEY);
            localStorage.removeItem('encryption_key_wrapped_b64');
            localStorage.removeItem('webauthn_enabled');
            localStorage.removeItem('webauthn_credential_id');
            setRegistrationStatus({
              type: 'error',
              message: `Vault への保存に失敗しました。Supabase の接続と RLS ポリシーを確認してください。\n\n${(err as Error).message}\n\n※ Supabase → Authentication → Policies → user_vault に anon INSERT/UPDATE ポリシーが必要です。`,
            });
            return;
          }
        } else {
          // Supabase 未設定 → localStorage のみ（後で Supabase 設定後に再登録を促す）
          console.warn('[SecuritySetup] Supabase not configured — vault stored in localStorage only');
        }
      }

      // Step 8: セッションに Data Key をセット → UNLOCKED
      getSessionManager().setMasterKey(dataKey);
      setWebAuthnEnabled(true);
      setRegistrationStatus({
        type: 'success',
        message: isSupabaseConfigured()
          ? '生体認証が登録されました！リカバリフレーズは設定画面で確認できます。'
          : '生体認証を登録しました。Supabase を設定するとデータが永続化されます。',
      });
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

  // ── PIN registration (フォールバック) ─────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-5 h-5 text-blue-400" />
        <div>
          <h2 className="text-lg font-semibold text-white">セキュリティ設定</h2>
          <p className="text-xs text-white/50 mt-1">
            生体認証で名刺データを保護します
          </p>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* Status Message */}
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

      {/* Primary Action: 生体認証を有効にする */}
      {registrationMode === null && (
        <div className="grid gap-3">

          {/* WebAuthn — primary CTA */}
          {webAuthnReady && !webAuthnEnabled && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleWebAuthnRegister}
              disabled={isRegistering}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl
                         bg-gradient-to-r from-blue-500 to-cyan-400 text-white
                         font-semibold transition-all duration-300
                         disabled:opacity-50 disabled:cursor-not-allowed
                         hover:from-blue-600 hover:to-cyan-500
                         shadow-lg shadow-blue-500/20"
            >
              {isRegistering ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  登録中...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  生体認証を有効にする
                </>
              )}
            </motion.button>
          )}

          {/* PIN fallback */}
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
                <p className="font-semibold text-white text-sm">PIN を登録（代替）</p>
                <p className="text-xs text-white/50">生体認証非対応の環境向け</p>
              </div>
            </motion.button>
          )}

          {/* Setup Complete */}
          {webAuthnEnabled && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-semibold text-emerald-300">セットアップ完了</p>
                  <p className="text-xs text-emerald-200/70 mt-1">
                    生体認証が有効です。設定画面でリカバリフレーズを確認してください。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No biometric + no PIN */}
          {!webAuthnReady && !pinEnabled && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs text-amber-300">
                このデバイスは生体認証に対応していません。PIN をご使用ください。
              </p>
            </div>
          )}
        </div>
      )}

      {/* PIN Registration Form */}
      {registrationMode === 'pin' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20"
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">
                PIN を設定（4～8 桁）
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full text-center text-2xl tracking-widest font-mono
                             border border-amber-500/30 bg-white/5 rounded-lg p-3
                             text-white placeholder:text-white/30
                             focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none"
                />
                <button
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
                >
                  {showPin ? '隠す' : '表示'}
                </button>
              </div>
              {pin && (
                <p className={`text-xs mt-2 ${pinValidation.valid ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {pinValidation.message}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-white/70 block mb-2">PIN を確認</label>
              <input
                type={showPin ? 'text' : 'password'}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
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
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  登録中...
                </span>
              ) : 'PIN を登録'}
            </motion.button>
            <motion.button
              whileHover={{ opacity: 0.8 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setRegistrationMode(null); setPin(''); setPinConfirm(''); }}
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
