'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Database, Save, CheckCircle, BookOpen, Bot,
  Eye, EyeOff, AlertCircle, ScanLine, Sparkles, AlertTriangle, ExternalLink, Check, X, Loader, TestTube,
  Copy, Code2, ChevronDown, Shield, Download, RefreshCw, Smartphone, Mail,
} from 'lucide-react';
import { DevicePairingModal } from './DevicePairingModal';
import { PersistenceGuideSection } from './PersistenceGuideSection';
import {
  checkSupabaseConnection,
  checkAzureConnectionViaServer,
  checkGeminiConnection,
  type ConnectionResult,
} from '@/lib/check-connection';
import {
  generateBusinessCardsTableSQL,
  generateSQLEditorUrl,
} from '@/lib/supabase-sql';
import { getOrCreateEncryptionKey, generateEncryptionKey, exportKeyAsBase64, ENCRYPTION_LS_KEY } from '@/lib/crypto';
import { shareOrDownloadVCF } from '@/lib/vcf';
import { invalidateSupabaseClient } from '@/lib/supabase-client';
import { keyB64ToMnemonic } from '@/lib/mnemonic';
import { useFontSize } from '@/lib/font-size-context';
import { AlertTriangle as AlertTriangleIcon } from 'lucide-react';

// ─── localStorage keys ────────────────────────────────────────────────────────
const LS = {
  supabaseUrl:      'supabase_url',
  supabaseAnonKey:  'supabase_anon_key',
  azureEndpoint:    'azure_ocr_endpoint',
  azureKey:         'azure_ocr_key',
  azureRegion:      'azure_ocr_region',
  geminiKey:        'gemini_api_key',
  fontSize:         'app_font_size',
  userEmail:        'user_email',
} as const;

// ─── Font size options ────────────────────────────────────────────────────────
type FontSize = 'medium' | 'large' | 'extra-large';
const FONT_SIZES: { value: FontSize; label: string; scale: number }[] = [
  { value: 'medium',      label: '標準 (Medium)',     scale: 1.0 },
  { value: 'large',       label: '大 (Large)',        scale: 1.3 },
  { value: 'extra-large', label: '特大 (Extra Large)', scale: 1.6 },
];

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

// ─── API Links & Help Text ────────────────────────────────────────────────────
const API_CONFIG = {
  supabase: {
    url: 'https://supabase.com/dashboard/project',
    helpTexts: {
      url: 'Project Settings > API に表示される Project URL をコピー',
      anonKey: 'Project Settings > API > anon public key をコピー',
    },
  },
  azure: {
    url: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/ComputerVision',
    helpTexts: {
      endpoint: 'Endpoints セクションのエンドポイント URL をコピー',
      key: 'Keys and Endpoint セクションのキー1 または キー2 をコピー',
      region: '⚠️ データセンターの場所を決定します。日本リージョンを推奨',
    },
  },
  gemini: {
    url: 'https://aistudio.google.com/app/apikey',
    helpTexts: {
      key: 'APIキーを作成 → コピー',
    },
  },
};

// ─── Validation Functions ─────────────────────────────────────────────────────
function validateSupabaseUrl(url: string): boolean {
  return url.trim().startsWith('https://') && url.includes('.supabase.co');
}

function validateSupabaseKey(key: string): boolean {
  return key.startsWith('eyJ') && key.length > 150;
}

function validateAzureEndpoint(endpoint: string): boolean {
  return endpoint.trim().startsWith('https://') && endpoint.includes('.cognitiveservices.azure.com');
}

function validateAzureKey(key: string): boolean {
  // Azure keys are Base64 strings, typically 32+ characters
  // Allow alphanumeric + Base64 special chars (=, +, /)
  return key.trim().length >= 30;
}

function validateGeminiKey(key: string): boolean {
  return key.startsWith('AIza') && key.length >= 39;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  supabaseUrl:     string;
  supabaseAnonKey: string;
  azureEndpoint:   string;
  azureKey:        string;
  azureRegion:     string;
  geminiKey:       string;
  userEmail:       string;
}

type ValidationState = Record<keyof FormState, 'valid' | 'invalid' | 'empty'>;
type VisibilityState = Record<'supabaseAnonKey' | 'azureKey' | 'geminiKey', boolean>;
type ConnectionStatus = Record<'supabase' | 'azure' | 'gemini', 'idle' | 'checking' | 'success' | 'error'>;
type TestStatus = Record<'supabase' | 'azure' | 'gemini', 'idle' | 'testing' | 'success' | 'error'>;
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
      userEmail:       localStorage.getItem(LS.userEmail)       ?? '',
    };
  } catch {
    return { supabaseUrl: '', supabaseAnonKey: '', azureEndpoint: '', azureKey: '', azureRegion: 'japaneast', geminiKey: '', userEmail: '' };
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
    [LS.userEmail]:       f.userEmail.trim(),
  }).forEach(([k, v]) => {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  });
}

function allEmpty(f: FormState) {
  return !f.supabaseUrl.trim() && !f.supabaseAnonKey.trim() &&
         !f.azureEndpoint.trim() && !f.azureKey.trim() && !f.geminiKey.trim() && !f.userEmail.trim();
}

function computeValidation(f: FormState): ValidationState {
  return {
    supabaseUrl: !f.supabaseUrl.trim() ? 'empty' : validateSupabaseUrl(f.supabaseUrl) ? 'valid' : 'invalid',
    supabaseAnonKey: !f.supabaseAnonKey.trim() ? 'empty' : validateSupabaseKey(f.supabaseAnonKey) ? 'valid' : 'invalid',
    azureEndpoint: !f.azureEndpoint.trim() ? 'empty' : validateAzureEndpoint(f.azureEndpoint) ? 'valid' : 'invalid',
    azureKey: !f.azureKey.trim() ? 'empty' : validateAzureKey(f.azureKey) ? 'valid' : 'invalid',
    azureRegion: f.azureRegion ? 'valid' : 'empty',
    geminiKey: !f.geminiKey.trim() ? 'empty' : validateGeminiKey(f.geminiKey) ? 'valid' : 'invalid',
    userEmail: !f.userEmail.trim() ? 'empty' : (f.userEmail.includes('@') ? 'valid' : 'invalid'),
  };
}

