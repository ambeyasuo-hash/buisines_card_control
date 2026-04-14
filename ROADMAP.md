# ROADMAP.md — Phoenix Edition v5.0.6+
// (c) 2026 ambe / Business_Card_Folder

---

## ✅ Phase 1: Zero-Knowledge 基盤構築 (Completed)
- [x] 1.1 端末主権型アーキテクチャ設計
- [x] 1.2 localStorage による API キー管理 (Azure / Supabase)
- [x] 1.3 Supabase クライアントファクトリ (`src/lib/supabase-client.ts`)
- [x] 1.4 設定画面実装 (SettingsPage.tsx) — SQL ウィザード付き

## ✅ Phase 2: スキャン & OCR パイプライン (Completed)
- [x] 2.1 横持ち最適化カメラ UI (scan/page.tsx)
- [x] 2.2 Azure Document Intelligence 統合 (prebuilt-businessCard / prebuilt-read)
- [x] 2.3 Sharp によるサーバーサイド画像前処理 (EXIF 回転 / コントラスト補正)
- [x] 2.4 表面 + 裏面の二段階スキャンフロー
- [x] 2.5 撮影後カメラ即時解放 / 横持ちロック動的制御

## ✅ Phase 3: E2EE データ永続化 (Completed)

### 3.1 クライアントサイド暗号化
- [x] `src/lib/crypto.ts` — AES-256-GCM (Web Crypto API)
- [x] `getOrCreateEncryptionKey` — localStorage からキー取得 / 初回生成
- [x] `encryptData / decryptData` — "v1:\<iv\>:\<ciphertext\>" フォーマット
- [x] 保存前に端末内で暗号化 → PII はネットワークに一切流れない

### 3.2 暗号化キーリカバリ
- [x] `src/lib/vcf.ts` — vCard 3.0 形式でキーを電話帳に保存
- [x] Web Share API (モバイル) / ダウンロード (デスクトップ) フォールバック
- [x] 設定画面に「暗号化キー管理」セクション追加
  - キー生成済みバッジ / 電話帳バックアップ / 再生成 (確認付き)

### 3.3 Supabase 保存 API (Zero-Knowledge プロキシ)
- [x] `POST /api/save-business-card` — encrypted_data のみ受け取る薄いプロキシ
- [x] Supabase URL/Key はリクエストボディで転送 (process.env 不使用)
- [x] Supabase SQL スキーマ更新 (user_id nullable / anon RLS / GRANT anon)

### 3.4 Supabase クライアント最適化 ← **2026-04-14 完了**
- [x] **シングルトンパターン実装** — モジュールスコープで `_instance` をキャッシュ
  - 同一 URL + Key なら既存インスタンスを再利用 → **重複 GoTrueClient 警告解消**
  - URL/Key 変更時は自動再生成 (stale インスタンス問題を防止)
- [x] **`auth.storageKey: 'phoenix-auth-token'`** を明示指定
  - デフォルトの `sb-<projectId>-auth-token` では複数プロジェクト間で競合する可能性
  - 固有キーで物理的にコンテキスト競合を回避
- [x] **`invalidateSupabaseClient()`** エクスポート
  - 設定クリア (`handleClearAll`) 時にキャッシュを明示的に破棄
- [x] **全スキャン確認**: `createClient` 直接呼び出しは `route.ts` (サーバー専用プロキシ) のみ
  - `check-connection.ts` は raw `fetch()` を使用 → 影響なし
  - `.tsx` ファイルに直接 `createClient` 呼び出しなし

## ✅ Phase 3.5: 一覧・閲覧 UI ← **2026-04-14 完了**
**保存済みデータの一覧表示における Zero-Knowledge 復号の完全統合と安定化**

データフロー確認:
- [x] 3.5.1 復号ロジック共通化 — Dashboard.tsx で Supabase から encrypted_data を取得
- [x] 3.5.2 端末内復号 — Web Crypto API + localStorage のマスターキーで AES-256-GCM 復号
- [x] 3.5.3 データ不整合排除 — 復号失敗カードはガード節で除外 + エラーバナー表示
- [x] 3.5.4 ローディング・空状態 — スケルトン表示 + 「名刺をスキャンしてください」誘導 UI
- [x] 3.5.5 サムネイル表示 — 64×40px / object-fit:cover / 縦横名刺対応
- [x] 3.5.6 検索・ソート — クライアント側で復号済みデータに実行

## 🟦 Phase 4: 検索・フィルタ・詳細 (Planned)
**業種フィルタ + 詳細画面 + 連携アクション**

## 🟧 Phase 5: 拡張機能 (Planned)
- [ ] 5.1 industry_category の自動分類 (Gemini によるカテゴリ推定)
- [ ] 5.2 業種フィルタチップの有効化
- [ ] 5.3 名刺詳細画面 / インライン編集 / 削除
- [ ] 5.4 電話 (`tel:`) / メール (`mailto:`) ワンタップアクション
- [ ] 5.5 vCard エクスポート (個別名刺を連絡先へ追加)
- [ ] 5.6 CSV エクスポート (全件一括)

## ⚠️ 実装上の鉄則 (Phoenix Edition)
- **Zero-Knowledge**: サーバーは PII を一切保持しない。暗号文のみ通過
- **端末主権**: 暗号化・鍵管理・画像処理の主権は常にクライアントにある
- **process.env 禁止**: Azure / Supabase のキーを Vercel 環境変数に固定しない
- **生データ送信禁止**: 氏名・連絡先を暗号化前にネットワークに流さない
- **カメラ解放**: 撮影完了後すみやかにストリームを停止する
