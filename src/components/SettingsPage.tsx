'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Database, Save, CheckCircle, BookOpen, Bot,
  Eye, EyeOff, AlertCircle, ScanLine, Sparkles, AlertTriangle,
} from 'lucide-react';

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS = {
  supabaseUrl:      'supabase_url',
  supabaseAnonKey:  'supabase_anon_key',
  azureEndpoint:    'azure_ocr_endpoint',
  azureKey:         'azure_ocr_key',
  azureRegion:      'azure_ocr_region',
  geminiKey:        'gemini_api_key',
} as const;

// ─── Azure region options ─────────────────────────────────────────────────────
const AZURE_REGIONS = [
  { value: '',           label: '── 選択してください ──' },
  { value: 'japaneast',  label: 'japaneast  （東日本）推奨' },
  { value: 'japanwest',  label: 'japanwest  （西日本）' },
  { value: 'eastus',     label: 'eastus     （米国東部）' },
  { value: 'westus',     label: 'westus     （米国西部）' },
  { value: 'westeurope', label: 'westeurope （西ヨーロッパ）' },
  { value: 'southeastasia', label: 'southeastasia （東南アジア）' },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  supabaseUrl:     string;
  supabaseAnonKey: string;
  azureEndpoint:   string;
  azureKey:        string;
  azureRegion:     string;
  geminiKey:       string;
}

type VisibilityState = Record<'supabaseAnonKey' | 'azureKey' | 'geminiKey', boolean>;

type ToastType = 'success' | 'error';

// ─── helpers ─────────────────────────────────────────────────────────────────
function loadStorage(): FormState {
  try {
    return {
      supabaseUrl:     localStorage.getItem(LS.supabaseUrl)     ?? '',
      supabaseAnonKey: localStorage.getItem(LS.supabaseAnonKey) ?? '',
      azureEndpoint:   localStorage.getItem(LS.azureEndpoint)   ?? '',
      azureKey:        localStorage.getItem(LS.azureKey)        ?? '',
      azureRegion:     localStorage.getItem(LS.azureRegion)     ?? 'japaneast',
      geminiKey:       localStorage.getItem(LS.geminiKey)       ?? '',
    };
  } catch {
    return { supabaseUrl: '', supabaseAnonKey: '', azureEndpoint: '', azureKey: '', azureRegion: 'japaneast', geminiKey: '' };
  }
}

function saveStorage(f: FormState) {
  Object.entries({
    [LS.supabaseUrl]:     f.supabaseUrl.trim(),
    [LS.supabaseAnonKey]: f.supabaseAnonKey.trim(),
    [LS.azureEndpoint]:   f.azureEndpoint.trim(),
    [LS.azureKey]:        f.azureKey.trim(),
    [LS.azureRegion]:     f.azureRegion.trim(),
    [LS.geminiKey]:       f.geminiKey.trim(),
  }).forEach(([k, v]) => {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  });
}

function allEmpty(f: FormState) {
  return !f.supabaseUrl.trim() && !f.supabaseAnonKey.trim() &&
         !f.azureEndpoint.trim() && !f.azureKey.trim() && !f.geminiKey.trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Floating toast notification */
function Toast({ type, message, visible }: { type: ToastType; message: string; visible: boolean }) {
  const isSuccess = type === 'success';
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,   scale: 1 }}
          exit={{   opacity: 0, y: -12,  scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: isSuccess
              ? 'linear-gradient(135deg, rgba(16,185,129,0.92), rgba(5,150,105,0.88))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.92), rgba(220,38,38,0.88))',
            border: `1px solid ${isSuccess ? 'rgba(52,211,153,0.50)' : 'rgba(248,113,113,0.50)'}`,
            borderRadius: '12px',
            boxShadow: isSuccess
              ? '0 8px 32px rgba(16,185,129,0.35)'
              : '0 8px 32px rgba(239,68,68,0.35)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {isSuccess
            ? <CheckCircle style={{ width: '15px', height: '15px', color: '#fff', flexShrink: 0 }} />
            : <AlertTriangle style={{ width: '15px', height: '15px', color: '#fff', flexShrink: 0 }} />
          }
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Shared password input with eye toggle */
function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '10px',
          padding: '10px 38px 10px 12px',
          color: 'rgba(255,255,255,0.82)',
          fontSize: '12px',
          outline: 'none',
          fontFamily: 'monospace',
          transition: 'border 0.15s ease, box-shadow 0.15s ease',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.border = '1px solid rgba(59,130,246,0.50)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={visible ? 'キーを隠す' : 'キーを表示'}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.30)', display: 'flex', alignItems: 'center', padding: '2px',
        }}
      >
        {visible
          ? <EyeOff style={{ width: '14px', height: '14px' }} />
          : <Eye    style={{ width: '14px', height: '14px' }} />
        }
      </button>
    </div>
  );
}

