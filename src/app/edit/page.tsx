'use client';

/**
 * EditCapturedCard — 名刺スキャン結果の確認・編集画面
 *
 * フロー:
 *   1. ScanPage で OCR 完了後、このページへ遷移
 *   2. localStorage から OCR 結果を読み込み
 *   3. ユーザーが各項目を手動修正可能
 *   4. 位置情報・タグ・メモを追加
 *   5. 「保存」ボタン → Supabase に暗号化して保存
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, ChevronLeft, MapPin, Tag, FileText, AlertCircle, Loader,
  X, Plus,
} from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { getLocation, type LocationCoords } from '@/lib/geolocation';
import { getOrCreateEncryptionKey, encryptData } from '@/lib/crypto';
import { useFontSize } from '@/lib/font-size-context';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OcrResult {
  name?: string;
  company?: string;
  title?: string;
  email?: string;
  tel?: string;
  address?: string;
  raw?: string;
  notes?: string;
  error?: string;
}

interface EditState {
  name: string;
  company: string;
  title: string;
  email: string;
  tel: string;
  address: string;
  notes: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_TEMP = 'edit_capture_temp';
const LS_TAGS = 'user_tags';
const FONT_SIZE_SCALE: Record<string, number> = {
  medium: 1.0,
  large: 1.3,
  'extra-large': 1.6,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditCapturedCardPage() {
  const router = useRouter();
  const { fontSize: fontSizeType } = useFontSize();
  const fontScale = FONT_SIZE_SCALE[fontSizeType] ?? 1.0;

  // State
  const [editState, setEditState] = useState<EditState>({
    name: '',
    company: '',
    title: '',
    email: '',
    tel: '',
    address: '',
    notes: '',
  });

  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── 初期化 ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const initPage = async () => {
      const tempData = localStorage.getItem(LS_TEMP);
      if (!tempData) {
        router.push('/scan');
        return;
      }

      const ocrResult = JSON.parse(tempData) as OcrResult;
      setEditState({
        name: ocrResult.name ?? '',
        company: ocrResult.company ?? '',
        title: ocrResult.title ?? '',
        email: ocrResult.email ?? '',
        tel: ocrResult.tel ?? '',
        address: ocrResult.address ?? '',
        notes: ocrResult.notes ?? '',
      });

      const tagsData = localStorage.getItem(LS_TAGS);
      if (tagsData) {
        setAllTags(JSON.parse(tagsData) as string[]);
      }

      try {
        const loc = await getLocation();
        if ('lat' in loc && 'lng' in loc) {
          setLocation(loc);
        } else {
          setLocationError(loc.message);
        }
      } catch (e) {
        setLocationError('位置情報取得エラー');
      }

      setIsLoading(false);
    };

    initPage();
  }, [router]);

  // ── ハンドラー ────────────────────────────────────────────────────────

  const handleFieldChange = useCallback(
    (field: keyof EditState, value: string) => {
      setEditState(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const addNewTag = useCallback(() => {
    if (!newTagInput.trim()) return;
    const trimmed = newTagInput.trim();
    if (allTags.includes(trimmed)) {
      setNewTagInput('');
      return;
    }
    const updated = [...allTags, trimmed];
    setAllTags(updated);
    setSelectedTags(prev => [...prev, trimmed]);
    localStorage.setItem(LS_TAGS, JSON.stringify(updated));
    setNewTagInput('');
  }, [newTagInput, allTags]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setSaving(true);
    setSaveError(null);

    try {
      const supabaseUrl = localStorage.getItem('supabase_url')?.trim() ?? '';
      const supabaseKey = localStorage.getItem('supabase_anon_key')?.trim() ?? '';

      if (!supabaseUrl || !supabaseKey) {
        setSaveError('Supabase が未設定です。設定画面で URL と Anon Key を入力してください。');
        setSaving(false);
        return;
      }

      const { key } = await getOrCreateEncryptionKey();

      const dataToEncrypt = {
        name: editState.name || null,
        company: editState.company || null,
        title: editState.title || null,
        email: editState.email || null,
        tel: editState.tel || null,
        address: editState.address || null,
        notes: editState.notes || null,
        tags: selectedTags.length > 0 ? selectedTags : null,
        location_lat: location?.lat ?? null,
        location_lng: location?.lng ?? null,
      };

      const encryptedData = await encryptData(dataToEncrypt, key);

      const searchHashes: string[] = [];
      if (editState.company) searchHashes.push(editState.company.toLowerCase().trim());
      if (editState.name) searchHashes.push(editState.name.toLowerCase().trim());

      const res = await fetch('/api/save-business-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encrypted_data: encryptedData,
          encryption_key_id: 'v1',
          search_hashes: searchHashes.length > 0 ? searchHashes : undefined,
          scanned_at: new Date().toISOString(),
          supabaseUrl,
          supabaseKey,
        }),
      });

      const result = await res.json() as { ok: boolean; id?: string; error?: string };

      if (result.ok && result.id) {
        localStorage.removeItem(LS_TEMP);
        router.push('/?tab=list');
      } else {
        setSaveError(result.error ?? '保存に失敗しました。もう一度お試しください。');
      }
    } catch (e) {
      setSaveError(`通信エラー: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [editState, location, selectedTags, isSaving, router]);

  const handleCancel = useCallback(() => {
    localStorage.removeItem(LS_TEMP);
    router.push('/scan');
  }, [router]);

  if (isLoading) {
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
        gap: 12,
      }}>
        <BackButton onClick={handleCancel} />
        <h1 style={{
          fontSize: `${18 * fontScale}px`,
          fontWeight: 700,
          color: '#1e293b',
          margin: 0,
        }}>名刺情報の確認</h1>
      </div>

      {/* メインコンテンツ */}
      <div style={{ maxWidth: 600, margin: '0 auto', padding: `${16 * fontScale}px` }}>
        {/* エラーメッセージ */}
        <AnimatePresence>
          {saveError && (
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
              }}>{saveError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 基本情報入力エリア */}
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
          <h2 style={{
            fontSize: `${16 * fontScale}px`,
            fontWeight: 600,
            color: '#1e293b',
            marginBottom: `${12 * fontScale}px`,
            margin: 0,
          }}>基本情報</h2>

          {/* 名前 */}
          <div style={{ marginBottom: `${14 * fontScale}px` }}>
            <label style={{
              display: 'block',
              fontSize: `${14 * fontScale}px`,
              fontWeight: 600,
              color: '#475569',
              marginBottom: `${6 * fontScale}px`,
            }}>名前</label>
            <input
              type="text"
              value={editState.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              style={{
                width: '100%',
                padding: `${12 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 会社名 */}
          <div style={{ marginBottom: `${14 * fontScale}px` }}>
            <label style={{
              display: 'block',
              fontSize: `${14 * fontScale}px`,
              fontWeight: 600,
              color: '#475569',
              marginBottom: `${6 * fontScale}px`,
            }}>会社名</label>
            <input
              type="text"
              value={editState.company}
              onChange={(e) => handleFieldChange('company', e.target.value)}
              style={{
                width: '100%',
                padding: `${12 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 役職 */}
          <div style={{ marginBottom: `${14 * fontScale}px` }}>
            <label style={{
              display: 'block',
              fontSize: `${14 * fontScale}px`,
              fontWeight: 600,
              color: '#475569',
              marginBottom: `${6 * fontScale}px`,
            }}>役職</label>
            <input
              type="text"
              value={editState.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              style={{
                width: '100%',
                padding: `${12 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* メール */}
          <div style={{ marginBottom: `${14 * fontScale}px` }}>
            <label style={{
              display: 'block',
              fontSize: `${14 * fontScale}px`,
              fontWeight: 600,
              color: '#475569',
              marginBottom: `${6 * fontScale}px`,
            }}>メール</label>
            <input
              type="email"
              value={editState.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              style={{
                width: '100%',
                padding: `${12 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 電話 */}
          <div style={{ marginBottom: `${14 * fontScale}px` }}>
            <label style={{
              display: 'block',
              fontSize: `${14 * fontScale}px`,
              fontWeight: 600,
              color: '#475569',
              marginBottom: `${6 * fontScale}px`,
            }}>電話</label>
            <input
              type="tel"
              value={editState.tel}
              onChange={(e) => handleFieldChange('tel', e.target.value)}
              style={{
                width: '100%',
                padding: `${12 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 住所 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: `${14 * fontScale}px`,
              fontWeight: 600,
              color: '#475569',
              marginBottom: `${6 * fontScale}px`,
            }}>住所</label>
            <input
              type="text"
              value={editState.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              style={{
                width: '100%',
                padding: `${12 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </motion.div>

        {/* 位置情報表示 */}
        {location && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: `${12 * fontScale}px`,
              marginBottom: `${16 * fontScale}px`,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <MapPin size={20} style={{ color: '#0369a1', flexShrink: 0 }} />
            <div>
              <p style={{
                fontSize: `${14 * fontScale}px`,
                color: '#0c4a6e',
                margin: 0,
                fontWeight: 500,
              }}>現在地</p>
              <p style={{
                fontSize: `${12 * fontScale}px`,
                color: '#0369a1',
                margin: `${4 * fontScale}px 0 0 0`,
              }}>
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            </div>
          </motion.div>
        )}
        {locationError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 12,
              padding: `${12 * fontScale}px`,
              marginBottom: `${16 * fontScale}px`,
              fontSize: `${12 * fontScale}px`,
              color: '#991b1b',
            }}
          >
            {locationError}
          </motion.div>
        )}

        {/* タグセクション */}
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

          {/* タグ選択 */}
          <div style={{ marginBottom: `${12 * fontScale}px` }}>
            {allTags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: `${8 * fontScale}px ${12 * fontScale}px`,
                      borderRadius: 20,
                      border: selectedTags.includes(tag)
                        ? '2px solid #0369a1'
                        : '1px solid #cbd5e1',
                      backgroundColor: selectedTags.includes(tag)
                        ? '#e0f2fe'
                        : 'white',
                      color: selectedTags.includes(tag)
                        ? '#0369a1'
                        : '#64748b',
                      fontSize: `${14 * fontScale}px`,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{
                fontSize: `${12 * fontScale}px`,
                color: '#94a3b8',
                margin: 0,
              }}>タグはまだ登録されていません</p>
            )}
          </div>

          {/* 新規タグ入力 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="新しいタグ…"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewTag();
                }
              }}
              style={{
                flex: 1,
                padding: `${10 * fontScale}px`,
                fontSize: `${14 * fontScale}px`,
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={addNewTag}
              style={{
                padding: `${10 * fontScale}px ${16 * fontScale}px`,
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: `${14 * fontScale}px`,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={16} />
              追加
            </button>
          </div>
        </motion.div>

        {/* メモセクション */}
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
          <textarea
            placeholder="この名刺に関する備考（例：○○会議で出会った、〇年後フォローアップ予定など）"
            value={editState.notes}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            style={{
              width: '100%',
              minHeight: `${120 * fontScale}px`,
              padding: `${12 * fontScale}px`,
              fontSize: `${14 * fontScale}px`,
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </motion.div>

        {/* アクションボタン */}
        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: `${24 * fontScale}px`,
        }}>
          <button
            onClick={handleCancel}
            style={{
              flex: 1,
              padding: `${14 * fontScale}px`,
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: 8,
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              flex: 1,
              padding: `${14 * fontScale}px`,
              backgroundColor: isSaving ? '#cbd5e1' : '#0369a1',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: `${16 * fontScale}px`,
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isSaving ? (
              <>
                <Loader size={18} className="animate-spin" />
                保存中…
              </>
            ) : (
              <>
                <Save size={18} />
                保存
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
