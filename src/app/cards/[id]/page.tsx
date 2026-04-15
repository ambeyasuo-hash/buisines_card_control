'use client';

/**
 * Business Card Detail Page — 名刺詳細表示・編集・削除フロー
 *
 * フロー:
 *   1. URL パラメータから ID を取得
 *   2. Supabase から該当レコードを復号して取得（Zero-Knowledge）
 *   3. 詳細情報を美しく表示
 *   4. 編集ボタン → /cards/[id]/edit へ遷移
 *   5. 削除ボタン → 確認 Modal → API 削除 → 一覧へ戻る
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit2, Trash2, MapPin, Phone, Mail, Briefcase, Tag, FileText,
  AlertCircle, Loader, Copy, ExternalLink,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { createSupabaseClient, isSupabaseConfigured } from '@/lib/supabase-client';
import { getOrCreateEncryptionKey, decryptData } from '@/lib/crypto';
import { useFontSize } from '@/lib/font-size-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawCard {
  id: string;
  encrypted_data: string;
  encryption_key_id: string;
  scanned_at: string | null;
  created_at: string;
}

interface DecryptedCard {
  id: string;
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  tel?: string;
  address?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  notes?: string;
  tags?: string[];
  scanned_at: string | null;
}

type LoadState = 'loading' | 'success' | 'error' | 'not-found';

const FONT_SIZE_SCALE: Record<string, number> = {
  medium: 1.0,
  large: 1.3,
  'extra-large': 1.6,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cardId = params?.id as string | undefined;
  const { fontSize: fontSizeType } = useFontSize();
  const fontScale = FONT_SIZE_SCALE[fontSizeType] ?? 1.0;

  const [card, setCard] = useState<DecryptedCard | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ── Fetch & Decrypt ───────────────────────────────────────────────────────

  const fetchAndDecrypt = useCallback(async () => {
    if (!cardId) {
      setLoadState('not-found');
      return;
    }

    setLoadState('loading');
    setErrorMsg(null);

    if (!isSupabaseConfigured()) {
      setErrorMsg('Supabase が未設定です');
      setLoadState('error');
      return;
    }

    try {
      const supabase = createSupabaseClient();

      // ① ID でレコード取得
      const { data, error } = await supabase
        .from('business_cards')
        .select('id, encrypted_data, encryption_key_id, scanned_at, created_at')
        .eq('id', cardId)
        .single();

      if (error || !data) {
        setLoadState('not-found');
        return;
      }

      // ② 端末内で復号
      const { key } = await getOrCreateEncryptionKey();
      const plain = await decryptData<Record<string, any>>(
        (data as RawCard).encrypted_data,
        key,
      );

      setCard({
        id: (data as RawCard).id,
        name: plain.name ?? undefined,
        company: plain.company ?? undefined,
        title: plain.title ?? undefined,
        email: plain.email ?? undefined,
        tel: plain.tel ?? undefined,
        address: plain.address ?? undefined,
        location_address: plain.location_address ?? undefined,
        location_lat: plain.location_lat ?? undefined,
        location_lng: plain.location_lng ?? undefined,
        notes: plain.notes ?? undefined,
        tags: plain.tags ?? undefined,
        scanned_at: (data as RawCard).scanned_at,
      });

      setLoadState('success');
    } catch (e) {
      setErrorMsg(String(e));
      setLoadState('error');
    }
  }, [cardId]);

  useEffect(() => {
    fetchAndDecrypt();
  }, [fetchAndDecrypt]);

  // ── Copy to Clipboard ──────────────────────────────────────────────────────

  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  // ── Delete Handler ─────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!card) return;

    setIsDeleting(true);

    try {
      const res = await fetch('/api/delete-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: card.id,
          supabaseUrl: localStorage.getItem('supabase_url'),
          supabaseKey: localStorage.getItem('supabase_anon_key'),
        }),
      });

      const result = await res.json() as { ok: boolean; error?: string };

      if (result.ok) {
        router.push('/?tab=list');
      } else {
        setErrorMsg(result.error ?? '削除に失敗しました');
      }
    } catch (e) {
      setErrorMsg(`削除エラー: ${String(e)}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [card, router]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
      }}>
        <Loader size={32} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadState === 'not-found' || !card) {
    return (
      <div style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${16 * fontScale}px`,
      }}>
        <h2 style={{
          fontSize: `${18 * fontScale}px`,
          fontWeight: 600,
          color: '#1e293b',
          marginBottom: `${12 * fontScale}px`,
        }}>名刺が見つかりません</h2>
        <button
          onClick={() => router.push('/?tab=list')}
          style={{
            padding: `${12 * fontScale}px ${16 * fontScale}px`,
            backgroundColor: '#0369a1',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: `${14 * fontScale}px`,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          一覧へ戻る
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      paddingBottom: 80,
    }}>
      {/* ヘッダー */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: `${12 * fontScale}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <BackButton onClick={() => router.push('/?tab=list')} />
        <h1 style={{
          fontSize: `${18 * fontScale}px`,
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
          flex: 1,
        }}>名刺詳細</h1>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push(`/cards/${card.id}/edit`)}
          title="編集"
          style={{
            background: '#0369a1',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            padding: `${8 * fontScale}px ${12 * fontScale}px`,
            cursor: 'pointer',
            fontSize: `${14 * fontScale}px`,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Edit2 size={16} />
          編集
        </motion.button>
      </div>

      {/* メインコンテンツ */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: `${16 * fontScale}px` }}>
        {/* エラーメッセージ */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                padding: `${12 * fontScale}px`,
                marginBottom: `${16 * fontScale}px`,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
              <p style={{
                fontSize: `${14 * fontScale}px`,
                color: '#7f1d1d',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>{errorMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 基本情報セクション */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: 'white',
            borderRadius: 12,
            padding: `${16 * fontScale}px`,
            marginBottom: `${16 * fontScale}px`,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* 氏名・会社 */}
          <div style={{ marginBottom: `${16 * fontScale}px` }}>
            <p style={{
              fontSize: `${24 * fontScale}px`,
              fontWeight: 700,
              color: '#1e293b',
              margin: 0,
              marginBottom: `${4 * fontScale}px`,
            }}>
              {card.name ?? '（氏名なし）'}
            </p>
            {card.company && (
              <p style={{
                fontSize: `${16 * fontScale}px`,
                fontWeight: 500,
                color: '#0369a1',
                margin: 0,
              }}>
                {card.company}
              </p>
            )}
          </div>

          {/* 役職 */}
          {card.title && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: `${12 * fontScale}px`,
            }}>
              <Briefcase size={18} style={{ color: '#0369a1', flexShrink: 0 }} />
              <p style={{
                fontSize: `${14 * fontScale}px`,
                color: '#475569',
                margin: 0,
              }}>
                {card.title}
              </p>
            </div>
          )}

          {/* 電話番号 */}
          {card.tel && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: `${12 * fontScale}px`,
              padding: `${10 * fontScale}px`,
              backgroundColor: '#f1f5f9',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Phone size={18} style={{ color: '#0369a1', flexShrink: 0 }} />
                <p style={{
                  fontSize: `${14 * fontScale}px`,
                  color: '#1e293b',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {card.tel}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => copyToClipboard(card.tel as string, 'tel')}
                style={{
                  background: copiedField === 'tel' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.08)',
                  border: copiedField === 'tel' ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(59,130,246,0.20)',
                  borderRadius: 6,
                  padding: 6,
                  cursor: 'pointer',
                  color: copiedField === 'tel' ? '#22c55e' : '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                title={copiedField === 'tel' ? 'コピーしました' : 'コピー'}
              >
                {copiedField === 'tel' ? (
                  <span style={{ fontSize: 10, fontWeight: 600 }}>✓</span>
                ) : (
                  <Copy size={12} />
                )}
              </motion.button>
            </div>
          )}

          {/* メール */}
          {card.email && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: `${12 * fontScale}px`,
              padding: `${10 * fontScale}px`,
              backgroundColor: '#f1f5f9',
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Mail size={18} style={{ color: '#0369a1', flexShrink: 0 }} />
                <p style={{
                  fontSize: `${14 * fontScale}px`,
                  color: '#1e293b',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {card.email}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => copyToClipboard(card.email as string, 'email')}
                style={{
                  background: copiedField === 'email' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.08)',
                  border: copiedField === 'email' ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(59,130,246,0.20)',
                  borderRadius: 6,
                  padding: 6,
                  cursor: 'pointer',
                  color: copiedField === 'email' ? '#22c55e' : '#0369a1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                title={copiedField === 'email' ? 'コピーしました' : 'コピー'}
              >
                {copiedField === 'email' ? (
                  <span style={{ fontSize: 10, fontWeight: 600 }}>✓</span>
                ) : (
                  <Copy size={12} />
                )}
              </motion.button>
            </div>
          )}

          {/* 住所 */}
          {card.address && (
            <div style={{
              marginBottom: `${12 * fontScale}px`,
              padding: `${10 * fontScale}px`,
              backgroundColor: '#f1f5f9',
              borderRadius: 8,
            }}>
              <p style={{
                fontSize: `${12 * fontScale}px`,
                fontWeight: 600,
                color: '#475569',
                marginBottom: `${4 * fontScale}px`,
                margin: 0,
              }}>会社住所</p>
              <p style={{
                fontSize: `${14 * fontScale}px`,
                color: '#1e293b',
                margin: 0,
                lineHeight: 1.5,
              }}>
                {card.address}
              </p>
            </div>
          )}
        </motion.div>

        {/* 位置情報セクション */}
        {(card.location_address || (card.location_lat && card.location_lng)) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: `${16 * fontScale}px`,
              marginBottom: `${16 * fontScale}px`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <h3 style={{
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: `${12 * fontScale}px`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
            }}>
              <MapPin size={18} />
              交換場所
            </h3>

            {card.location_address && (
              <p style={{
                fontSize: `${14 * fontScale}px`,
                color: '#475569',
                marginBottom: `${12 * fontScale}px`,
                margin: 0,
              }}>
                {card.location_address}
              </p>
            )}

            {card.location_lat && card.location_lng && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const url = `https://www.google.com/maps/search/${card.location_lat},${card.location_lng}`;
                  window.open(url, '_blank');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: `${10 * fontScale}px ${14 * fontScale}px`,
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #bfdbfe',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: `${14 * fontScale}px`,
                  fontWeight: 500,
                }}
              >
                <ExternalLink size={16} />
                Google Maps で開く
              </motion.button>
            )}
          </motion.div>
        )}

        {/* タグセクション */}
        {card.tags && card.tags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: `${16 * fontScale}px`,
              marginBottom: `${16 * fontScale}px`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <h3 style={{
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: `${12 * fontScale}px`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
            }}>
              <Tag size={18} />
              タグ
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {card.tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    padding: `${6 * fontScale}px ${12 * fontScale}px`,
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    borderRadius: 20,
                    fontSize: `${12 * fontScale}px`,
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* メモセクション */}
        {card.notes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: `${16 * fontScale}px`,
              marginBottom: `${16 * fontScale}px`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <h3 style={{
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: `${12 * fontScale}px`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
            }}>
              <FileText size={18} />
              メモ
            </h3>
            <p style={{
              fontSize: `${14 * fontScale}px`,
              color: '#475569',
              margin: 0,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {card.notes}
            </p>
          </motion.div>
        )}

        {/* アクションボタン */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: `${24 * fontScale}px`,
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/cards/${card.id}/edit`)}
            style={{
              flex: 1,
              padding: `${14 * fontScale}px`,
              backgroundColor: '#0369a1',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Edit2 size={18} />
            編集
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDeleteModal(true)}
            style={{
              flex: 1,
              padding: `${14 * fontScale}px`,
              backgroundColor: '#fecaca',
              color: '#dc2626',
              border: 'none',
              borderRadius: 8,
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Trash2 size={18} />
            削除
          </motion.button>
        </div>

        {/* 登録日時 */}
        {card.scanned_at && (
          <p style={{
            fontSize: `${12 * fontScale}px`,
            color: '#94a3b8',
            textAlign: 'center',
            marginTop: `${24 * fontScale}px`,
            margin: 0,
          }}>
            登録: {new Date(card.scanned_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* 削除確認 Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.60)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              padding: `${16 * fontScale}px`,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: 12,
                padding: `${24 * fontScale}px`,
                maxWidth: 400,
                boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
              }}
            >
              <h2 style={{
                fontSize: `${18 * fontScale}px`,
                fontWeight: 700,
                color: '#1e293b',
                margin: 0,
                marginBottom: `${12 * fontScale}px`,
              }}>
                名刺を削除しますか？
              </h2>
              <p style={{
                fontSize: `${14 * fontScale}px`,
                color: '#64748b',
                margin: 0,
                marginBottom: `${20 * fontScale}px`,
                lineHeight: 1.5,
              }}>
                「{card.name ?? card.company ?? '名刺'}」を削除します。この操作は取り消せません。
              </p>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  style={{
                    flex: 1,
                    padding: `${12 * fontScale}px`,
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: `${14 * fontScale}px`,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    padding: `${12 * fontScale}px`,
                    backgroundColor: isDeleting ? '#fecaca' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: `${14 * fontScale}px`,
                    fontWeight: 600,
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    opacity: isDeleting ? 0.5 : 1,
                  }}
                >
                  {isDeleting ? '削除中…' : '削除'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