function hasValidPair(f: FormState, v: ValidationState): boolean {
  return (v.supabaseUrl === 'valid' && v.supabaseAnonKey === 'valid') ||
         (v.azureEndpoint === 'valid' && v.azureKey === 'valid') ||
         (v.geminiKey === 'valid');
}

function isSupabaseComplete(f: FormState, v: ValidationState): boolean {
  return v.supabaseUrl === 'valid' && v.supabaseAnonKey === 'valid';
}

function isAzureComplete(f: FormState, v: ValidationState): boolean {
  return v.azureEndpoint === 'valid' && v.azureKey === 'valid' && v.azureRegion === 'valid';
}

function isGeminiComplete(f: FormState, v: ValidationState): boolean {
  return v.geminiKey === 'valid';
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
  validationState,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  validationState?: 'valid' | 'invalid' | 'empty';
}) {
  const getBorderColor = () => {
    if (validationState === 'valid') return 'rgba(16,185,129,0.50)';
    if (validationState === 'invalid') return 'rgba(239,68,68,0.50)';
    return 'rgba(59,130,246,0.50)';
  };

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
          e.currentTarget.style.border = `1px solid ${getBorderColor()}`;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${validationState === 'valid' ? 'rgba(16,185,129,0.12)' : 'rgba(37,99,235,0.12)'}`;
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
  id, value, onChange, placeholder, type = 'text', validationState,
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string; validationState?: 'valid' | 'invalid' | 'empty';
}) {
  const getBorderColor = () => {
    if (validationState === 'valid') return 'rgba(16,185,129,0.50)';
    if (validationState === 'invalid') return 'rgba(239,68,68,0.50)';
    return 'rgba(59,130,246,0.50)';
  };

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
        e.currentTarget.style.border = `1px solid ${getBorderColor()}`;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${validationState === 'valid' ? 'rgba(16,185,129,0.12)' : 'rgba(37,99,235,0.12)'}`;
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

/** Field label with external link + inline help */
function FieldLabelWithLink({
  label,
  helpText,
  externalUrl,
}: {
  label: string;
  helpText: string;
  externalUrl?: string;
}) {
  return (
    <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '6px' }}>
      <div>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px', textTransform: 'uppercase' as const }}>
          {label}
        </span>
      </div>
      {externalUrl && (
        <motion.a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '9px',
            color: 'rgba(59,130,246,0.70)',
            textDecoration: 'none',
            padding: '2px 4px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(59,130,246,1)';
            e.currentTarget.style.background = 'rgba(59,130,246,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(59,130,246,0.70)';
            e.currentTarget.style.background = 'none';
          }}
        >
          <span>管理画面へ</span>
          <ExternalLink style={{ width: '10px', height: '10px' }} />
        </motion.a>
      )}
      <div style={{ width: '100%' }}>
        <p style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.30)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
          💡 {helpText}
        </p>
      </div>
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

/** Connection Status Indicator */
function ConnectionIndicator({
  status,
  label,
}: {
  status: 'idle' | 'checking' | 'success' | 'error';
  label: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <div key="idle" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
        )}
        {status === 'checking' && (
          <motion.div
            key="checking"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ width: '12px', height: '12px' }}
          >
            <Loader style={{ width: '12px', height: '12px', color: 'rgba(251,191,36,0.80)' }} />
          </motion.div>
        )}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ width: '12px', height: '12px' }}
          >
            <Check style={{ width: '12px', height: '12px', color: '#10b981' }} strokeWidth={3} />
          </motion.div>
        )}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ width: '12px', height: '12px' }}
          >
            <X style={{ width: '12px', height: '12px', color: '#ef4444' }} strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>
      <span style={{ color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'rgba(255,255,255,0.50)' }}>
        {label}
      </span>
    </div>
  );
}

/** Test Button */
function TestButton({
  onClick,
  status,
  disabled,
}: {
  onClick: () => void;
  status: 'idle' | 'testing' | 'success' | 'error';
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.93 } : {}}
      onClick={onClick}
      disabled={disabled || status === 'testing'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '6px 11px',
        borderRadius: '8px',
        background:
          status === 'success'
            ? 'rgba(16,185,129,0.20)'
            : status === 'error'
              ? 'rgba(239,68,68,0.15)'
              : 'rgba(99,102,241,0.20)',
        border:
          status === 'success'
            ? '1px solid rgba(52,211,153,0.35)'
            : status === 'error'
              ? '1px solid rgba(248,113,113,0.30)'
              : '1px solid rgba(165,180,252,0.35)',
        color:
          status === 'success'
            ? '#6ee7b7'
            : status === 'error'
              ? '#fca5a5'
              : '#a5b4fc',
        fontSize: '12px',
        fontWeight: 500,
        cursor: disabled || status === 'testing' ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {status === 'testing' ? (
        <>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader style={{ width: '13px', height: '13px' }} />
          </motion.div>
          テスト中...
        </>
      ) : status === 'success' ? (
        <>
          <Check style={{ width: '13px', height: '13px' }} strokeWidth={2.5} />
          成功
        </>
      ) : status === 'error' ? (
        <>
          <AlertCircle style={{ width: '13px', height: '13px' }} strokeWidth={2} />
          失敗
        </>
      ) : (
        <>
          <TestTube style={{ width: '13px', height: '13px' }} strokeWidth={2} />
          テスト
        </>
      )}
    </motion.button>
  );
}

/** Test Result Message */
function TestResult({ result, show }: { result: ConnectionResult; show: boolean }) {
  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        marginTop: '8px',
        padding: '9px 11px',
        borderRadius: '8px',
        background: result.ok ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
        border: result.ok ? '1px solid rgba(52,211,153,0.28)' : '1px solid rgba(248,113,113,0.28)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {result.ok ? (
          <Check style={{ width: '14px', height: '14px', color: '#10b981' }} strokeWidth={2.5} />
        ) : (
          <AlertCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} strokeWidth={2} />
        )}
      </div>
      <p style={{ fontSize: '11px', color: result.ok ? '#6ee7b7' : '#fca5a5', lineHeight: '1.5' }}>
        {result.message}
      </p>
    </motion.div>
  );
}

