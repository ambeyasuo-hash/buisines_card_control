'use client';

import { Download, Shield, Sparkles, Mail, Phone, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

const EXPERTISE = [
  {
    title: '飲食業 DX 実装',
    desc: 'POS システム統合、顧客データ管理、在庫最適化ソリューション',
    bg: 'rgba(37,99,235,0.12)',
    border: 'rgba(59,130,246,0.28)',
    dotColor: '#60a5fa',
    textColor: '#93c5fd',
  },
  {
    title: 'AI 実装コンサル',
    desc: 'ビジネスロジック設計、エンドツーエンド実装、長期運用支援',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.26)',
    dotColor: '#34d399',
    textColor: '#6ee7b7',
  },
];

const CONTACT = [
  { icon: Mail, label: 'contact@ambe.dev' },
  { icon: Phone, label: '+81-90-xxxx-xxxx' },
  { icon: Globe, label: 'ambe.dev' },
];

export function IdentityPage() {
  const handleVCardExport = () => {
    alert('✨ vCard が生成されました。(デモ)\n\nダウンロード機能は Phase 1-2 で実装予定です。');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Profile Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.30, ease: 'easeOut' }}
        style={{
          background: 'linear-gradient(150deg, rgba(37,99,235,0.22) 0%, rgba(16,185,129,0.12) 100%)',
          border: '1px solid rgba(59,130,246,0.30)',
          borderRadius: '20px',
          padding: '28px 20px 24px',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(37,99,235,0.14), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}
      >
        {/* Avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.55), rgba(37,99,235,0.55))',
              border: '1.5px solid rgba(52,211,153,0.40)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 28px rgba(16,185,129,0.22)',
            }}
          >
            <Sparkles style={{ width: '32px', height: '32px', color: '#a7f3d0' }} strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Name */}
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'rgba(255,255,255,0.93)', letterSpacing: '-0.3px' }}>
          安部ヤスオ
        </h2>
        <p style={{ fontSize: '12px', color: '#6ee7b7', fontWeight: 500, marginTop: '4px', letterSpacing: '0.3px' }}>
          Business Card Folder Architect
        </p>

        {/* Trust Indicator */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          marginTop: '14px',
          background: 'rgba(16,185,129,0.14)',
          border: '1px solid rgba(52,211,153,0.28)',
          borderRadius: '20px',
          padding: '4px 12px',
        }}>
          <Shield style={{ width: '11px', height: '11px', color: '#34d399' }} />
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.3px' }}>
            Zero-Knowledge Architecture
          </span>
        </div>
      </motion.div>

      {/* Expertise Areas */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', marginBottom: '10px', textTransform: 'uppercase' }}>
          専門領域
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {EXPERTISE.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.24, ease: 'easeOut' }}
              style={{
                background: item.bg,
                border: `1px solid ${item.border}`,
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.dotColor, flexShrink: 0 }} />
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                  {item.title}
                </p>
              </div>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.42)', lineHeight: '1.6', paddingLeft: '14px' }}>
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Contact Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.24 }}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '14px',
          padding: '14px 16px',
        }}
      >
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
          連絡先
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {CONTACT.map(({ icon: Icon, label }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.52)' }}>{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* vCard Export Button */}
      <motion.button
        whileHover={{ scale: 1.02, boxShadow: '0 8px 32px rgba(37,99,235,0.38)' }}
        whileTap={{ scale: 0.97 }}
        onClick={handleVCardExport}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '13px 20px',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          border: '1px solid rgba(96,165,250,0.28)',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(37,99,235,0.28)',
          letterSpacing: '0.2px',
        }}
      >
        <Download style={{ width: '15px', height: '15px' }} strokeWidth={2} />
        vCard を出力
      </motion.button>

      {/* Philosophy Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.38, duration: 0.30 }}
        style={{
          borderLeft: '2px solid rgba(52,211,153,0.40)',
          paddingLeft: '14px',
          paddingTop: '8px',
          paddingBottom: '8px',
        }}
      >
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.36)', lineHeight: '1.7', fontStyle: 'italic' }}>
          「軍用レベルの堅牢性と、隣人に寄り添う優しさ」を体現するシステムづくりを信条としています。
        </p>
      </motion.div>

    </div>
  );
}
