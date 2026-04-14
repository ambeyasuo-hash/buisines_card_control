'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Copy, CheckCircle, Zap } from 'lucide-react';

type Secret = { key: string; value: string; desc: string };

const GITHUB_SECRETS: Secret[] = [
  { key: 'SUPABASE_URL', value: 'https://your-project.supabase.co', desc: 'Supabase Project URL' },
  { key: 'SUPABASE_ANON_KEY', value: 'eyJhbGc...', desc: 'Supabase anon key' },
  { key: 'AZURE_ENDPOINT', value: 'https://your-region.cognitiveservices.azure.com/', desc: 'Azure Vision endpoint' },
  { key: 'AZURE_KEY', value: 'your-azure-key', desc: 'Azure Vision key' },
  { key: 'GEMINI_API_KEY', value: 'AIza...', desc: 'Google Gemini API key' },
  { key: 'CRON_SECRET', value: 'your-secret-string', desc: 'Keep-alive secret (自由に設定)' },
];

export function PersistenceGuideSection() {
  const [expanded, setExpanded] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const copyToClipboard = (secret: Secret) => {
    const text = secret.key + '=' + secret.value;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSecret(secret.key);
      setTimeout(() => setCopiedSecret(null), 2000);
    });
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22, duration: 0.24 }}
      style={{
        background: 'linear-gradient(150deg, rgba(16,185,129,0.12) 0%, rgba(59,130,246,0.06) 100%)',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <motion.button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0, width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <Zap style={{ width: '16px', height: '16px', color: 'rgba(16,185,129,0.75)' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
            24時間 Keep-Alive 設定
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.35)' }} />
        </motion.div>
      </motion.button>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.60)', lineHeight: '1.5', margin: 0 }}>
        自分の Fork リポジトリに Secrets を設定すれば、毎日自動で DB が停止しないようにします。
      </p>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div style={{ background: 'rgba(0,0,0,0.30)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {GITHUB_SECRETS.map((s) => (
              <motion.div key={s.key} whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }} onClick={() => copyToClipboard(s)} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}>
                <div style={{ flex: 1, fontSize: '10px' }}>
                  <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{s.key}</div>
                  <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: '9px' }}>{s.desc}</div>
                </div>
                <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={(e) => { e.stopPropagation(); copyToClipboard(s); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: copiedSecret === s.key ? '#10B981' : 'rgba(255,255,255,0.40)', transition: 'color 0.2s ease', flexShrink: 0 }}>
                  {copiedSecret === s.key ? <CheckCircle style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
                </motion.button>
              </motion.div>
            ))}
          </div>
          <div style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '8px', padding: '8px 10px', fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.4' }}>
            <strong>手順:</strong> ① GitHub で Fork ② Settings → Secrets → 各キーを追加 ③ Vercel 再デプロイ
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
