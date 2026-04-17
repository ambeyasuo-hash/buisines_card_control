'use client';

/**
 * Security Setup Component — Phase 10+ (アトミック初期設定)
 *
 * 設計思想:
 *   - API キー (Supabase/Azure) が設定済みでなければ生体認証登録ボタンを無効化
 *   - 登録処理は「すべて成功しなければ一切保存しない」アトミック・トランザクション
 *   - Data Key 生成 → API キー暗号化 → WebAuthn → Recovery → Vault 保存
 *     の順を一つの try-catch で囲み、失敗時は localStorage を完全ロールバック
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Smartphone, Lock, CheckCircle, AlertTriangle,
  Loader, Zap, Database, ScanLine, XCircle, RefreshCw,
} from 'lucide-react';
import {
  registerWebAuthnCredential,
  assertWebAuthnCredential,
  isWebAuthnSupported,
  isWebAuthnEnabled,
} from '@/lib/webauthn';
import { deriveWrappingKeyFromAssertion, encryptData } from '@/lib/crypto';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecuritySetupProps {
  onComplete?: () => void;
}

/** 前提条件の状態 */
interface Prerequisites {
  supabase: boolean;  // URL + anon key が有効
  azure: boolean;     // endpoint + API key が有効
}

/**
 * アトミック登録コミット前に全フィールドが揃っていることを型で保証
 * このオブジェクトが完成するまで localStorage には一切書き込まない
 */
interface AtomicSetupCommit {
  dataKeyB64:               string;         // AES-256-GCM Data Key (raw)
  wrappedAlpha:             string;         // Data Key wrapped with WebAuthn
  wrappedBeta:              string;         // Data Key wrapped with recovery mnemonic
  encryptionSalt:           string;         // Supabase vault 識別子
  recoveryMnemonic:         string;         // 24-word BIP-39
  encryptedApiCredentials:  string | null;  // Azure creds encrypted with Data Key
}

// ─── Prerequisite helpers ──────────────────────────────────────────────────────

function checkPrerequisites(): Prerequisites {
  try {
    const supabaseUrl = localStorage.getItem('supabase_url')?.trim() ?? '';
    const supabaseKey = localStorage.getItem('supabase_anon_key')?.trim() ?? '';
    const azureEndpoint = localStorage.getItem('azure_ocr_endpoint')?.trim() ?? '';
    const azureKey = localStorage.getItem('azure_ocr_key')?.trim() ?? '';

    const supabase =
      supabaseUrl.startsWith('https://') &&
      supabaseUrl.includes('.supabase.co') &&
      supabaseKey.startsWith('eyJ') &&
      supabaseKey.length > 100;

    const azure =
      azureEndpoint.startsWith('https://') &&
      (azureEndpoint.includes('.cognitiveservices.azure.com') ||
       azureEndpoint.includes('api.cognitive.microsoft.com')) &&
      azureKey.length >= 20;

    return { supabase, azure };
  } catch {
    return { supabase: false, azure: false };
  }
}

