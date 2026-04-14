'use client';

/**
 * Dashboard — 名刺一覧 (Zero-Knowledge 対応)
 *
 * データフロー:
 *   1. Supabase から encrypted_data を取得 (credentials は localStorage から)
 *   2. localStorage の AES-256-GCM キーで端末内復号
 *   3. 復号失敗カードはガード節で除外 + エラーバナー表示
 *   4. 検索 / ソートは復号済みデータに対してクライアント側で実行
 */

import { Search, Plus, ChevronDown, RefreshCw, AlertTriangle, Lock, Phone, Mail, MapPin, Briefcase } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase-client';
import { getOrCreateEncryptionKey, decryptData } from '@/lib/crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Supabase から取得する生レコード (暗号化済み) */
interface RawCard {
  id: string;
  encrypted_data: string;
  encryption_key_id: string;
  search_hashes: string[] | null;
  industry_category: string | null;
  scanned_at: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

/** 復号後のカードデータ */
interface DecryptedCard {
  id: string;
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  tel?: string;
  address?: string;
  notes?: string;
  scanned_at: string | null;
  thumbnail_url: string | null;
}

type SortType = 'recent' | 'name';
type LoadState = 'loading' | 'success' | 'error' | 'unconfigured';

// ─── Color palette (index % 3) ───────────────────────────────────────────────

const CARD_COLORS = [
  {
    bg: 'rgba(37,99,235,0.18)',
    border: 'rgba(59,130,246,0.35)',
    accentText: '#bfdbfe',
    badgeBg: 'rgba(37,99,235,0.28)',
    badgeBorder: 'rgba(59,130,246,0.50)',
    dot: '#3b82f6',
  },
  {
    bg: 'rgba(16,185,129,0.16)',
    border: 'rgba(16,185,129,0.35)',
    accentText: '#86efac',
    badgeBg: 'rgba(16,185,129,0.28)',
    badgeBorder: 'rgba(52,211,153,0.50)',
    dot: '#10b981',
  },
  {
    bg: 'rgba(139,92,246,0.18)',
    border: 'rgba(139,92,246,0.35)',
    accentText: '#ddd6fe',
    badgeBg: 'rgba(139,92,246,0.28)',
    badgeBorder: 'rgba(167,139,250,0.50)',
    dot: '#8b5cf6',
  },
];

// ─── Dashboard Component ──────────────────────────────────────────────────────

export function Dashboard() {
  const router = useRouter();

  const [cards,            setCards]            = useState<DecryptedCard[]>([]);
  const [loadState,        setLoadState]        = useState<LoadState>('loading');
  const [errorMsg,         setErrorMsg]         = useState<string | null>(null);
  const [decryptErrCount,  setDecryptErrCount]  = useState(0);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [sortType,         setSortType]         = useState<SortType>('recent');
  const [showSortMenu,     setShowSortMenu]     = useState(false);

  // ── Fetch & Decrypt ───────────────────────────────────────────────────────

  const fetchAndDecrypt = useCallback(async () => {
    setLoadState('loading');
    setErrorMsg(null);
    setDecryptErrCount(0);

    // ① Supabase 設定確認
    if (!isSupabaseConfigured()) {
      setLoadState('unconfigured');
      return;
    }

    try {
      const supabase = createSupabaseClient();

      // ② Supabase からレコード取得 (暗号文のまま)
      const { data, error } = await supabase
        .from('business_cards')
        .select('id, encrypted_data, encryption_key_id, search_hashes, industry_category, scanned_at, thumbnail_url, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        setErrorMsg(error.message);
        setLoadState('error');
        return;
      }

      if (!data || data.length === 0) {
        setCards([]);
        setLoadState('success');
        return;
      }

      // ③ 端末内で AES-256-GCM 復号
      const { key } = await getOrCreateEncryptionKey();
      let errCount = 0;
      const decrypted: DecryptedCard[] = [];

      for (const raw of data as RawCard[]) {
        try {
          const plain = await decryptData<Record<string, string | null>>(
            raw.encrypted_data,
            key,
          );
          decrypted.push({
            id:           raw.id,
            name:         plain.name    ?? undefined,
            company:      plain.company ?? undefined,
            title:        plain.title   ?? undefined,
            email:        plain.email   ?? undefined,
            tel:          plain.tel     ?? undefined,
            address:      plain.address ?? undefined,
            notes:        plain.notes   ?? undefined,
            scanned_at:   raw.scanned_at,
            thumbnail_url: raw.thumbnail_url,
          });
        } catch {
          // ④ ガード節: 復号失敗のカードは除外してカウントのみ
          errCount++;
        }
      }

      setCards(decrypted);
      setDecryptErrCount(errCount);
      setLoadState('success');

    } catch (e) {
      setErrorMsg(String(e));
      setLoadState('error');
    }
  }, []);

  // 初回マウント時にフェッチ
  useEffect(() => {
    fetchAndDecrypt();
  }, [fetchAndDecrypt]);

  // ── Search & Sort ─────────────────────────────────────────────────────────

  const processedCards = useMemo(() => {
    let result = [...cards];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        return (
          c.name?.includes(searchQuery)    ||
          c.company?.includes(searchQuery) ||
          c.title?.includes(searchQuery)   ||
          c.name?.toLowerCase().includes(q)    ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)   ||
          c.tel?.includes(q)
        );
      });
    }

    if (sortType === 'recent') {
      result.sort((a, b) =>
        new Date(b.scanned_at ?? b.id).getTime() -
        new Date(a.scanned_at ?? a.id).getTime(),
      );
    } else {
      result.sort((a, b) =>
        (a.name ?? '').localeCompare(b.name ?? '', 'ja'),
      );
    }

    return result;
  }, [cards, searchQuery, sortType]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const formatDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, padding: '48px 24px',
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw style={{ width: 28, height: 28, color: '#3b82f6' }} />
        </motion.div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>名刺データを読み込み中...</p>
      </div>
    );
  }

  // ── Unconfigured State ────────────────────────────────────────────────────

  if (loadState === 'unconfigured') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14, padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 18,
          background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock style={{ width: 24, height: 24, color: '#fcd34d' }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
          Supabase が未設定です
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>
          設定画面で Supabase URL と<br />Anon Key を入力してください
        </p>
      </div>
    );
  }

  // ── Error State ───────────────────────────────────────────────────────────

  if (loadState === 'error') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 14, padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 18,
          background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle style={{ width: 24, height: 24, color: '#fca5a5' }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.80)' }}>
          データの読み込みに失敗しました
        </p>
        {errorMsg && (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.6, maxWidth: 260 }}>
            {errorMsg}
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={fetchAndDecrypt}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
            background: 'rgba(59,130,246,0.22)', border: '1px solid rgba(59,130,246,0.40)',
            borderRadius: 10, color: '#93c5fd', fontSize: 13, cursor: 'pointer',
          }}
        >
          <RefreshCw style={{ width: 13, height: 13 }} />
          再試行
        </motion.button>
      </div>
    );
  }

  // ── Main List ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 80 }}>

      {/* 復号エラーバナー */}
      <AnimatePresence>
        {decryptErrCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 12,
              background: 'rgba(245,158,11,0.14)',
              border: '1px solid rgba(245,158,11,0.30)',
            }}
          >
            <AlertTriangle style={{ width: 14, height: 14, color: '#fcd34d', flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: '#fcd34d', lineHeight: 1.5 }}>
              {decryptErrCount} 件のカードを復号できませんでした。
              暗号化キーを確認してください。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="名前、企業、メール、電話番号を検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 12,
            padding: '10px 44px 10px 14px',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => {
            e.currentTarget.style.border = '1px solid rgba(59,130,246,0.45)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.10)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <Search style={{
          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
          width: 16, height: 16, color: 'rgba(255,255,255,0.28)', pointerEvents: 'none',
        }} />
      </div>

      {/* Count & Sort */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
          {processedCards.length} 件
        </p>

        {/* リフレッシュ + ソート */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={fetchAndDecrypt}
            title="更新"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.28)', padding: 4, display: 'flex',
            }}
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
          </motion.button>

          <div style={{ position: 'relative' }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSortMenu(!showSortMenu)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, padding: '6px 10px', fontSize: 11,
                color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{sortType === 'recent' ? '新しい順' : '名前順'}</span>
              <ChevronDown style={{ width: 14, height: 14 }} />
            </motion.button>

            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, minWidth: 140, backdropFilter: 'blur(12px)', zIndex: 50,
                  }}
                >
                  {(['recent', 'name'] as SortType[]).map((type) => (
                    <motion.button
                      key={type}
                      onClick={() => { setSortType(type); setShowSortMenu(false); }}
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                      style={{
                        width: '100%', padding: '8px 12px', textAlign: 'left',
                        fontSize: 12, cursor: 'pointer', border: 'none',
                        color: sortType === type ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.50)',
                        background: sortType === type ? 'rgba(59,130,246,0.12)' : 'transparent',
                      }}
                    >
                      {type === 'recent' ? '登録が新しい順' : '名前順（五十音）'}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence>
          {processedCards.length > 0 ? (
            processedCards.map((card, i) => {
              const color = CARD_COLORS[i % 3];
              const initial = (card.name ?? card.company ?? '?')[0];
              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ delay: i * 0.04, duration: 0.20, ease: 'easeOut' }}
                  whileHover={{ y: -2 }}
                  style={{
                    background: color.bg,
                    border: `1px solid ${color.border}`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    cursor: 'default',
                  }}
                >
                  {/* Header row: thumbnail + avatar + name/company */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>

                    {/* サムネイル — object-fit: cover で名刺比率に収める */}
                    {card.thumbnail_url ? (
                      <div style={{
                        width: 64, height: 40, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(0,0,0,0.25)',
                      }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.thumbnail_url}
                          alt={card.name ?? '名刺'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      </div>
                    ) : (
                      /* サムネイルなし: イニシャルアバター */
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: color.badgeBg, border: `1px solid ${color.badgeBorder}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 13, color: color.accentText, fontWeight: 600 }}>
                          {initial}
                        </span>
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.90)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {card.name ?? '（氏名なし）'}
                      </p>
                      {card.company && (
                        <p style={{
                          fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {card.company}
                        </p>
                      )}
                    </div>

                    {/* Date badge */}
                    {card.scanned_at && (
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.26)', flexShrink: 0 }}>
                        {formatDate(card.scanned_at)}
                      </p>
                    )}
                  </div>

                  {/* Details row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {card.title && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Briefcase style={{ width: 10, height: 10, color: color.accentText, flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.title}
                        </p>
                      </div>
                    )}
                    {card.tel && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone style={{ width: 10, height: 10, color: color.accentText, flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>
                          {card.tel}
                        </p>
                      </div>
                    )}
                    {card.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail style={{ width: 10, height: 10, color: color.accentText, flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.email}
                        </p>
                      </div>
                    )}
                    {card.address && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <MapPin style={{ width: 10, height: 10, color: color.accentText, flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.34)', lineHeight: 1.5 }}>
                          {card.address}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '40px 24px' }}
            >
              {searchQuery ? (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>
                  「{searchQuery}」に一致するカードが見つかりません
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 6 }}>
                    まだ名刺が登録されていません
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
                    右下のボタンから名刺をスキャンしてください
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FAB — スキャン画面へ遷移 */}
      <motion.button
        whileHover={{ scale: 1.10 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => router.push('/scan')}
        style={{
          position: 'fixed', bottom: 32, right: 32,
          width: 52, height: 52, borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', border: '1px solid rgba(96,165,250,0.30)',
        }}
        title="名刺をスキャン"
      >
        <Plus style={{ width: 22, height: 22, color: '#fff' }} strokeWidth={2.5} />
      </motion.button>

    </div>
  );
}
