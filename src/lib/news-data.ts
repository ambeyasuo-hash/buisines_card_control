/**
 * News & Updates Data
 * Used for Ticker and News History page
 */

export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  type: 'feature' | 'fix' | 'improvement' | 'security';
  version?: string;
}

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'news-7-2',
    title: 'Multi-Device QR Pairing & E2EE Key Transfer 完成',
    description: '複数デバイス間でマスターキーをセキュアに共有できるようになりました。QRコード経由のペアリングで簡単にセットアップ可能です。',
    date: '2026-04-14',
    type: 'feature',
    version: 'v7.2',
  },
  {
    id: 'news-7-1',
    title: 'Phase 7-1 完成 — WebAuthn + 生体認証強化',
    description: 'FaceID・指紋認証でマスターキーを二重保護。セキュアエンクレーブとの統合により、キャッシュ抜き出し攻撃を物理的に無効化します。',
    date: '2026-04-13',
    type: 'security',
    version: 'v7.1',
  },
  {
    id: 'news-6-6',
    title: 'PIN Fallback 認証が利用可能に',
    description: 'WebAuthn非対応環境でも4～8桁のPINコードでセキュアに保護。すべてのデバイスで最低限の保護を保証します。',
    date: '2026-04-12',
    type: 'feature',
    version: 'v6.6',
  },
  {
    id: 'news-6-5',
    title: '検証・テスト完了 — Phase 6 安定化',
    description: 'WebAuthn対応ブラウザで完全動作確認。セッション管理の15分タイマーも正常に動作しています。',
    date: '2026-04-11',
    type: 'improvement',
    version: 'v6.5',
  },
  {
    id: 'news-6-4',
    title: 'UI/UX 整合性調整完了',
    description: 'ロック画面と高度なリカバリ設定を実装。「電話帳に保存」のトーン変更により、ユーザーの安心感を向上。',
    date: '2026-04-10',
    type: 'improvement',
    version: 'v6.4',
  },
  {
    id: 'news-6-1',
    title: 'WebAuthn 登録フロー実装完了',
    description: 'Identity ページでのシームレスなPasskey登録が可能に。credential生成と公開鍵の保存もセキュアです。',
    date: '2026-04-09',
    type: 'feature',
    version: 'v6.1',
  },
  {
    id: 'news-5-audit',
    title: 'Zero-Knowledge Communication 検証完了',
    description: 'Phase 5 監査レポートが確定。Blind Indexing による高速検索とデータ秘匿の両立を確認しました。',
    date: '2026-04-08',
    type: 'security',
    version: 'v5.0',
  },
  {
    id: 'news-3-5',
    title: 'ダッシュボード検索最適化',
    description: 'Zero-Knowledge復号の完全統合により、ユーザーデータの秘匿性を保ちながら高速検索が実現。',
    date: '2026-04-07',
    type: 'improvement',
    version: 'v3.5',
  },
];

export function getNewsTicker(): string {
  if (NEWS_ITEMS.length === 0) return '';
  // Cycle through recent news items for ticker display
  const now = new Date();
  const index = Math.floor(now.getTime() / 8000) % NEWS_ITEMS.length;
  return NEWS_ITEMS[index].title;
}

export function getNewsById(id: string): NewsItem | undefined {
  return NEWS_ITEMS.find(item => item.id === id);
}
