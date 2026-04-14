'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Sparkles, Mail, Phone, Globe,
  Copy, Check, Eye, EyeOff, Contact, Send, Key,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ENCRYPTION_LS_KEY } from '@/lib/crypto';
import { keyB64ToMnemonic } from '@/lib/mnemonic';

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

// ── vCard builder ──────────────────────────────────────────────────────────────
function buildVCard(phrase: string): string {
  const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15) + 'Z';
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:あんべの名刺代わり・復号キー',
    'N:復号キー;あんべの名刺代わり;;;',
    `NOTE:シークレットフレーズ：${phrase}`,
    `REV:${now}`,
    'END:VCARD',
  ].join('\r\n');
}

// ── Phrase display: 24 words in a 6×4 grid ────────────────────────────────────
function PhraseGrid({ words }: { words: string[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
      }}
    >
      {words.map((word, i) => (
        <div
          key={i}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '8px',
            padding: '5px 6px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.28)', minWidth: '14px', textAlign: 'right' }}>
            {i + 1}
          </span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.82)', fontWeight: 500, letterSpacing: '0.1px' }}>
            {word}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IdentityPage() {
  const [mnemonic, setMnemonic]       = useState<string | null>(null);
  const [phraseVisible, setPhraseVisible] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);

  // ── フレーズをlocalStorageのキーから生成 ──────────────────────────────────
  useEffect(() => {
    try {
      const keyB64 = localStorage.getItem(ENCRYPTION_LS_KEY);
      if (keyB64) {
        setMnemonic(keyB64ToMnemonic(keyB64));
      } else {
        setMnemonicError('暗号化キーが見つかりません。一度ダッシュボードに戻り、設定を確認してください。');
      }
    } catch (e) {
      setMnemonicError('フレーズの生成に失敗しました。');
    }
  }, []);

  // ── クリップボードにコピー ────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // フォールバック
      const ta = document.createElement('textarea');
      ta.value = mnemonic;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, [mnemonic]);

  // ── 連絡先に保存 (vCard) ─────────────────────────────────────────────────
  const handleSaveContact = useCallback(async () => {
    if (!mnemonic) return;
    const vcf = buildVCard(mnemonic);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });

    // Web Share API (iOS Safari など) を優先
    if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'backup.vcf', { type: 'text/vcard' })] })) {
      try {
        await navigator.share({
          files: [new File([blob], 'ambe_backup_key.vcf', { type: 'text/vcard' })],
          title: 'あんべの名刺代わり・復号キー',
        });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return; // ユーザーキャンセル
      }
    }

    // フォールバック: ダウンロード
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ambe_backup_key.vcf';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [mnemonic]);

  // ── 自分宛メール (mailto) ─────────────────────────────────────────────────
  const handleMailto = useCallback(() => {
    if (!mnemonic) return;
    const subject = encodeURIComponent('【バックアップ】あんべの名刺代わり・復号キー');
    const body = encodeURIComponent(
      [
        'あんべの名刺代わり — 復号キー バックアップ',
        '',
        '以下のシークレットフレーズを安全な場所に保管してください。',
        'このフレーズがあれば、端末を変えても名刺データを復元できます。',
        '',
        '■ シークレットフレーズ（24単語）',
        mnemonic,
        '',
        '※ このメールはクライアント側で生成されたもので、サーバーを経由していません。',
        '※ フレーズは他人に見せないでください。',
      ].join('\n'),
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [mnemonic]);

  const words = mnemonic ? mnemonic.split(' ') : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Profile Hero Card ─────────────────────────────────────────────── */}
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

      {/* ── Expertise Areas ───────────────────────────────────────────────── */}
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

      {/* ── Contact Info ──────────────────────────────────────────────────── */}
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

      {/* ══════════════════════════════════════════════════════════════════════
          バックアップキー セクション
          ══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.28 }}
        style={{
          background: 'linear-gradient(150deg, rgba(217,119,6,0.14) 0%, rgba(180,83,9,0.08) 100%)',
          border: '1px solid rgba(251,191,36,0.24)',
          borderRadius: '16px',
          padding: '18px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(251,191,36,0.16)',
            border: '1px solid rgba(251,191,36,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Key style={{ width: '14px', height: '14px', color: '#fbbf24' }} strokeWidth={2} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>
              データ復元キー
            </p>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '1px' }}>
              端末紛失・機種変更時の備え
            </p>
          </div>
        </div>

        {/* 説明文 */}
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', lineHeight: '1.7' }}>
          下の24単語を紙に書き留めるか、自分宛てにメールしておくと、
          端末を変えたときでも名刺データをそのまま引き継げます。
        </p>

        {/* フレーズ表示エリア */}
        {mnemonicError ? (
          <div style={{
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12px',
            color: 'rgba(252,165,165,0.80)',
          }}>
            {mnemonicError}
          </div>
        ) : (
          <div style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(251,191,36,0.18)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {/* show/hide toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>
                シークレットフレーズ（24単語）
              </span>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setPhraseVisible((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: '10px',
                }}
              >
                {phraseVisible
                  ? <><EyeOff style={{ width: '10px', height: '10px' }} />隠す</>
                  : <><Eye style={{ width: '10px', height: '10px' }} />表示</>}
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {phraseVisible ? (
                <motion.div
                  key="visible"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <PhraseGrid words={words} />
                </motion.div>
              ) : (
                <motion.div
                  key="hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '8px',
                    border: '1px dashed rgba(255,255,255,0.10)',
                  }}
                >
                  <EyeOff style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.22)' }} />
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)' }}>
                    「表示」を押すとフレーズが見えます
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* アクションボタン 3本 */}
        {mnemonic && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* コピー */}
            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleCopy}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '11px 16px',
                background: copied
                  ? 'rgba(16,185,129,0.20)'
                  : 'rgba(255,255,255,0.07)',
                border: copied
                  ? '1px solid rgba(52,211,153,0.40)'
                  : '1px solid rgba(255,255,255,0.13)',
                borderRadius: '10px',
                cursor: 'pointer',
                color: copied ? '#6ee7b7' : 'rgba(255,255,255,0.70)',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'background 0.2s, border 0.2s, color 0.2s',
              }}
            >
              {copied
                ? <><Check style={{ width: '14px', height: '14px' }} />コピーしました</>
                : <><Copy style={{ width: '14px', height: '14px' }} />クリップボードにコピー</>}
            </motion.button>

            {/* 連絡先に保存 */}
            <motion.button
              whileHover={{ scale: 1.015, boxShadow: '0 6px 24px rgba(37,99,235,0.28)' }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSaveContact}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '11px 16px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                border: '1px solid rgba(96,165,250,0.28)',
                borderRadius: '10px',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(37,99,235,0.24)',
                letterSpacing: '0.1px',
              }}
            >
              <Contact style={{ width: '14px', height: '14px' }} strokeWidth={2} />
              連絡先に保存（.vcf）
            </motion.button>

            {/* 自分宛メール */}
            <motion.button
              whileHover={{ scale: 1.015, boxShadow: '0 6px 24px rgba(217,119,6,0.24)' }}
              whileTap={{ scale: 0.97 }}
              onClick={handleMailto}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '11px 16px',
                background: 'linear-gradient(135deg, rgba(217,119,6,0.55), rgba(180,83,9,0.45))',
                border: '1px solid rgba(251,191,36,0.32)',
                borderRadius: '10px',
                cursor: 'pointer',
                color: '#fef3c7',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(217,119,6,0.16)',
                letterSpacing: '0.1px',
              }}
            >
              <Send style={{ width: '14px', height: '14px' }} strokeWidth={2} />
              自分宛にメールで送る
            </motion.button>

          </div>
        )}

        {/* 注意書き */}
        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', lineHeight: '1.6', textAlign: 'center' }}>
          このフレーズはサーバーに送信されません。端末のみで管理されます。
        </p>
      </motion.div>

      {/* ── Philosophy Quote ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.42, duration: 0.30 }}
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