/** localStorage を完全にロールバック（失敗時の安全網） */
function rollbackLocalStorage(): void {
  const keys = [
    ENCRYPTION_LS_KEY,
    'encryption_key_wrapped_b64',
    'webauthn_enabled',
    'webauthn_credential_id',
    'webauthn_public_key_b64',
    'encryption_salt',
    'recovery_mnemonic_pending',
    'azure_credentials_encrypted',
    'pin_enabled',
  ];
  keys.forEach((k) => localStorage.removeItem(k));
  console.log('[SecuritySetup] localStorage rolled back');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SecuritySetup({ onComplete }: SecuritySetupProps) {
  const [webAuthnReady, setWebAuthnReady]     = useState(false);
  const [webAuthnEnabled, setWebAuthnEnabled] = useState(false);
  const [pinEnabled, setPinEnabled]           = useState(false);
  const [isRegistering, setIsRegistering]     = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'pin' | null>(null);
  const [pin, setPin]               = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin]       = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // 前提条件チェック
  const [prerequisites, setPrerequisites] = useState<Prerequisites>({ supabase: false, azure: false });
  const [prereqChecked, setPrereqChecked] = useState(false);

  const refreshPrerequisites = useCallback(() => {
    const p = checkPrerequisites();
    setPrerequisites(p);
    setPrereqChecked(true);
  }, []);

  useEffect(() => {
    setWebAuthnReady(isWebAuthnSupported());
    setWebAuthnEnabled(isWebAuthnEnabled());
    setPinEnabled(localStorage.getItem('pin_enabled') === 'true');
    refreshPrerequisites();

    // storage イベントで他タブ/コンポーネントの変更を検知
    const handleStorage = () => refreshPrerequisites();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshPrerequisites]);

  const allPrerequisitesMet = prerequisites.supabase && prerequisites.azure;

  // ── WebAuthn アトミック登録 ────────────────────────────────────────────────
  const handleWebAuthnRegister = async () => {
    // 前提条件を再チェック（念のため）
    const p = checkPrerequisites();
    if (!p.supabase || !p.azure) {
      setRegistrationStatus({
        type: 'error',
        message: 'Supabase と Azure の設定を先に保存してください。',
      });
      return;
    }

    setIsRegistering(true);
    setRegistrationStatus({ type: null, message: '' });

    // ── アトミック・トランザクション開始 ────────────────────────────────────
    // このブロック内で失敗したら rollbackLocalStorage() を呼ぶ
    // LocalStorage への書き込みは commit オブジェクト完成後の最後のみ
    try {
      // Step 1: Encryption salt を同期で先行生成（WebAuthn の user.id に使う）
      // crypto.randomUUID() は同期なので非同期待ちゼロ → user gesture window を消費しない
      const encryptionSalt = crypto.randomUUID();
      const stableUserId   = new TextEncoder().encode(encryptionSalt); // UUID → Uint8Array

      // Step 2: ブラウザの user gesture window が開いている間に WebAuthn 登録を呼ぶ
      // ← ここより前に await を入れると iOS/Android でセキュリティ・ウィンドウが失効する
      const result = await registerWebAuthnCredential(stableUserId);
      if (!result.success) {
        throw new Error(result.message);
      }

      // Step 3: 直後に assertion で署名を取得 → Level 1 wrapping key を導出
      const assertion = await assertWebAuthnCredential();
      if (!assertion.success || !assertion.signature) {
        throw new Error(assertion.message || 'WebAuthn assertion に失敗しました');
      }

      // Step 4: WebAuthn 完了後に Data Key を生成（重い非同期処理はここから）
      const dataKey    = await generateDataKey();
      const dataKeyB64 = await exportDataKey(dataKey);

      // Step 5: Level 1 wrapping key を assertion signature から導出 → Data Key をラップ
      const wrappingKeyAlpha = await deriveWrappingKeyFromAssertion(assertion.signature);
      const wrappedAlpha     = await wrapDataKey(dataKey, wrappingKeyAlpha);

      // Step 5b: API キーを Data Key で暗号化（WebAuthn 後なので user gesture 問題なし）
      const azureEndpoint = localStorage.getItem('azure_ocr_endpoint')?.trim() ?? '';
      const azureApiKey   = localStorage.getItem('azure_ocr_key')?.trim()      ?? '';
      let encryptedApiCredentials: string | null = null;
      if (azureEndpoint && azureApiKey) {
        encryptedApiCredentials = await encryptData(
          { endpoint: azureEndpoint, apiKey: azureApiKey },
          dataKey,
        );
      }

      // Step 6: リカバリ wrapping key (Level 2) を生成
      const recoveryBytes    = crypto.getRandomValues(new Uint8Array(32));
      const recoveryB64      = btoa(String.fromCharCode(...recoveryBytes));
      const recoveryMnemonic = keyB64ToMnemonic(recoveryB64);
      const wrappingKeyBeta  = await deriveWrappingKeyFromMnemonic(recoveryMnemonic);
      const wrappedBeta      = await wrapDataKey(dataKey, wrappingKeyBeta);

      // ── ここで AtomicSetupCommit が完成 (型で全フィールド保証) ──
      const commit: AtomicSetupCommit = {
        dataKeyB64,
        wrappedAlpha,
        wrappedBeta,
        encryptionSalt,
        recoveryMnemonic,
        encryptedApiCredentials,
      };

      // Step 7: Supabase user_vault へ保存（必須 — 失敗したら throw）
      await saveVaultToSupabase(
        {
          wrapped_data_key_alpha: commit.wrappedAlpha,
          wrapped_data_key_beta:  commit.wrappedBeta,
        },
        commit.encryptionSalt,
      );

      // Step 8: Supabase 保存成功後にのみ localStorage へコミット（All or Nothing）
      localStorage.setItem(ENCRYPTION_LS_KEY,                commit.dataKeyB64);
      localStorage.setItem('encryption_key_wrapped_b64',     commit.wrappedAlpha);
      localStorage.setItem('webauthn_enabled',               'true');
      localStorage.setItem('encryption_salt',                commit.encryptionSalt);
      localStorage.setItem('recovery_mnemonic_pending',      commit.recoveryMnemonic);
      localStorage.removeItem('mnemonic_backed_up');
      if (commit.encryptedApiCredentials) {
        localStorage.setItem('azure_credentials_encrypted',  commit.encryptedApiCredentials);
      }

      // Step 9: セッションに Data Key をセット → UNLOCKED
      const importedKey = await (async () => {
        const { importKeyFromBase64 } = await import('@/lib/crypto');
        return importKeyFromBase64(commit.dataKeyB64);
      })();
      getSessionManager().setMasterKey(importedKey);

      setWebAuthnEnabled(true);
      setRegistrationStatus({
        type: 'success',
        message: '生体認証が登録されました！設定はすべて暗号化されて Supabase に保存されました。',
      });
      onComplete?.();

    } catch (error) {
      // 失敗時は localStorage を完全ロールバック
      rollbackLocalStorage();
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[SecuritySetup] Atomic registration failed, rolled back:', msg);
      setRegistrationStatus({
        type: 'error',
        message: `登録に失敗しました。設定は保存されていません。\n\n${msg}`,
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // ── PIN 登録 (フォールバック) ──────────────────────────────────────────────
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

  const pinValidation  = validatePINStrength(pin);
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

      {/* ── 前提条件チェックリスト ─────────────────────────────────────────── */}
      {prereqChecked && !webAuthnEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border space-y-3 ${
            allPrerequisitesMet
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-amber-500/8 border-amber-500/25'
          }`}
        >
          <p className="text-xs font-semibold text-white/70 flex items-center gap-2">
            {allPrerequisitesMet
              ? <CheckCircle className="w-4 h-4 text-emerald-400" />
              : <AlertTriangle className="w-4 h-4 text-amber-400" />
            }
            {allPrerequisitesMet ? '前提条件 — すべて完了' : '前提条件 — 設定が必要です'}
          </p>

          <div className="space-y-2">
            <PrereqRow
              icon={Database}
              label="Supabase 接続"
              ok={prerequisites.supabase}
              hint="Vault（鍵ストレージ）に必須"
            />
            <PrereqRow
              icon={ScanLine}
              label="Azure OCR"
              ok={prerequisites.azure}
              hint="名刺スキャンに必須"
            />
          </div>

          {!allPrerequisitesMet && (
            <p className="text-xs text-amber-300/80">
              上記の API キーを「設定を保存」してから戻ってきてください。
            </p>
          )}

          {/* 手動リフレッシュ */}
          <button
            onClick={refreshPrerequisites}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            再確認
          </button>
        </motion.div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          icon={Smartphone}
          label="生体認証"
          enabled={webAuthnEnabled}
          enabledText="設定済み"
          disabledText={webAuthnReady ? '未設定' : '非対応'}
          color="blue"
        />
        <StatusCard
          icon={Lock}
          label="PIN"
          enabled={pinEnabled}
          enabledText="設定済み"
          disabledText="未設定"
          color="amber"
        />
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
            className={`text-sm whitespace-pre-line ${
              registrationStatus.type === 'success' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {registrationStatus.message}
          </p>
        </motion.div>
      )}

      {/* Primary Action */}
      {registrationMode === null && (
        <div className="grid gap-3">

          {/* WebAuthn — primary CTA (前提条件が揃うまで disabled) */}
          {webAuthnReady && !webAuthnEnabled && (
            <div className="relative">
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={allPrerequisitesMet && !isRegistering ? { scale: 1.02, y: -2 } : {}}
                whileTap={allPrerequisitesMet && !isRegistering ? { scale: 0.98 } : {}}
                onClick={handleWebAuthnRegister}
                disabled={isRegistering || !allPrerequisitesMet}
                className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl
                           font-semibold transition-all duration-300
                           ${allPrerequisitesMet
                             ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:from-blue-600 hover:to-cyan-500 shadow-lg shadow-blue-500/20'
                             : 'bg-slate-700/50 text-white/40 cursor-not-allowed border border-slate-600/30'
                           }
                           disabled:opacity-60 disabled:cursor-not-allowed`}
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
              {!allPrerequisitesMet && (
                <p className="text-center text-xs text-amber-400/70 mt-2">
                  ↑ 上記の前提条件を満たすと有効になります
                </p>
              )}
            </div>
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function PrereqRow({
  icon: Icon, label, ok, hint,
}: {
  icon: React.ElementType;
  label: string;
  ok: boolean;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 flex-shrink-0 ${ok ? 'text-emerald-400' : 'text-amber-400'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">{label}</p>
        <p className="text-xs text-white/40">{hint}</p>
      </div>
      {ok
        ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        : <XCircle    className="w-4 h-4 text-amber-400  flex-shrink-0" />
      }
    </div>
  );
}

function StatusCard({
  icon: Icon, label, enabled, enabledText, disabledText, color,
}: {
  icon: React.ElementType;
  label: string;
  enabled: boolean;
  enabledText: string;
  disabledText: string;
  color: 'blue' | 'amber';
}) {
  const colorMap = {
    blue:  { icon: 'text-blue-400',  card: enabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-500/10 border-slate-500/30' },
    amber: { icon: 'text-amber-400', card: enabled ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-500/10 border-slate-500/30' },
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border transition-colors duration-200 ${colorMap.card}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorMap.icon}`} />
        <span className="text-xs font-semibold text-white">{label}</span>
      </div>
      {enabled ? (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-300">{enabledText}</span>
        </div>
      ) : (
        <p className="text-xs text-slate-300">{disabledText}</p>
      )}
    </motion.div>
  );
}
