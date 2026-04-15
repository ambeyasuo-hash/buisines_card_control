'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { IdentityPage } from '@/components/IdentityPage';
import { Dashboard } from '@/components/Dashboard';
import { SettingsPage } from '@/components/SettingsPage';
import { LockScreen } from '@/components/LockScreen';
import { PWAInstallGuide } from '@/components/PWAInstallGuide';
import { BackButton } from '@/components/BackButton';
import { NewsTicker } from '@/components/NewsTicker';
import { Camera, List, Settings, CreditCard, LogOut, Contact } from 'lucide-react';
import { getSessionManager, initializeSession, type SessionState } from '@/lib/auth-session';
import { assertWebAuthnCredential } from '@/lib/webauthn';
import { deriveWrappingKeyFromAssertion, unwrapMasterKey } from '@/lib/crypto';

type ActiveTab = 'dashboard' | 'identity' | 'list' | 'rescue';

// Page slide transition
const PAGE = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.24, ease: 'easeOut' as const } },
  exit:    { opacity: 0, x: -20, transition: { duration: 0.18, ease: 'easeIn' as const } },
};

// Sub-pages slide in from right
const SUB_PAGE = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.26, ease: 'easeOut' as const } },
  exit:    { opacity: 0, x: 28, transition: { duration: 0.16, ease: 'easeIn' as const } },
};