/** SQL Schema Section */
function SQLSchemaSection({ supabaseUrl }: { supabaseUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const sqlCode = generateBusinessCardsTableSQL();
  const sqlEditorUrl = generateSQLEditorUrl(supabaseUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <details
      open={isOpen}
      onToggle={(e) => {
        const isDetailsOpen = (e?.currentTarget as HTMLDetailsElement)?.open ?? false;
        if (isDetailsOpen !== undefined && isDetailsOpen !== null) {
          setIsOpen(isDetailsOpen);
        }
      }}
      style={{
        marginTop: '16px',
        background: 'rgba(37,99,235,0.06)',
        border: '1px solid rgba(59,130,246,0.20)',
        borderRadius: '12px',
        padding: '0',
        cursor: 'pointer',
      }}
    >
      <summary
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.70)',
          userSelect: 'none',
          listStyle: 'none',
        }}
      >
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown style={{ width: '16px', height: '16px' }} />
        </motion.div>
        <Code2 style={{ width: '14px', height: '14px', color: '#93c5fd' }} />
        <span>SQLスキーマを生成 (Supabase 初期設定用)</span>
      </summary>

      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: isOpen ? 1 : 0, height: isOpen ? 'auto' : 0 }}
        transition={{ duration: 0.2 }}
        style={{ overflow: 'hidden' }}
      >
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(59,130,246,0.15)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Description */}
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.6' }}>
            このSQLをSupabaseのSQL Editorにコピー&ペーストして実行すると、business_cardsテーブルが作成されます。
            暗号化対応、検索インデックス、Row Level Security（RLS）が自動設定されます。
          </p>

          {/* SQL Code Block */}
          <div
            style={{
              background: 'rgba(0,0,0,0.40)',
              border: '1px solid rgba(59,130,246,0.15)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '10px',
              fontFamily: 'monospace',
              color: 'rgba(255,255,255,0.50)',
              maxHeight: '240px',
              overflowY: 'auto',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {sqlCode}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Copy button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: copied ? 'rgba(16,185,129,0.20)' : 'rgba(37,99,235,0.20)',
                border: copied ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(59,130,246,0.35)',
                color: copied ? '#6ee7b7' : '#93c5fd',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? (
                <>
                  <Check style={{ width: '14px', height: '14px' }} strokeWidth={2.5} />
                  コピー完了
                </>
              ) : (
                <>
                  <Copy style={{ width: '14px', height: '14px' }} strokeWidth={2} />
                  SQLをコピー
                </>
              )}
            </motion.button>

            {/* Open SQL Editor button */}
            <motion.a
              href={sqlEditorUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.93 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(99,102,241,0.20)',
                border: '1px solid rgba(165,180,252,0.35)',
                color: '#a5b4fc',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99,102,241,0.30)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99,102,241,0.20)';
              }}
            >
              <ExternalLink style={{ width: '14px', height: '14px' }} strokeWidth={2} />
              SQL Editorで開く
            </motion.a>
          </div>

          {/* Usage steps */}
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)', borderRadius: '8px', padding: '10px 12px' }}>
            <p style={{ fontSize: '10px', color: 'rgba(251,191,36,0.70)', fontWeight: 500, marginBottom: '6px' }}>
              📋 使用手順：
            </p>
            <ol style={{ fontSize: '10px', color: 'rgba(255,255,255,0.40)', lineHeight: '1.6', margin: 0, paddingLeft: '18px' }}>
              <li>上の「SQLをコピー」ボタンをクリック</li>
              <li>「SQL Editorで開く」をクリック（または手動で Supabase ダッシュボード → SQL Editor）</li>
              <li>SQLを貼り付けて「実行」ボタンを押す</li>
              <li>テーブル作成完了！</li>
            </ol>
          </div>
        </div>
      </motion.div>
    </details>
  );
}

// ─── Encryption Key Section ───────────────────────────────────────────────────

/**
 * 暗号化キー管理セクション
 * - 現在のキー状態表示（生成済み / 未生成）
 * - 「電話帳にバックアップ」→ VCF 生成 + Web Share API / ダウンロード
 * - 「キーを再生成」→ 確認付き（古いデータは復号不可になる旨を警告）
 */
