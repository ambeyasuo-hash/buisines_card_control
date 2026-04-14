'use client';

/**
 * Realtime Data Sync Hook
 *
 * Phase 7-3: Supabase Realtime subscription + LWW conflict resolution
 *
 * データフロー:
 *   Device A (edit) → Supabase → Realtime broadcast → Device B (sync)
 */

import React, { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase-client';

// ─── Types ────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  cardId: string;
  updatedAt: string;
  updatedByDeviceId: string;
}

// ─── Conflict Resolution: LWW (Last Write Wins) ─────────────────────────

/**
 * LWW 競合解決ロジック
 *
 * @param localCard ローカルキャッシュのカード
 * @param remoteCard サーバーから取得したカード
 * @returns 採用するカード（local or remote）
 */
export function resolveConflict(
  localCard: any,
  remoteCard: any
): any {
  const localTime = new Date(localCard.updated_at).getTime();
  const remoteTime = new Date(remoteCard.updated_at).getTime();

  if (remoteTime > localTime) {
    console.log(`[LWW] Remote card is newer (${remoteCard.id})`);
    return remoteCard;
  } else {
    console.log(`[LWW] Local card is newer (${localCard.id})`);
    return localCard;
  }
}

// ─── useRealtimeSync Hook ──────────────────────────────────────────────────

/**
 * Supabase Realtime で business_cards の change feed をリッスン
 *
 * @returns { syncStatus, lastSyncedAt, error }
 */
export function useRealtimeSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseClient();

    // Realtime subscription を開始
    const channel = supabase
      .channel('business_cards_realtime', {
        config: {
          broadcast: { self: true }, // Local echo を受け取る
        },
      })
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'business_cards',
        },
        async (payload) => {
          try {
            setSyncStatus('syncing');
            await handleRealtimeUpdate(payload);
            setSyncStatus('synced');
            setLastSyncedAt(new Date().toISOString());
            setError(null);

            // Auto-reset status after 2 seconds
            setTimeout(() => setSyncStatus('idle'), 2000);
          } catch (err) {
            setSyncStatus('error');
            setError((err as Error).message);
            console.error('[useRealtimeSync] Error:', err);
          }
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { syncStatus, lastSyncedAt, error };
}

// ─── Realtime Event Handler ───────────────────────────────────────────────

/**
 * Realtime update を処理
 * LWW で競合を自動解決
 */
async function handleRealtimeUpdate(payload: any) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  console.log(`[Realtime] ${eventType}:`, newRecord?.id);

  // TODO: Implement local database sync
  // const localDB = await getLocalDB();

  if (eventType === 'INSERT') {
    // 新規カード → ローカルに追加
    // await localDB.put('business_cards', newRecord);
    console.log('[Realtime] INSERT:', newRecord.id);
  } else if (eventType === 'UPDATE') {
    // 更新カード → LWW で競合解決
    // const localCard = await localDB.get('business_cards', newRecord.id);
    // if (localCard) {
    //   const resolved = resolveConflict(localCard, newRecord);
    //   await localDB.put('business_cards', resolved);
    // } else {
    //   await localDB.put('business_cards', newRecord);
    // }
    console.log('[Realtime] UPDATE:', newRecord.id);
  } else if (eventType === 'DELETE') {
    // 削除カード → ローカルからも削除
    // await localDB.delete('business_cards', newRecord.id);
    console.log('[Realtime] DELETE:', newRecord.id);
  }
}

// ─── Local Change Queue (Offline Support) ────────────────────────────────

/**
 * ローカルで編集されたカード（オフライン時）を queue に追加
 * 接続復旧時に Supabase へ push
 */
export async function pushLocalChanges() {
  // TODO: Implement local change queue
  // const localDB = await getLocalDB();
  // const changes = await localDB.query('business_cards')
  //   .where('sync_status').equals('pending')
  //   .toArray();

  // for (const card of changes) {
  //   try {
  //     // PATCH Supabase
  //     const { data, error } = await supabase
  //       .from('business_cards')
  //       .update({ ...card, updated_by_device_id: getDeviceUUID() })
  //       .eq('id', card.id);

  //     if (error) throw error;

  //     // Mark as synced
  //     card.sync_status = 'synced';
  //     await localDB.put('business_cards', card);
  //   } catch (err) {
  //     console.error('[pushLocalChanges] Failed:', err);
  //   }
  // }
}

// ─── Sync Status Indicator UI ──────────────────────────────────────────────

/**
 * Dashboard で使用するの sync status インジケーター
 *
 * Usage in Dashboard:
 *   const { syncStatus } = useRealtimeSync();
 *   {syncStatus === 'syncing' && <p>同期中...</p>}
 *   {syncStatus === 'error' && <p className="text-red-400">同期エラー</p>}
 */
export const SyncIndicator = ({ status }: { status: SyncStatus }) => {
  if (status === 'idle' || status === 'synced') return null;

  if (status === 'syncing') {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-spin" />
        同期中...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-xs text-red-400">
        同期エラー。接続を確認してください。
      </div>
    );
  }

  return null;
};

/**
 * Phase 7-3 実装チェックリスト:
 *
 * [ ] Supabase Realtime の有効化（postgres_changes イベント）
 * [ ] useRealtimeSync() を Dashboard.tsx で使用
 * [ ] handleRealtimeUpdate() の local database 実装
 * [ ] LWW conflict resolution の動作確認
 * [ ] pushLocalChanges() の offline queue 実装
 * [ ] 複数デバイス同時編集 → LWW 競合解決テスト
 * [ ] Realtime broadcast delay (<100ms) 確認
 * [ ] オフライン・オンライン の遷移動作確認
 * [ ] Sync status UI の表示・消去タイミング確認
 */
