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

import { Search, ChevronDown, RefreshCw, AlertTriangle, Lock, Phone, Mail, MapPin, Briefcase, X, Copy, Settings, ChevronLeft } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase-client';
import { getOrCreateEncryptionKey, decryptData } from '@/lib/crypto';
import { normalizePersonName, normalizeCompanyName, tokenizeForSearch } from '@/lib/normalize';
import { getSessionManager } from '@/lib/auth-session';

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

// ─── Incremental Decryption Helpers ──────────────────────────────────────────

/**
 * バッチサイズ: 1バッチ内で並列復号する件数
 * Web Crypto は I/O 非同期だが JS コンテキストはメインスレッドを使う。
 * 15件ずつ並列にすることで逐次200往復→14バッチに削減。
 */
const DECRYPT_BATCH_SIZE = 15;

/**
 * メインスレッドにブラウザが UI タスクを処理する機会を与える
 *
 * 優先順位:
 *   1. scheduler.yield() — Chrome 115+ (Frame-aware yield)
 *   2. requestIdleCallback — ブラウザアイドル時に実行
 *   3. setTimeout(0)      — 最低限の yield
 *
 * セキュリティ: CryptoKey はメインスレッド外に渡さない。
 *              yield するだけで Worker に委譲しない。
 */
async function yieldToMain(): Promise<void> {
  type SchedulerWithYield = { yield?: () => Promise<void> };
  const sched = typeof globalThis !== 'undefined' && 'scheduler' in globalThis
    ? (globalThis as unknown as { scheduler: SchedulerWithYield }).scheduler
    : undefined;

  if (typeof sched?.yield === 'function') {
    await sched.yield();
  } else if (typeof requestIdleCallback !== 'undefined') {
    await new Promise<void>((resolve) =>
      requestIdleCallback(() => resolve(), { timeout: 16 }),
    );
  } else {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * 1バッチ分の復号を Promise.allSettled で並列実行
 *
 * ZK 原則: CryptoKey は引数として受け取り、戻り値に含めない。
 *          raw key バイト列はいかなるログにも出力しない。
 */
async function decryptBatch(
  batch: RawCard[],
  key: CryptoKey,
): Promise<{ cards: DecryptedCard[]; errCount: number }> {
  const results = await Promise.allSettled(
    batch.map((raw) =>
      decryptData<Record<string, string | null>>(raw.encrypted_data, key).then(
        (plain): DecryptedCard => ({
          id:            raw.id,
          name:          plain.name    ?? undefined,
          company:       plain.company ?? undefined,
          title:         plain.title   ?? undefined,
          email:         plain.email   ?? undefined,
          tel:           plain.tel     ?? undefined,
          address:       plain.address ?? undefined,
          notes:         plain.notes   ?? undefined,
          scanned_at:    raw.scanned_at,
          thumbnail_url: raw.thumbnail_url,
        }),
      ),
    ),
  );

  const cards: DecryptedCard[] = [];
  let errCount = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') cards.push(r.value);
    else errCount++;
  }
  return { cards, errCount };
}

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

  // ── Fetch & Decrypt (インクリメンタル版) ──────────────────────────────────

  const fetchAndDecrypt = useCallback(async () => {
    setLoadState('loading');
    setCards([]);
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

      // ③ 端末内 AES-256-GCM 復号 — インクリメンタルバッチ処理
      //
      // パフォーマンス設計:
      //   - バッチ内は Promise.allSettled で並列復号（I/O 効率化）
      //   - バッチ間は yieldToMain() でメインスレッドを解放（Jank 防止）
      //   - 第1バッチ完了後に loadState → 'success' へ遷移（体感速度向上）
      //   - setCards を各バッチ後に呼ぶことで先頭カードを即レンダリング
      //
      // Web Worker 採用を見送った理由:
      //   - CryptoKey は structured clone 可能だが非抽出のまま転送すると
      //     key ownership が不明確になりセキュリティ境界が曖昧になる
      //   - 1枚 ~0.5-2ms の復号は CPU ヘビーではなく I/O ヘビー。
      //     yield + 並列化でメインスレッドのブロック時間を実用的なレベルに抑えられる
      //   - Next.js App Router での Worker バンドルは追加設定が必要

      const { key } = await getOrCreateEncryptionKey();
      const rawCards = data as RawCard[];
      const accumulated: DecryptedCard[] = [];
      let totalErrCount = 0;

      for (let i = 0; i < rawCards.length; i += DECRYPT_BATCH_SIZE) {
        const batch = rawCards.slice(i, i + DECRYPT_BATCH_SIZE);
        const { cards: batchCards, errCount: batchErr } = await decryptBatch(batch, key);

        accumulated.push(...batchCards);
        totalErrCount += batchErr;

        // 各バッチ後に状態更新 → プログレッシブレンダリング
        setCards([...accumulated]);
        setDecryptErrCount(totalErrCount);

        // 第1バッチ完了後すぐに success 遷移（最初のカードをすぐ表示）
        if (i === 0) setLoadState('success');

        // 最終バッチ以外はメインスレッドに制御を返す
        if (i + DECRYPT_BATCH_SIZE < rawCards.length) {
          await yieldToMain();
        }
      }

      // 全バッチ完了（第1バッチ前に全件 0 だった場合の保険）
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

  // Session state monitoring
  useEffect(() => {
    const manager = getSessionManager();
    const unsubscribe = manager.onStateChange((state) => {
      // Reset search/sort when session state changes
      if (state === 'LOCKED') {
        setSearchQuery('');
      }
    });
    return unsubscribe;
  }, []);

  // ── Search & Sort ─────────────────────────────────────────────────────────

  const processedCards = useMemo(() => {
    let result = [...cards];

    if (searchQuery.trim()) {
      // 検索クエリを正規化（半角・小文字化）
      const normalizedQuery = normalizePersonName(searchQuery);
      const queryTokens = tokenizeForSearch(normalizedQuery);

      result = result.filter((c) => {
        // 各フィールドを正規化して検索
        const normalizedName = c.name ? normalizePersonName(c.name) : '';
        const normalizedCompany = c.company ? normalizeCompanyName(c.company) : '';
        const normalizedTitle = c.title ? normalizePersonName(c.title) : '';
        const normalizedEmail = c.email ? normalizePersonName(c.email) : '';

        // 正規化されたテキストに検索語が含まれるかチェック
        const nameTokens = tokenizeForSearch(normalizedName);
        const companyTokens = tokenizeForSearch(normalizedCompany);
        const titleTokens = tokenizeForSearch(normalizedTitle);

        return (
          normalizedName.includes(normalizedQuery) ||
          normalizedCompany.includes(normalizedQuery) ||
          normalizedTitle.includes(normalizedQuery) ||
          normalizedEmail.includes(normalizedQuery) ||
          c.tel?.includes(normalizedQuery) ||
          // トークンベースの検索（部分一致対応）
          queryTokens.some(token =>
            nameTokens.some(nt => nt.includes(token) || token.includes(nt)) ||
            companyTokens.some(ct => ct.includes(token) || token.includes(ct)) ||
            titleTokens.some(tt => tt.includes(token) || token.includes(tt))
          )
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
        justifyContent: 'center', gap: 20, padding: '48px 24px',
      }}>
        <span className="lux-dots"><span /><span /><span /></span>
        <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.45)', letterSpacing: '0.06em' }}>
          名刺データを読み込み中
        </p>
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
          名刺を管理するには設定が必要です
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>
          Supabase URL と Anon Key を設定画面で<br />入力すると、名刺の暗号化保存が有効になります
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/?tab=rescue')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
            background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.40)',
            borderRadius: 10, color: '#fcd34d', fontSize: 13, cursor: 'pointer', marginTop: 8,
          }}
        >
          <Settings style={{ width: 14, height: 14 }} />
          設定画面へ
        </motion.button>
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
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
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push('/?tab=rescue')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px',
              background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.40)',
              borderRadius: 10, color: '#fcd34d', fontSize: 13, cursor: 'pointer',
            }}
          >
            <Settings style={{ width: 13, height: 13 }} />
            設定確認
          </motion.button>
        </div>
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
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(59,130,246,0.20)' }}
                  onClick={() => router.push(`/cards/${card.id}`)}
                  style={{
                    background: color.bg,
                    border: `1px solid ${color.border}`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    cursor: 'pointer',
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


    </div>
  );
}