const ACTION_CARDS = [
  {
    id: 'scan' as const,
    route: '/scan',
    label: '名刺をスキャン',
    sublabel: 'カメラで撮影してAI解析',
    icon: Camera,
    bg: 'linear-gradient(150deg, rgba(37,99,235,0.30) 0%, rgba(29,78,216,0.12) 100%)',
    border: 'rgba(59,130,246,0.36)',
    iconBg: 'rgba(37,99,235,0.45)',
    iconBorder: 'rgba(96,165,250,0.55)',
    iconColor: '#bfdbfe',
    glow: '0 6px 36px rgba(37,99,235,0.20), inset 0 1px 0 rgba(255,255,255,0.08)',
    hoverGlow: '0 12px 48px rgba(37,99,235,0.32), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
  {
    id: 'list' as const,
    label: '名刺一覧',
    sublabel: '保存済みの名刺を確認',
    icon: List,
    bg: 'linear-gradient(150deg, rgba(16,185,129,0.28) 0%, rgba(5,150,105,0.10) 100%)',
    border: 'rgba(16,185,129,0.34)',
    iconBg: 'rgba(16,185,129,0.42)',
    iconBorder: 'rgba(52,211,153,0.55)',
    iconColor: '#a7f3d0',
    glow: '0 6px 36px rgba(16,185,129,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
    hoverGlow: '0 12px 48px rgba(16,185,129,0.26), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
  {
    id: 'rescue' as const,
    label: '設定',
    sublabel: 'APIキーとプロフィール',
    icon: Settings,
    bg: 'linear-gradient(150deg, rgba(139,92,246,0.28) 0%, rgba(109,40,217,0.10) 100%)',
    border: 'rgba(139,92,246,0.36)',
    iconBg: 'rgba(139,92,246,0.42)',
    iconBorder: 'rgba(167,139,250,0.55)',
    iconColor: '#ddd6fe',
    glow: '0 6px 36px rgba(139,92,246,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
    hoverGlow: '0 12px 48px rgba(139,92,246,0.26), inset 0 1px 0 rgba(255,255,255,0.12)',
  },
];

const SUB_PAGE_TITLES: Record<string, string> = {
  identity: '自分の名刺',
  list: '名刺一覧',
  rescue: '設定',
};

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('LOCKED');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supportsPIN, setSupportsPIN] = useState(false);

  // Initialize session & subscribe to state changes
  useEffect(() => {
    initializeSession();
    const manager = getSessionManager();
    setSessionState(manager.getState());
    setSupportsPIN(manager.isPINEnabled());

    const unsubscribe = manager.onStateChange((newState) => {
      setSessionState(newState);
    });

    return unsubscribe;
  }, []);

  // スキャン完了後の ?tab=list ディープリンク対応
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as ActiveTab | null;
    if (tab && ['list', 'identity', 'rescue'].includes(tab)) {
      setActiveTab(tab);
      // URL をクリーンに戻す
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // WebAuthn 認証ハンドラ
  const handleWebAuthnAuth = async (): Promise<boolean> => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);

      const manager = getSessionManager();
      manager.startAuthenticating();

      // Step 1: WebAuthn assertion を実行
      const assertionResult = await assertWebAuthnCredential();
      if (!assertionResult.success || !assertionResult.signature) {
        throw new Error(assertionResult.message || 'WebAuthn assertion failed');
      }

      // Step 2: Assertion signature から wrapping key を導出
      const wrappingKey = await deriveWrappingKeyFromAssertion(assertionResult.signature);

      // Step 3: Wrapped master key を localStorage から取得して unwrap
      const wrappedKeyB64 = localStorage.getItem('encryption_key_wrapped_b64');
      if (!wrappedKeyB64) {
        throw new Error('Wrapped master key not found. Please register a PIN first.');
      }

      // Step 4: Master key を unwrap
      const masterKey = await unwrapMasterKey(wrappedKeyB64, wrappingKey);

      // Step 5: Session に master key を設定
      manager.setMasterKey(masterKey);
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(msg);
      getSessionManager().onAuthenticationFailed();
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  // PIN 認証ハンドラ
  const handlePINAuth = async (pin: string): Promise<boolean> => {
    try {
      setIsAuthenticating(true);
      setAuthError(null);

      const manager = getSessionManager();
      const success = await manager.authenticateWithPIN(pin);
      if (!success) {
        throw new Error('PIN authentication failed');
      }
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(msg);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  // ログアウトハンドラ
  const handleLogout = () => {
    const manager = getSessionManager();
    manager.lock();
    setActiveTab('dashboard');
  };

  // Lock Screen overlay
  if (sessionState === 'LOCKED') {
    return (
      <LockScreen
        onAuthenticateWebAuthn={handleWebAuthnAuth}
        onAuthenticatePIN={handlePINAuth}
        isAuthenticating={isAuthenticating}
        error={authError || undefined}
        supportsPIN={supportsPIN}
      />
    );
  }

  return (
    <div className="w-full">
      {/* PWA Install Guide */}
      <PWAInstallGuide />

      <AnimatePresence mode="wait">

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" {...PAGE}>

            {/* App Header */}
            <div
              className="flex items-center justify-between px-5 pt-4 pb-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    boxShadow: '0 0 12px rgba(37,99,235,0.45)',
                  }}
                >
                  <CreditCard className="w-3.5 h-3.5 text-white" strokeWidth={2} />
                </div>
                <span className="text-white/90 font-medium text-sm tracking-tight">
                  あんべの名刺代わり
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* My Business Card button */}
                <motion.button
                  whileHover={{ scale: 1.08, backgroundColor: 'rgba(37,99,235,0.20)' }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setActiveTab('identity')}
                  className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-xl"
                  style={{
                    background: 'rgba(37,99,235,0.10)',
                    border: '1px solid rgba(59,130,246,0.28)',
                    color: '#93c5fd',
                    fontSize: '11px',
                    transition: 'background 0.2s ease',
                  }}
                  title="自分の名刺を見る"
                >
                  <Contact className="w-3.5 h-3.5" />
                  <span>自分の名刺</span>
                </motion.button>
                <motion.button
                  whileHover={{ opacity: 0.75, scale: 1.04 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 cursor-pointer"
                  style={{ color: 'rgba(255,255,255,0.32)', fontSize: '11px' }}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ログアウト</span>
                </motion.button>
              </div>
            </div>

            {/* Page Title */}
            <div className="px-5 pt-6 pb-5 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.32 }}
                className="text-[26px] font-bold text-white tracking-tight"
              >
                ダッシュボード
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.32 }}
                className="text-xs mt-1.5 leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.38)' }}
              >
                現場での出会いを最速でお礼メールと資産に変える
              </motion.p>
            </div>

            {/* News Ticker */}
            <div className="px-4">
              <NewsTicker />
            </div>

            {/* Action Cards */}
            <div className="px-4 pb-4" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {ACTION_CARDS.map((card, i) => {
                const Icon = card.icon;
                const isHovered = hoveredCard === card.id;
                return (
                  <motion.button
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14 + i * 0.08, type: 'spring', stiffness: 300, damping: 26 }}
                    whileHover={{ y: -4, scale: 1.018 }}
                    whileTap={{ scale: 0.965 }}
                    onHoverStart={() => setHoveredCard(card.id)}
                    onHoverEnd={() => setHoveredCard(null)}
                    onClick={() => 'route' in card && card.route ? router.push(card.route) : setActiveTab(card.id as ActiveTab)}
                    className="relative w-full rounded-2xl py-7 px-6 flex flex-col items-center gap-4 text-center cursor-pointer backdrop-blur-md"
                    style={{
                      background: card.bg,
                      border: `1px solid ${card.border}`,
                      boxShadow: isHovered ? card.hoverGlow : card.glow,
                      transition: 'box-shadow 0.25s ease',
                    }}
                  >
                    {/* Icon */}
                    <motion.div
                      animate={{ scale: isHovered ? 1.12 : 1, rotate: isHovered ? 6 : 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                      style={{
                        background: card.iconBg,
                        border: `1px solid ${card.iconBorder}`,
                        borderRadius: '18px',
                        width: '72px',
                        height: '72px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: `0 4px 16px ${card.iconBg}`,
                      }}
                    >
                      <Icon
                        style={{ color: card.iconColor, width: '32px', height: '32px' }}
                        strokeWidth={1.5}
                      />
                    </motion.div>

                    {/* Label */}
                    <div>
                      <p className="font-semibold text-white text-[15px] leading-tight">
                        {card.label}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
                        {card.sublabel}
                      </p>
                    </div>

                    {/* Bottom accent glow line */}
                    <motion.div
                      animate={{ opacity: isHovered ? 1 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-0 left-6 right-6 h-px rounded-full"
                      style={{ background: `linear-gradient(90deg, transparent, ${card.border}, transparent)` }}
                    />
                  </motion.button>
                );
              })}
            </div>

            {/* Status Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-2 py-5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 20px 0' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
              />
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                システム正常・準備完了
              </span>
            </motion.div>

          </motion.div>
        )}

        {/* ── SUB PAGES ── */}
        {activeTab !== 'dashboard' && (
          <motion.div key={activeTab} {...SUB_PAGE}>

            {/* Sub-page Header */}
            <div
              className="flex items-center gap-3 px-4 pt-4 pb-3.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <BackButton onClick={() => setActiveTab('dashboard')} />
              <h2 className="text-white font-semibold text-[15px]">
                {SUB_PAGE_TITLES[activeTab]}
              </h2>
            </div>

            {/* Sub-page content */}
            <div className="px-5 pt-5 pb-6">
              {activeTab === 'identity' && <IdentityPage />}
              {activeTab === 'list'     && <Dashboard />}
              {activeTab === 'rescue'   && <SettingsPage />}
            </div>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