function EncryptionKeySection() {
  const [keyExists, setKeyExists]       = useState<boolean | null>(null);
  const [isExporting, setIsExporting]   = useState(false);
  const [isRegen, setIsRegen]           = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [feedback, setFeedback]         = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const k = localStorage.getItem(ENCRYPTION_LS_KEY)?.trim();
    setKeyExists(!!k);
  }, []);

  /** 電話帳バックアップ: VCF 生成 → Web Share / ダウンロード */
  const handleExport = async () => {
    setIsExporting(true);
    setFeedback(null);
    try {
      const { keyB64 } = await getOrCreateEncryptionKey();
      setKeyExists(true);
      await shareOrDownloadVCF(keyB64);
      setFeedback({ ok: true, msg: '暗号化キーを連絡先アプリに保存しました' });
    } catch (e) {
      const err = e as DOMException;
      if (err.name !== 'AbortError') {
        setFeedback({ ok: false, msg: `エラー: ${err.message}` });
      }
    } finally {
      setIsExporting(false);
    }
  };

  /** キー再生成（警告確認付き） */
  const handleRegenerate = async () => {
    if (!confirmRegen) {
      setConfirmRegen(true);
      return;
    }
    setIsRegen(true);
    setConfirmRegen(false);
    try {
      const newKey  = await generateEncryptionKey();
      const keyB64  = await exportKeyAsBase64(newKey);
      localStorage.setItem(ENCRYPTION_LS_KEY, keyB64);
      setKeyExists(true);
      setFeedback({
        ok: false, // 警告色で表示
        msg: '⚠ 新しいキーを生成しました。以前の暗号化データは復号できなくなります。すぐに電話帳へバックアップしてください。',
      });
    } finally {
      setIsRegen(false);
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(150deg, rgba(139,92,246,0.10) 0%, rgba(109,40,217,0.04) 100%)',
        border: '1px solid rgba(139,92,246,0.22)',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '11px', flexShrink: 0,
          background: 'rgba(139,92,246,0.22)', border: '1px solid rgba(167,139,250,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield style={{ width: '17px', height: '17px', color: '#c4b5fd' }} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
            暗号化キー管理
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.40)', marginTop: '1px' }}>
            名刺データは端末内で暗号化されます (E2EE)
          </p>
        </div>
        {/* Status badge */}
        {keyExists !== null && (
          <div style={{
            padding: '3px 9px', borderRadius: '99px', fontSize: '10px', fontWeight: 600,
            background: keyExists ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
            color: keyExists ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${keyExists ? 'rgba(16,185,129,0.30)' : 'rgba(239,68,68,0.30)'}`,
            whiteSpace: 'nowrap',
          }}>
            {keyExists ? '生成済み' : '未生成'}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Info text */}
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)', lineHeight: '1.65' }}>
          名刺データは保存前に AES-256-GCM で端末内暗号化されます。
          キーを紛失するとデータを復号できなくなります。
          電話帳へのバックアップを強く推奨します。
        </p>

        {/* Export to phonebook button */}
        <motion.button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          whileHover={!isExporting ? { y: -1, boxShadow: '0 6px 20px rgba(139,92,246,0.28)' } : {}}
          whileTap={!isExporting ? { scale: 0.97 } : {}}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '11px 16px', borderRadius: '11px', border: 'none', cursor: isExporting ? 'default' : 'pointer',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.55) 0%, rgba(109,40,217,0.45) 100%)',
            color: 'rgba(255,255,255,0.92)', fontSize: '13px', fontWeight: 600,
            opacity: isExporting ? 0.6 : 1, transition: 'opacity 0.2s ease',
          }}
        >
          {isExporting ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <Loader style={{ width: '14px', height: '14px' }} />
            </motion.div>
          ) : (
            <Download style={{ width: '14px', height: '14px' }} />
          )}
          {isExporting ? '準備中...' : '暗号化キーを電話帳にバックアップ'}
        </motion.button>

        {/* Regenerate key button */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <motion.button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegen}
            whileTap={{ scale: 0.96 }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '9px 12px', borderRadius: '10px', cursor: isRegen ? 'default' : 'pointer',
              background: confirmRegen
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${confirmRegen ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.10)'}`,
              color: confirmRegen ? '#fca5a5' : 'rgba(255,255,255,0.42)',
              fontSize: '11px', fontWeight: 500,
              transition: 'all 0.2s ease',
            }}
          >
            {isRegen ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <Loader style={{ width: '12px', height: '12px' }} />
              </motion.div>
            ) : (
              <RefreshCw style={{ width: '12px', height: '12px' }} />
            )}
            {confirmRegen ? '⚠ 本当に再生成する' : 'キーを再生成'}
          </motion.button>

          {confirmRegen && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setConfirmRegen(false)}
              style={{
                padding: '9px 14px', borderRadius: '10px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.42)', fontSize: '11px', fontWeight: 500,
              }}
            >
              キャンセル
            </motion.button>
          )}
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                fontSize: '11px', lineHeight: '1.6', padding: '8px 10px', borderRadius: '8px',
                background: feedback.ok ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: feedback.ok ? '#6ee7b7' : '#fcd34d',
                border: `1px solid ${feedback.ok ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
              }}
            >
              {feedback.msg}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
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

/** Backup Key Display Component */
function BackupKeyDisplay({ userEmail }: { userEmail: string }) {
  const [mnemonic, setMnemonic] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const keyB64 = localStorage.getItem(ENCRYPTION_LS_KEY);
      if (keyB64) {
        setMnemonic(keyB64ToMnemonic(keyB64));
      }
    } catch (error) {
      console.error('Failed to generate mnemonic:', error);
    }
    setMounted(true);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(mnemonic).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleVCFExport = async () => {
    try {
      const keyB64 = localStorage.getItem(ENCRYPTION_LS_KEY);
      if (!keyB64) {
        alert('暗号化キーが見つかりません');
        return;
      }
      await shareOrDownloadVCF(keyB64);
    } catch (error) {
      alert('エクスポートに失敗しました: ' + String(error));
    }
  };

  const handleMailto = () => {
    if (!mnemonic) {
      alert('バックアップキーが見つかりません');
      return;
    }
    const subject = encodeURIComponent('【バックアップ】あんべの名刺代わり・復号キー');
    const body = encodeURIComponent([
      'あんべの名刺代わり — 復号キー バックアップ',
      '',
      '■ シークレットフレーズ（24単語）',
      mnemonic,
      '',
      '※ このメールはクライアント側で生成されたもので、サーバーを経由していません。',
      '※ 重要な情報のため、安全な場所に保管してください。',
    ].join('\n'));
    const mailto = `mailto:${userEmail ? userEmail : ''}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  };

  if (!mounted) return null;

  return (
    <div>
      {mnemonic ? (
        <>
          {/* 24単語表示エリア */}
          <div style={{
            background: 'rgba(0,0,0,0.20)',
            border: '1px solid rgba(168,85,247,0.20)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
            fontFamily: 'monospace',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.70)',
            wordBreak: 'break-all',
            lineHeight: '1.6',
            minHeight: '60px',
          }}>
            {mnemonic}
          </div>

          {/* ボタングループ */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleCopy}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                background: copied ? 'rgba(16,185,129,0.20)' : 'rgba(168,85,247,0.15)',
                border: copied ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(192,132,250,0.30)',
                color: copied ? '#6ee7b7' : '#e9d5ff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'コピー済み' : 'コピー'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleVCFExport}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                background: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(96,165,250,0.30)',
                color: '#93c5fd',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Download size={14} />
              電話帳に保存
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleMailto}
              style={{
                flex: 1,
                minWidth: '120px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                background: 'rgba(251,191,36,0.15)',
                border: '1px solid rgba(251,191,36,0.30)',
                color: '#fcd34d',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Mail size={14} />
              メールで送信
            </motion.button>
          </div>

          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '8px', lineHeight: '1.5' }}>
            ⚠️ <strong>24単語は極秘情報です。</strong>このシークレットフレーズがあれば、端末紛失時にもデータを復旧できます。安全な場所に保管してください。
          </p>
        </>
      ) : (
        <div style={{
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.20)',
          borderRadius: '8px',
          padding: '12px',
          color: 'rgba(255,255,255,0.50)',
          fontSize: '12px',
          textAlign: 'center',
        }}>
          バックアップキーが設定されていません。アプリを初回起動時に設定してください。
        </div>
      )}
    </div>
  );
}

