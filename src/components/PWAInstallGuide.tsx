'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2, Plus, X } from 'lucide-react';

type Platform = 'android' | 'ios' | null;

export function PWAInstallGuide() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [showGuide, setShowGuide] = useState(false);

  // ─── Detect installation state ───────────────────────────────────────────────
  useEffect(() => {
    // Check if already installed (standalone mode)
    const isInStandaloneMode = () => {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    if (isInStandaloneMode()) {
      setIsStandalone(true);
      return; // Don't show guide if already installed
    }

    // Detect OS platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
      setShowGuide(true);
    } else if (/android/.test(ua)) {
      setPlatform('android');
    }
  }, []);

  // ─── Android: beforeinstallprompt ───────────────────────────────────────────
  useEffect(() => {
    if (platform !== 'android') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowGuide(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [platform]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsStandalone(true);
      setShowGuide(false);
    }

    setDeferredPrompt(null);
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showGuide && (
        <motion.div
          key="pwa-guide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50"
        >
          {/* Android: Install Button */}
          {platform === 'android' && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(3,102,214,0.10))',
                border: '1px solid rgba(59,130,246,0.30)',
                borderRadius: '12px',
                padding: '14px 16px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    style={{
                      background: 'rgba(37,99,235,0.25)',
                      padding: '8px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Download className="w-4 h-4" style={{ color: '#93c5fd' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 2px 0' }}>
                      アプリとして設置
                    </p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.50)', margin: 0 }}>
                      ホーム画面にショートカットを追加
                    </p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={handleAndroidInstall}
                  style={{
                    background: 'rgba(59,130,246,0.40)',
                    border: '1px solid rgba(93,156,250,0.35)',
                    color: '#93c5fd',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59,130,246,0.60)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59,130,246,0.40)';
                  }}
                >
                  設置
                </motion.button>
              </div>
            </div>
          )}

          {/* iOS: Visual Guide */}
          {platform === 'ios' && (
            <div
              style={{
                position: 'relative',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.10))',
                border: '1px solid rgba(52,211,153,0.30)',
                borderRadius: '12px',
                padding: '14px 16px',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              }}
            >
              {/* Pointer/tail effect */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-8px',
                  right: '20px',
                  width: 0,
                  height: 0,
                  borderLeft: '8px solid transparent',
                  borderRight: '8px solid transparent',
                  borderTop: '8px solid rgba(16,185,129,0.15)',
                }}
              />

              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{
                    background: 'rgba(16,185,129,0.25)',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Share2 className="w-4 h-4" style={{ color: '#6ee7b7' }} />
                </motion.div>

                <div className="flex-1">
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px 0' }}>
                    ホーム画面に追加
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.4, margin: 0 }}>
                    <strong>Safari</strong> の共有ボタン
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      style={{ color: '#6ee7b7' }}
                    >
                      ▼
                    </motion.span>
                    「ホーム画面に追加」を選択してください
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Close button (bottom-right) */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowGuide(false)}
            style={{
              position: 'absolute',
              top: '-10px',
              right: '-10px',
              background: 'rgba(0,0,0,0.40)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.60)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,0,0.40)';
            }}
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.60)' }} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