/** Plain text input (for URL fields) */
function TextInput({
  id, value, onChange, placeholder, type = 'text',
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '10px',
        padding: '10px 12px',
        color: 'rgba(255,255,255,0.82)',
        fontSize: '12px',
        outline: 'none',
        fontFamily: 'monospace',
        transition: 'border 0.15s ease, box-shadow 0.15s ease',
        boxSizing: 'border-box',
      }}
      onFocus={(e) => {
        e.currentTarget.style.border = '1px solid rgba(59,130,246,0.50)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  );
}

/** Select box for enum-type settings */
function SelectInput({
  id, value, onChange, options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '10px',
        padding: '10px 12px',
        color: value ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.35)',
        fontSize: '12px',
        outline: 'none',
        fontFamily: 'monospace',
        transition: 'border 0.15s ease, box-shadow 0.15s ease',
        boxSizing: 'border-box',
        cursor: 'pointer',
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: '32px',
      }}
      onFocus={(e) => {
        e.currentTarget.style.border = '1px solid rgba(59,130,246,0.50)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {options.map((opt) => (
        <option
          key={opt.value}
          value={opt.value}
          style={{ background: '#1e293b', color: 'rgba(255,255,255,0.82)' }}
        >
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** Field label with optional usage hint */
function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div style={{ marginBottom: '6px' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
        {label}
      </span>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', marginLeft: '8px' }}>
        — {hint}
      </span>
    </div>
  );
}

/** Section card shell */
function SectionCard({
  children,
  accent,
  delay = 0,
}: {
  children: React.ReactNode;
  accent: { bg: string; border: string };
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.26, ease: 'easeOut' }}
      style={{
        background: accent.bg,
        border: `1px solid ${accent.border}`,
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      {children}
    </motion.div>
  );
}

/** Section header row */
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  iconBg,
  iconBorder,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{
        width: '34px', height: '34px', borderRadius: '11px',
        background: iconBg, border: `1px solid ${iconBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon style={{ width: '16px', height: '16px', color: iconColor }} strokeWidth={1.8} />
      </div>
      <div>
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.1px' }}>
          {title}
        </p>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '2px' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const [form, setForm] = useState<FormState>({
    supabaseUrl: '', supabaseAnonKey: '', azureEndpoint: '', azureKey: '', azureRegion: 'japaneast', geminiKey: '',
  });
  const [vis, setVis] = useState<VisibilityState>({
    supabaseAnonKey: false, azureKey: false, geminiKey: false,
  });
  const [toast, setToast]     = useState<{ type: ToastType; message: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [validationErr, setValidationErr] = useState(false);

  // Load from localStorage on mount
  useEffect(() => { setForm(loadStorage()); }, []);

  const field = useCallback(
    <K extends keyof FormState>(key: K) =>
      (value: string) => setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const toggleVis = useCallback(
    (key: keyof VisibilityState) =>
      setVis((prev) => ({ ...prev, [key]: !prev[key] })),
    [],
  );

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2600);
  }, []);

  const handleSave = useCallback(() => {
    if (allEmpty(form)) {
      setValidationErr(true);
      setTimeout(() => setValidationErr(false), 3000);
      showToast('error', '少なくとも1つのフィールドを入力してください');
      return;
    }
    setValidationErr(false);
    try {
      saveStorage(form);
      showToast('success', '設定を更新しました');
    } catch {
      showToast('error', '保存に失敗しました');
    }
  }, [form, showToast]);

  const handleClearAll = useCallback(() => {
    try {
      Object.values(LS).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setForm({ supabaseUrl: '', supabaseAnonKey: '', azureEndpoint: '', azureKey: '', azureRegion: 'japaneast', geminiKey: '' });
  }, []);

  const hasAnyValue = !allEmpty(form);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Toast ── */}
      {toast && <Toast type={toast.type} message={toast.message} visible={toastVisible} />}

      {/* ═══ 1. Supabase ═══ */}
      <SectionCard
        delay={0}
        accent={{
          bg: 'linear-gradient(150deg, rgba(37,99,235,0.14) 0%, rgba(29,78,216,0.06) 100%)',
          border: 'rgba(59,130,246,0.26)',
        }}
      >
        <SectionHeader
          icon={Database}
          title="Supabase 接続設定"
          subtitle="名刺データの保存・認証に使用"
          iconBg="rgba(37,99,235,0.28)"
          iconBorder="rgba(96,165,250,0.40)"
          iconColor="#93c5fd"
        />
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <FieldLabel label="NEXT_PUBLIC_SUPABASE_URL" hint="プロジェクトのエンドポイント" />
            <TextInput
              id="supabase-url"
              type="url"
              value={form.supabaseUrl}
              onChange={field('supabaseUrl')}
              placeholder="https://xxxxxxxxxxxx.supabase.co"
            />
          </div>
          <div>
            <FieldLabel label="NEXT_PUBLIC_SUPABASE_ANON_KEY" hint="公開用 JWT キー" />
            <SecretInput
              id="supabase-anon"
              value={form.supabaseAnonKey}
              onChange={field('supabaseAnonKey')}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              visible={vis.supabaseAnonKey}
              onToggle={() => toggleVis('supabaseAnonKey')}
            />
          </div>
        </div>
      </SectionCard>

      {/* ═══ 2. Azure AI Vision (OCR) ═══ */}
      <SectionCard
        delay={0.06}
        accent={{
          bg: 'linear-gradient(150deg, rgba(245,158,11,0.13) 0%, rgba(217,119,6,0.05) 100%)',
          border: 'rgba(245,158,11,0.26)',
        }}
      >
        <SectionHeader
          icon={ScanLine}
          title="Azure AI Vision (OCR)"
          subtitle="名刺の文字を読み取り・構造化するエンジン"
          iconBg="rgba(245,158,11,0.25)"
          iconBorder="rgba(251,191,36,0.38)"
          iconColor="#fcd34d"
        />
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <FieldLabel label="AZURE_OCR_ENDPOINT" hint="Azure: 名刺の文字読み取りに使用" />
            <TextInput
              id="azure-endpoint"
              type="url"
              value={form.azureEndpoint}
              onChange={field('azureEndpoint')}
              placeholder="https://your-resource.cognitiveservices.azure.com/"
            />
          </div>
          <div>
            <FieldLabel label="AZURE_OCR_KEY" hint="Azure ポータルで発行するサブスクリプションキー" />
            <SecretInput
              id="azure-key"
              value={form.azureKey}
              onChange={field('azureKey')}
              placeholder="32文字の英数字キー..."
              visible={vis.azureKey}
              onToggle={() => toggleVis('azureKey')}
            />
          </div>
          <div>
            <FieldLabel label="AZURE_OCR_REGION" hint="データの処理場所 — 日本国内処理を推奨" />
            <SelectInput
              id="azure-region"
              value={form.azureRegion}
              onChange={field('azureRegion')}
              options={AZURE_REGIONS}
            />
            <p style={{
              marginTop: '6px',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.30)',
              lineHeight: '1.6',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '5px',
            }}>
              <span style={{ color: 'rgba(251,191,36,0.60)', flexShrink: 0 }}>✦</span>
              データの処理場所を決定します。日本国内での処理を推奨します。
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ═══ 3. Gemini API ═══ */}
      <SectionCard
        delay={0.12}
        accent={{
          bg: 'linear-gradient(150deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.06) 100%)',
          border: 'rgba(139,92,246,0.26)',
        }}
      >
        <SectionHeader
          icon={Sparkles}
          title="Gemini API"
          subtitle="お礼メール自動生成・AI コンシェルジュに使用"
          iconBg="rgba(139,92,246,0.28)"
          iconBorder="rgba(167,139,250,0.38)"
          iconColor="#c4b5fd"
        />
        <div style={{ padding: '16px 18px' }}>
          <FieldLabel label="GEMINI_API_KEY" hint="Google AI Studio で発行・無料枠あり" />
          <SecretInput
            id="gemini-key"
            value={form.geminiKey}
            onChange={field('geminiKey')}
            placeholder="AIza..."
            visible={vis.geminiKey}
            onToggle={() => toggleVis('geminiKey')}
          />
        </div>
      </SectionCard>

      {/* ═══ Info banner ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.18, duration: 0.24 }}
        style={{
          display: 'flex', gap: '8px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: '12px', padding: '11px 13px',
        }}
      >
        <AlertCircle style={{ width: '14px', height: '14px', color: '#fbbf24', flexShrink: 0, marginTop: '1px' }} strokeWidth={2} />
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.65' }}>
          入力値は <strong style={{ color: 'rgba(255,255,255,0.65)' }}>localStorage</strong> に保存されます。
          本番環境では Vercel の環境変数設定を優先してください。
          APIキーは第三者と共有しないでください。
        </p>
      </motion.div>

      {/* ═══ Validation error ═══ */}
      <AnimatePresence>
        {validationErr && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.30)',
              borderRadius: '10px', padding: '10px 13px',
            }}
          >
            <AlertTriangle style={{ width: '14px', height: '14px', color: '#f87171', flexShrink: 0 }} />
            <p style={{ fontSize: '12px', color: '#fca5a5' }}>
              少なくとも1つのフィールドを入力してから保存してください。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Save Button ═══ */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20, duration: 0.24 }}
        whileHover={hasAnyValue ? { scale: 1.01, boxShadow: '0 8px 28px rgba(6,182,212,0.40)' } : {}}
        whileTap={hasAnyValue ? { scale: 0.97 } : {}}
        onClick={handleSave}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '13px 16px',
          background: hasAnyValue
            ? 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 60%, #06b6d4 100%)'
            : 'rgba(255,255,255,0.05)',
          border: hasAnyValue
            ? '1px solid rgba(6,182,212,0.45)'
            : '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          color: hasAnyValue ? '#ffffff' : 'rgba(255,255,255,0.25)',
          fontSize: '14px', fontWeight: 700,
          cursor: 'pointer',
          boxShadow: hasAnyValue ? '0 4px 20px rgba(6,182,212,0.28)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <Save style={{ width: '15px', height: '15px' }} />
        全設定を保存
      </motion.button>

      {/* ═══ Guide Buttons ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.24 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        <p style={{
          fontSize: '11px', fontWeight: 600,
          color: 'rgba(255,255,255,0.28)', letterSpacing: '0.8px',
          textTransform: 'uppercase', marginBottom: '2px',
        }}>
          ドキュメント
        </p>

        {/* 初期設定ガイド */}
        <motion.a
          href="#"
          whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(16,185,129,0.18)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px',
            background: 'linear-gradient(150deg, rgba(16,185,129,0.14) 0%, rgba(5,150,105,0.06) 100%)',
            border: '1px solid rgba(16,185,129,0.28)', borderRadius: '14px',
            textDecoration: 'none', cursor: 'pointer', transition: 'box-shadow 0.2s ease',
          }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '13px',
            background: 'rgba(16,185,129,0.22)', border: '1px solid rgba(52,211,153,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <BookOpen style={{ width: '18px', height: '18px', color: '#6ee7b7' }} strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              初期設定ガイド
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '2px' }}>
              Supabase・Azure・Gemini の環境構築手順
            </p>
          </div>
          <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.20)', fontSize: '16px' }}>›</div>
        </motion.a>

        {/* AI 取扱説明書 */}
        <motion.a
          href="#"
          whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(139,92,246,0.18)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px',
            background: 'linear-gradient(150deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.06) 100%)',
            border: '1px solid rgba(139,92,246,0.28)', borderRadius: '14px',
            textDecoration: 'none', cursor: 'pointer', transition: 'box-shadow 0.2s ease',
          }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '13px',
            background: 'rgba(139,92,246,0.22)', border: '1px solid rgba(167,139,250,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Bot style={{ width: '18px', height: '18px', color: '#c4b5fd' }} strokeWidth={1.8} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
              AI 取扱説明書
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', marginTop: '2px' }}>
              NotebookLM でインタラクティブに学ぶ
            </p>
          </div>
          <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.20)', fontSize: '16px' }}>›</div>
        </motion.a>
      </motion.div>

      {/* ═══ Danger: Clear All ═══ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.30, duration: 0.22 }}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '12px', padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Key style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.28)' }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>保存済みキーをすべて消去</span>
        </div>
        <motion.button
          type="button"
          whileHover={{ color: '#fca5a5' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClearAll}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '11px', color: 'rgba(239,68,68,0.50)',
            fontWeight: 500, transition: 'color 0.15s ease',
          }}
        >
          クリア
        </motion.button>
      </motion.div>

    </div>
  );
}
