## design_doc.md v1.5
（c）2026 ambe / Business_Card_Folder

最終更新: 2026-04-07

## 1. 製品概要
- **製品名**: 「あんべの名刺代わり」(Business_Card_Folder)
- **コンセプト**: 現場での出会いを最速でお礼メールと資産に変える、AI駆動のBYO型名刺管理ツール。

## 2. 絶対遵守の3原則 (Architecture Principles)
- **Zero-Risk & Free Tier**: Gemini 2.5 Flash 無料枠を固定使用。Rate Limiterで物理遮断。
- **Privacy-First (Zero-Footprint)**: 画像はOCR解析後、即メモリから破棄。DBには保存しない。
- **特例**: 視認性向上のため、100px程度の超低解像度base64サムネイルのみをDBに保存する。
- **BYO (Bring Your Own)**: Supabase URL/Key、Gemini API Keyは localStorage で管理。サーバーサイド環境変数に依存しない。

## 3. 完全要件定義 (Feature List)
### A. 登録・解析 (OCR & Input)
- **AI解析**: Gemini 2.5 Flash による全項目抽出（氏名・カナ・会社・役職・住所・連絡先等）。
- **即時編集プレビュー**: OCR後、保存前にユーザーが内容を修正し、面談メモ（notes）を追記するフロー。
- **サムネイル生成**: 画像アップロード時にフロントエンドでリサイズ・圧縮を行い、`thumbnail_base64` を生成。
- **Geo-tagging**: 登録時のGPS座標から「交換場所（location_name）」を自動記録。
- **お礼メール生成**: 登録データとメモに基づき、Geminiが最適なメール文面をドラフト。mailto: 連携。

### B. 閲覧・管理 (UI/UX)
- **スリムリスト**: 1行1件（h-16）。氏名（カナ併記）、会社名、交換日、登録元を凝縮し、1画面10〜20件の俯瞰性を確保。
- **インライン編集**: 詳細画面で遷移せず、鉛筆アイコンでその場編集・削除。
- **検索・フィルタ**: 氏名（かな対応）・会社名・メモの全文検索。カテゴリカラーによる絞り込み。
- **カテゴリ管理**: 標準セット（重要・パートナー等）＋ユーザーによる自由な追加・色指定。

### C. 導入・保守 (Onboarding & Data)
- **SQLウィザード**: `/settings` に、自身のSupabaseで実行すべきテーブル作成SQL（DDL）を表示。
- **データ出力**: 全データの CSV エクスポート機能。
- **接続ガード**: 設定未完了時は全てのページから `/settings` へ強制リダイレクト。

## 4. データベース・スキーマ
- **users**: ユーザー管理
- **categories**: カテゴリ名、カラーコード（color_hex）
- **business_cards**: 名刺データ（kana, location_name, notes, exchanged_at, source 等を含む全カラム）
- **email_logs**: お礼メールの送信・生成履歴
- `business_cards` テーブルに `thumbnail_base64` (TEXT型) を追加。

## 5. 法的事項・表示 (Legal & Info)
- **Footer**: 全ページ下部に © 2026 ambe を表示。
- **Disclaimer (免責事項)**: BYOモデルに伴う「自己責任原則」および「API課金・データ管理の利用者帰属」を明記。
- **About ページ**: `/about` に免責事項の詳細と、画像非保持のプライバシーポリシーを掲載。

## 6. ディレクトリ構造
```plaintext
src/
├── app/
│   ├── (dashboard)/cards/page.tsx  # 一覧・検索
│   ├── settings/page.tsx           # BYO設定・SQLガイド・カテゴリ管理
│   ├── about/page.tsx              # 免責事項・コピーライト
│   └── layout.tsx                  # ヘッダー・フッター（©表示）
├── components/
│   ├── cards/                      # スリムリスト・OCR・編集・メール生成
│   └── shared/                     # UIパーツ・検索窓
├── hooks/
│   ├── useBYOConfig.ts             # localStorage管理
│   └── useSupabase.ts              # 動的クライアント生成
├── lib/
│   ├── supabase.ts                 # BYOファクトリ
│   └── gemini.ts                   # OCR/メール生成プロンプト
└── types/                          # DB/アプリケーション型定義
```