'use client';

import { AlertCircle, X, Heart, Key, Phone } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS = [
  {
    step: 'Step 1',
    desc: 'お持ちの携帯電話の電話帳をご確認ください',
    bg: 'rgba(37,99,235,0.10)',
    border: 'rgba(59,130,246,0.26)',
    borderLeft: '#3b82f6',
    textColor: '#93c5fd',
  },
  {
    step: 'Step 2',
    desc: '「安部の名刺代わり」が登録されているか確認',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.24)',
    borderLeft: '#10b981',
    textColor: '#6ee7b7',
  },
  {
    step: 'Step 3',
    desc: '登録済みの場合、そこからデータを復旧します',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.22)',
    borderLeft: '#f59e0b',
    textColor: '#fcd34d',
  },
];

export function ElegantRescue() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        style={{
          background: 'linear-gradient(150deg, rgba(245,158,11,0.16) 0%, rgba(37,99,235,0.10) 100%)',
          border: '1px solid rgba(245,158,11,0.26)',
          borderRadius: '20px',
          padding: '24px 20px',
          textAlign: 'center',
          boxShadow: '0 6px 32px rgba(245,158,11,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            background: 'rgba(245,158,11,0.16)',
            border: '1px solid rgba(251,191,36,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AlertCircle style={{ width: '26px', height: '26px', color: '#fbbf24' }} strokeWidth={1.5} />
          </div>
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'rgba(255,255,255,0.90)', letterSpacing: '-0.2px' }}>
          データ復旧へのご案内
        </h2>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.42)', marginTop: '8px', lineHeight: '1.7' }}>
          不測の事態が発生した場合、<br />
          安全にデータを復旧するためのサポートを提供しています。
        </p>
      </motion.div>

      {/* Recovery Steps */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
          復旧手順
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {STEPS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 + i * 0.08, duration: 0.22, ease: 'easeOut' }}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderLeft: `3px solid ${s.borderLeft}`,
                borderRadius: '12px',
                padding: '12px 14px',
              }}
            >
              <p style={{ fontSize: '11px', fontWeight: 700, color: s.textColor, letterSpacing: '0.5px', marginBottom: '4px' }}>
                {s.step}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', lineHeight: '1.55' }}>
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recovery Link Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.32, duration: 0.24 }}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '14px',
          textAlign: 'center',
        }}
      >
        <motion.button
          whileHover={{ color: 'rgba(147,197,253,0.9)' }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowDialog(true)}
          style={{
            fontSize: '13px',
            color: 'rgba(59,130,246,0.70)',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: '0',
            textDecoration: 'underline',
            textDecorationStyle: 'dotted',
            textUnderlineOffset: '3px',
            transition: 'color 0.15s ease',
          }}
        >
          認証に失敗しましたか？
        </motion.button>
      </motion.div>

      {/* Recovery Dialog */}
      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 100,
              padding: '0 0 16px',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowDialog(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              style={{
                width: '100%',
                maxWidth: '390px',
                background: 'linear-gradient(160deg, #0e1628 0%, #090d18 100%)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '24px 24px 16px 16px',
                overflow: 'hidden',
                boxShadow: '0 -8px 40px rgba(0,0,0,0.50)',
              }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '6px' }}>
                <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '2px' }} />
              </div>

              {/* Dialog Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '10px',
                    background: 'rgba(16,185,129,0.18)',
                    border: '1px solid rgba(52,211,153,0.30)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Heart style={{ width: '14px', height: '14px', color: '#34d399' }} strokeWidth={2} />
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                    やさしい復旧
                  </h3>
                </div>
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowDialog(false)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.38)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <X style={{ width: '14px', height: '14px' }} />
                </motion.button>
              </div>

              {/* Dialog Content */}
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.58)', lineHeight: '1.65' }}>
                  電話帳に{' '}
                  <span style={{ fontWeight: 600, color: '#6ee7b7' }}>「安部の名刺代わり」</span>
                  {' '}が記録されていませんか？
                </p>

                <div style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.20)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.7' }}>
                    通常、初回の接触時に電話帳へ登録いただくと、以降のデータ同期が自動で実行されます。登録済みの場合は、その連絡先から復旧を開始できます。
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowDialog(false)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      padding: '11px 16px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: '10px',
                      color: 'rgba(255,255,255,0.70)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Phone style={{ width: '13px', height: '13px' }} />
                    電話帳を確認する
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01, boxShadow: '0 6px 24px rgba(16,185,129,0.30)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowDialog(false)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      padding: '11px 16px',
                      background: 'linear-gradient(135deg, rgba(16,185,129,0.80), rgba(5,150,105,0.80))',
                      border: '1px solid rgba(52,211,153,0.28)',
                      borderRadius: '10px',
                      color: '#d1fae5',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.20)',
                    }}
                  >
                    <Key style={{ width: '13px', height: '13px' }} />
                    サポートに連絡
                  </motion.button>
                </div>
              </div>

              {/* Dialog Footer */}
              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 20px',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.24)', letterSpacing: '0.2px' }}>
                  ご不安な点は、いつでもお気軽にお問い合わせください。
                </p>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