/** Font size selector with segmented control style */
function FontSizeSelector() {
  // ═══════════════════════════════════════════════════════════════
  // Context 参照の保護: useFontSize が null を返す場合の対応
  // ═══════════════════════════════════════════════════════════════
  const context = useFontSize();
  if (!context) {
    return null; // FontSizeProvider の外では render しない
  }
  const { fontSize, setFontSize: setContextFontSize } = context;

  const handleChange = (size: FontSize) => {
    // Single source of truth: use context setFontSize
    setContextFontSize(size);
  };

  const sizes: { value: FontSize; label: string; desc: string }[] = [
    { value: 'medium', label: '標準', desc: 'Medium' },
    { value: 'large', label: '大', desc: 'Large' },
    { value: 'extra-large', label: '特大', desc: 'XL' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
      {sizes.map((size) => {
        const isSelected = fontSize === size.value;
        return (
          <motion.button
            key={size.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => handleChange(size.value)}
            style={{
              padding: '12px 8px',
              background: isSelected
                ? 'linear-gradient(135deg, rgba(139,92,246,0.40), rgba(109,40,217,0.30))'
                : 'rgba(255,255,255,0.05)',
              border: isSelected
                ? '1px solid rgba(167,139,250,0.50)'
                : '1px solid rgba(255,255,255,0.10)',
              borderRadius: '10px',
              color: isSelected ? '#ddd6fe' : 'rgba(255,255,255,0.50)',
              fontSize: '12px',
              fontWeight: isSelected ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: size.value === 'medium' ? '14px' : size.value === 'large' ? '18px' : '22px' }}>
              A
            </span>
            <span style={{ fontSize: '10px' }}>{size.label}</span>
            <span style={{ fontSize: '9px', opacity: 0.6 }}>{size.desc}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SettingsPage() {
  const [form, setForm] = useState<FormState>({
    supabaseUrl: '', supabaseAnonKey: '', azureEndpoint: '', azureKey: '', azureRegion: 'japaneast', geminiKey: '', userEmail: '',
  });
  const [vis, setVis] = useState<VisibilityState>({
    supabaseAnonKey: false, azureKey: false, geminiKey: false,
  });
  // ═══════════════════════════════════════════════════════════════════
  // Phoenix Edition: Default all accordion sections to CLOSED (false)
  // This prevents null reference errors and improves UX
  // ═══════════════════════════════════════════════════════════════════
  const [expandedSections, setExpandedSections] = useState<Record<'supabase' | 'azure' | 'gemini', boolean>>({
    supabase: false, azure: false, gemini: false,
  });
  const [validation, setValidation] = useState<ValidationState>({
    supabaseUrl: 'empty', supabaseAnonKey: 'empty', azureEndpoint: 'empty', azureKey: 'empty', azureRegion: 'empty', geminiKey: 'empty', userEmail: 'empty',
  });
  const [connStatus, setConnStatus] = useState<ConnectionStatus>({
    supabase: 'idle', azure: 'idle', gemini: 'idle',
  });
  const [testStatus, setTestStatus] = useState<TestStatus>({
    supabase: 'idle', azure: 'idle', gemini: 'idle',
  });
  const [testMessages, setTestMessages] = useState<Record<string, ConnectionResult>>({
    supabase: { ok: false, message: '' },
    azure: { ok: false, message: '' },
    gemini: { ok: false, message: '' },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast]     = useState<{ type: ToastType; message: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [showDevicePairingModal, setShowDevicePairingModal] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadStorage();
    setForm(loaded);
    setValidation(computeValidation(loaded));
  }, []);

  const field = useCallback(
    <K extends keyof FormState>(key: K) =>
      (value: string) => {
        const updated = { ...form, [key]: value };
        setForm(updated);
        setValidation(computeValidation(updated));
      },
    [form],
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

  // ── Individual test functions (invoked on button click) ──
  const testSupabase = useCallback(async () => {
    setTestStatus((s) => ({ ...s, supabase: 'testing' }));
    try {
      const result = await checkSupabaseConnection(form.supabaseUrl, form.supabaseAnonKey);
      setTestMessages((m) => ({ ...m, supabase: result }));
      setTestStatus((s) => ({ ...s, supabase: result.ok ? 'success' : 'error' }));
    } catch (err) {
      const result = { ok: false, message: `エラー: ${String(err)}` };
      setTestMessages((m) => ({ ...m, supabase: result }));
      setTestStatus((s) => ({ ...s, supabase: 'error' }));
    }
  }, [form]);

  const testAzure = useCallback(async () => {
    setTestStatus((s) => ({ ...s, azure: 'testing' }));
    try {
      // Use server-side test to avoid CORS issues
      const result = await checkAzureConnectionViaServer(form.azureEndpoint, form.azureKey);
      setTestMessages((m) => ({ ...m, azure: result }));
      setTestStatus((s) => ({ ...s, azure: result.ok ? 'success' : 'error' }));
    } catch (err) {
      const result = { ok: false, message: `エラー: ${String(err)}` };
      setTestMessages((m) => ({ ...m, azure: result }));
      setTestStatus((s) => ({ ...s, azure: 'error' }));
    }
  }, [form]);

  const testGemini = useCallback(async () => {
    setTestStatus((s) => ({ ...s, gemini: 'testing' }));
    try {
      const result = await checkGeminiConnection(form.geminiKey);
      setTestMessages((m) => ({ ...m, gemini: result }));
      setTestStatus((s) => ({ ...s, gemini: result.ok ? 'success' : 'error' }));
    } catch (err) {
      const result = { ok: false, message: `エラー: ${String(err)}` };
      setTestMessages((m) => ({ ...m, gemini: result }));
      setTestStatus((s) => ({ ...s, gemini: 'error' }));
    }
  }, [form]);

  // ── Check all connections on save (existing logic) ──
  const checkConnection = useCallback(async () => {
    setConnStatus({ supabase: 'idle', azure: 'idle', gemini: 'idle' });

    // Supabase check
    if (validation.supabaseUrl === 'valid' && validation.supabaseAnonKey === 'valid') {
      setConnStatus((s) => ({ ...s, supabase: 'checking' }));
      try {
        const result = await checkSupabaseConnection(form.supabaseUrl, form.supabaseAnonKey);
        setConnStatus((s) => ({ ...s, supabase: result.ok ? 'success' : 'error' }));
      } catch {
        setConnStatus((s) => ({ ...s, supabase: 'error' }));
      }
    }

    // Azure check (server-side to avoid CORS)
    if (validation.azureEndpoint === 'valid' && validation.azureKey === 'valid') {
      setConnStatus((s) => ({ ...s, azure: 'checking' }));
      try {
        const result = await checkAzureConnectionViaServer(form.azureEndpoint, form.azureKey);
        setConnStatus((s) => ({ ...s, azure: result.ok ? 'success' : 'error' }));
      } catch {
        setConnStatus((s) => ({ ...s, azure: 'error' }));
      }
    }

    // Gemini check
    if (validation.geminiKey === 'valid') {
      setConnStatus((s) => ({ ...s, gemini: 'checking' }));
      try {
        const result = await checkGeminiConnection(form.geminiKey);
        setConnStatus((s) => ({ ...s, gemini: result.ok ? 'success' : 'error' }));
      } catch {
        setConnStatus((s) => ({ ...s, gemini: 'error' }));
      }
    }
  }, [form, validation]);

  const handleSave = useCallback(async () => {
    if (allEmpty(form)) {
      showToast('error', '少なくとも1つのフィールドを入力してください');
      return;
    }

    if (!hasValidPair(form, validation)) {
      showToast('error', 'すべての必須フィールドが有効な形式である必要があります');
      return;
    }

    setIsSaving(true);
    try {
      // Run connection checks
      await checkConnection();

      // Save to localStorage
      saveStorage(form);
      showToast('success', '設定を更新・確認しました');
    } catch {
      showToast('error', '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [form, validation, checkConnection, showToast]);

  const handleClearAll = useCallback(() => {
    try {
      Object.values(LS).forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    // Supabase シングルトンキャッシュを破棄（古い認証情報が残らないようにする）
    invalidateSupabaseClient();
    const cleared = { supabaseUrl: '', supabaseAnonKey: '', azureEndpoint: '', azureKey: '', azureRegion: 'japaneast', geminiKey: '', userEmail: '' };
    setForm(cleared);
    setValidation(computeValidation(cleared));
    setConnStatus({ supabase: 'idle', azure: 'idle', gemini: 'idle' });
  }, []);

  const hasAnyValue = !allEmpty(form);
  const isSaveDisabled = isSaving || !hasValidPair(form, validation);

  return (
    <div className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-lg p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Toast ── */}
      {toast && <Toast type={toast.type} message={toast.message} visible={toastVisible} />}

      {/* ═══ 1. Supabase ═══ */}
      <details
        open={expandedSections.supabase}
        onToggle={(e) => {
          // ═══════════════════════════════════════════════════════════════════
          // Type-safe details toggle handler with explicit boolean cast
          // ═══════════════════════════════════════════════════════════════════
          try {
            const target = e?.currentTarget as unknown;
            if (target && typeof target === 'object' && 'open' in target && typeof target.open === 'boolean') {
              const isOpen = (target as { open: boolean }).open;
              setExpandedSections(prev => ({ ...prev, supabase: isOpen }));
            }
          } catch (err) {
            // Silently ignore errors, state remains unchanged
          }
        }}
        style={{
          background: 'linear-gradient(150deg, rgba(37,99,235,0.14) 0%, rgba(29,78,216,0.06) 100%)',
          border: '1px solid rgba(59,130,246,0.26)',
          borderRadius: '12px',
          cursor: 'pointer',
        }}
      >
        <summary
          style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            listStyle: 'none',
            userSelect: 'none',
          }}
        >
          <motion.div animate={{ rotate: expandedSections.supabase ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} color="rgba(255,255,255,0.40)" />
          </motion.div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                background: 'rgba(37,99,235,0.28)',
                border: '1px solid rgba(96,165,250,0.40)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Database size={18} color="#93c5fd" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>Supabase 接続設定</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>名刺データの保存・認証に使用</div>
            </div>
          </div>
          {isSupabaseComplete(form, validation) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(16,185,129,0.20)',
              border: '1px solid rgba(52,211,153,0.35)',
              marginLeft: '8px',
            }}>
              <Check size={12} color="#6ee7b7" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6ee7b7' }}>設定済み</span>
            </div>
          )}
        </summary>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: expandedSections.supabase ? 1 : 0, height: expandedSections.supabase ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: 'hidden', padding: '16px 18px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <FieldLabelWithLink
                label="NEXT_PUBLIC_SUPABASE_URL"
                helpText={API_CONFIG.supabase.helpTexts.url}
                externalUrl={API_CONFIG.supabase.url}
              />
              <TextInput
                id="supabase-url"
                type="url"
                value={form.supabaseUrl}
                onChange={field('supabaseUrl')}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                validationState={validation.supabaseUrl}
              />
            </div>
            <div>
              <FieldLabelWithLink
                label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
                helpText={API_CONFIG.supabase.helpTexts.anonKey}
                externalUrl={API_CONFIG.supabase.url}
              />
              <SecretInput
                id="supabase-anon"
                value={form.supabaseAnonKey}
                onChange={field('supabaseAnonKey')}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                visible={vis.supabaseAnonKey}
                onToggle={() => toggleVis('supabaseAnonKey')}
                validationState={validation.supabaseAnonKey}
              />
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <TestButton
                  onClick={testSupabase}
                  status={testStatus.supabase}
                  disabled={validation.supabaseUrl !== 'valid' || validation.supabaseAnonKey !== 'valid'}
                />
                {validation.supabaseUrl === 'valid' && validation.supabaseAnonKey === 'valid' && (
                  <ConnectionIndicator status={connStatus.supabase} label="保存時に確認済み" />
                )}
              </div>
              <TestResult result={testMessages.supabase} show={testStatus.supabase !== 'idle'} />

              {/* SQL Schema section */}
              {form.supabaseUrl.trim() && <SQLSchemaSection supabaseUrl={form.supabaseUrl} />}
            </div>
          </div>
        </motion.div>
      </details>

      {/* ═══ 2. Azure AI Vision (OCR) ═══ */}
      <details
        open={expandedSections.azure}
        onToggle={(e) => {
          try {
            const target = e?.currentTarget as unknown;
            if (target && typeof target === 'object' && 'open' in target && typeof target.open === 'boolean') {
              const isOpen = (target as { open: boolean }).open;
              setExpandedSections(prev => ({ ...prev, azure: isOpen }));
            }
          } catch (err) {
            // Silently ignore errors
          }
        }}
        style={{
          background: 'linear-gradient(150deg, rgba(245,158,11,0.13) 0%, rgba(217,119,6,0.05) 100%)',
          border: '1px solid rgba(245,158,11,0.26)',
          borderRadius: '12px',
          cursor: 'pointer',
        }}
      >
        <summary
          style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            listStyle: 'none',
            userSelect: 'none',
          }}
        >
          <motion.div animate={{ rotate: expandedSections.azure ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} color="rgba(255,255,255,0.40)" />
          </motion.div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                background: 'rgba(245,158,11,0.25)',
                border: '1px solid rgba(251,191,36,0.38)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScanLine size={18} color="#fcd34d" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>Azure AI Vision (OCR)</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>名刺の文字を読み取り・構造化するエンジン</div>
            </div>
          </div>
          {isAzureComplete(form, validation) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(16,185,129,0.20)',
              border: '1px solid rgba(52,211,153,0.35)',
              marginLeft: '8px',
            }}>
              <Check size={12} color="#6ee7b7" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6ee7b7' }}>設定済み</span>
            </div>
          )}
        </summary>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: expandedSections.azure ? 1 : 0, height: expandedSections.azure ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: 'hidden', padding: '16px 18px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <FieldLabelWithLink
                label="AZURE_OCR_ENDPOINT"
                helpText={API_CONFIG.azure.helpTexts.endpoint}
                externalUrl={API_CONFIG.azure.url}
              />
              <TextInput
                id="azure-endpoint"
                type="url"
                value={form.azureEndpoint}
                onChange={field('azureEndpoint')}
                placeholder="https://your-resource.cognitiveservices.azure.com/"
                validationState={validation.azureEndpoint}
              />
            </div>
            <div>
              <FieldLabelWithLink
                label="AZURE_OCR_KEY"
                helpText={API_CONFIG.azure.helpTexts.key}
                externalUrl={API_CONFIG.azure.url}
              />
              <SecretInput
                id="azure-key"
                value={form.azureKey}
                onChange={field('azureKey')}
                placeholder="32文字の英数字キー..."
                visible={vis.azureKey}
                onToggle={() => toggleVis('azureKey')}
                validationState={validation.azureKey}
              />
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <TestButton
                  onClick={testAzure}
                  status={testStatus.azure}
                  disabled={validation.azureEndpoint !== 'valid' || validation.azureKey !== 'valid'}
                />
                {validation.azureEndpoint === 'valid' && validation.azureKey === 'valid' && (
                  <ConnectionIndicator status={connStatus.azure} label="保存時に確認済み" />
                )}
              </div>
              <TestResult result={testMessages.azure} show={testStatus.azure !== 'idle'} />
            </div>
            <div>
              <FieldLabelWithLink
                label="AZURE_OCR_REGION"
                helpText={API_CONFIG.azure.helpTexts.region}
              />
              <SelectInput
                id="azure-region"
                value={form.azureRegion}
                onChange={field('azureRegion')}
                options={AZURE_REGIONS}
              />
            </div>
          </div>
        </motion.div>
      </details>

      {/* ═══ 3. Gemini API ═══ */}
      <details
        open={expandedSections.gemini}
        onToggle={(e) => {
          try {
            const target = e?.currentTarget as unknown;
            if (target && typeof target === 'object' && 'open' in target && typeof target.open === 'boolean') {
              const isOpen = (target as { open: boolean }).open;
              setExpandedSections(prev => ({ ...prev, gemini: isOpen }));
            }
          } catch (err) {
            // Silently ignore errors
          }
        }}
        style={{
          background: 'linear-gradient(150deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.06) 100%)',
          border: '1px solid rgba(139,92,246,0.26)',
          borderRadius: '12px',
          cursor: 'pointer',
        }}
      >
        <summary
          style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            listStyle: 'none',
            userSelect: 'none',
          }}
        >
          <motion.div animate={{ rotate: expandedSections.gemini ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} color="rgba(255,255,255,0.40)" />
          </motion.div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                background: 'rgba(139,92,246,0.28)',
                border: '1px solid rgba(167,139,250,0.38)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="#c4b5fd" />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>Gemini API</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>お礼メール自動生成・AI コンシェルジュに使用</div>
            </div>
          </div>
          {isGeminiComplete(form, validation) && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(16,185,129,0.20)',
              border: '1px solid rgba(52,211,153,0.35)',
              marginLeft: '8px',
            }}>
              <Check size={12} color="#6ee7b7" />
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6ee7b7' }}>設定済み</span>
            </div>
          )}
        </summary>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: expandedSections.gemini ? 1 : 0, height: expandedSections.gemini ? 'auto' : 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: 'hidden', padding: '16px 18px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <FieldLabelWithLink
                label="GEMINI_API_KEY"
                helpText={API_CONFIG.gemini.helpTexts.key}
                externalUrl={API_CONFIG.gemini.url}
              />
              <SecretInput
                id="gemini-key"
                value={form.geminiKey}
                onChange={field('geminiKey')}
                placeholder="AIza..."
                visible={vis.geminiKey}
                onToggle={() => toggleVis('geminiKey')}
                validationState={validation.geminiKey}
              />
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                <TestButton
                  onClick={testGemini}
                  status={testStatus.gemini}
                  disabled={validation.geminiKey !== 'valid'}
                />
                {validation.geminiKey === 'valid' && (
                  <ConnectionIndicator status={connStatus.gemini} label="保存時に確認済み" />
                )}
              </div>
              <TestResult result={testMessages.gemini} show={testStatus.gemini !== 'idle'} />
            </div>
          </div>
        </motion.div>
      </details>

      {/* ═══ Font Size ═══ */}
      <SectionCard
        delay={0.12}
        accent={{
          bg: 'linear-gradient(150deg, rgba(139,92,246,0.14) 0%, rgba(109,40,217,0.06) 100%)',
          border: 'rgba(139,92,246,0.26)',
        }}
      >
        <SectionHeader
          icon={Sparkles}
          title="文字サイズ"
          subtitle="アプリ全体のテキストサイズをカスタマイズ"
          iconBg="rgba(139,92,246,0.28)"
          iconBorder="rgba(167,139,250,0.40)"
          iconColor="#ddd6fe"
        />
        <FontSizeSelector />
      </SectionCard>

      {/* ═══ User Email & Backup Identity ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.26, ease: 'easeOut' }}
        style={{
          background: 'linear-gradient(150deg, rgba(168,85,247,0.14) 0%, rgba(126,34,206,0.06) 100%)',
          border: '1px solid rgba(168,85,247,0.26)',
          borderRadius: '12px',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '11px',
            background: 'rgba(168,85,247,0.28)',
            border: '1px solid rgba(192,132,250,0.40)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Shield size={18} color="#e9d5ff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>
              緊急時のリカバリ
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.38)' }}>
              24単語のバックアップキーを複数の場所に保存できます
            </div>
          </div>
        </div>

        {/* User Email Input */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.60)',
            marginBottom: '6px',
          }}>
            メールアドレス（バックアップ送信先）
          </label>
          <TextInput
            id="user-email"
            type="email"
            value={form.userEmail}
            onChange={field('userEmail')}
            placeholder="your-email@example.com"
            validationState={form.userEmail.trim() ? (form.userEmail.includes('@') ? 'valid' : 'invalid') : 'empty'}
          />
          <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
            ※ メール送信時に自動入力されます
          </p>
        </div>

        {/* Backup Key Display */}
        <BackupKeyDisplay userEmail={form.userEmail} />
      </motion.div>

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

      {/* ═══ Save Button ═══ */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20, duration: 0.24 }}
        whileHover={!isSaveDisabled ? { scale: 1.01, boxShadow: '0 8px 28px rgba(6,182,212,0.40)' } : {}}
        whileTap={!isSaveDisabled ? { scale: 0.97 } : {}}
        onClick={handleSave}
        disabled={isSaveDisabled}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          padding: '13px 16px',
          background: !isSaveDisabled
            ? 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 60%, #06b6d4 100%)'
            : 'rgba(255,255,255,0.05)',
          border: !isSaveDisabled
            ? '1px solid rgba(6,182,212,0.45)'
            : '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          color: !isSaveDisabled ? '#ffffff' : 'rgba(255,255,255,0.25)',
          fontSize: '14px', fontWeight: 700,
          cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
          boxShadow: !isSaveDisabled ? '0 4px 20px rgba(6,182,212,0.28)' : 'none',
          transition: 'all 0.2s ease',
          opacity: isSaveDisabled ? 0.6 : 1,
        }}
      >
        {isSaving ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader style={{ width: '15px', height: '15px' }} />
            </motion.div>
            確認中...
          </>
        ) : (
          <>
            <Save style={{ width: '15px', height: '15px' }} />
            全設定を保存・確認
          </>
        )}
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

      {/* ═══ 4. Encryption Key Management ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20, duration: 0.24 }}
      >
        <EncryptionKeySection />
      </motion.div>

      {/* ═══ 5. Persistence Guide (Keep-Alive 24/7) ═══ */}
      <PersistenceGuideSection />

      {/* ═══ 6. Device Pairing (Phase 7) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.24 }}
        style={{
          background: 'linear-gradient(150deg, rgba(59,130,246,0.12) 0%, rgba(34,197,94,0.06) 100%)',
          border: '1px solid rgba(59,130,246,0.25)', borderRadius: '12px', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Smartphone style={{ width: '16px', height: '16px', color: 'rgba(96,165,250,0.75)' }} />
          <span style={{
            fontSize: '13px', fontWeight: 600,
            color: 'rgba(255,255,255,0.75)' }}>
            複数端末での同期
          </span>
        </div>

        <p style={{
          fontSize: '12px', color: 'rgba(255,255,255,0.60)', lineHeight: '1.5',
          margin: '0 0 8px 0',
        }}>
          スマートフォンと PC など、複数のデバイスであんべを使う場合、QR コードで端末をペアリングして、安全にデータを同期できます。
        </p>

        <motion.button
          whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(59,130,246,0.2)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowDevicePairingModal(true)}
          type="button"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.6) 0%, rgba(34,197,94,0.4) 100%)',
            border: '1px solid rgba(96,165,250,0.4)',
            color: 'rgba(255,255,255,0.85)',
            padding: '10px 16px', borderRadius: '10px',
            fontSize: '13px', fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
        >
          + 端末をペアリング
        </motion.button>
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

      {/* Device Pairing Modal */}
      {showDevicePairingModal && (
        <DevicePairingModal
          onClose={() => setShowDevicePairingModal(false)}
          onPairingComplete={() => {
            setShowDevicePairingModal(false);
            showToast('success', 'ペアリング完了しました！');
          }}
        />
      )}

    </div>
  );
}
