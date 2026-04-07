// (c) 2026 ambe / Business_Card_Folder
# design_doc.md v2.1

## 1. 製品概要
- **製品名**: 「あんべの名刺代わり」(Business_Card_Folder)
- **コンセプト**: 現場での出会いを最速でお礼メールと資産に変える、AI駆動の BYO 型名刺管理ツール。
- **ターゲット**: サービス業界のコンサルタント。モバイルでの「俯瞰性」と「片手操作」を最優先。

## 2. 設計原則 (Architecture Principles)

### BYO + Auth一元化
- **Hybrid Storage**: Supabase URL/Anon Key は `localStorage` で保持（ブートストラップ用）。
- **Centralized Config**: Gemini API Key は Supabase Auth ログイン後、`user_settings` テーブルから取得し同期。
- **Privacy-First**: フルサイズ画像は OCR 解析後、即メモリから破棄。100px 幅の超軽量 base64 サムネイルのみ DB 保持。

## 3. 認証・同期フロー
1. **初期設定**: `/settings` で Supabase 接続情報を入力（localStorage 保存）。
2. **認証**: `/login` で自分専用アカウントを作成/ログイン。
3. **同期**: ログイン成功時、DB の `user_settings` から Gemini API Key を取得し展開。
4. **利用**: 以降、ログインセッションがある限り、どの端末からでも同じ設定・データにアクセス可能。

## 4. データ設計 (Database Schema)

### `user_settings`
- `user_id`: uuid (FK to auth.users, UNIQUE)
- `gemini_api_key`: text (暗号化推奨だが、まずは RLS で保護)
- `user_display_name`: text (メール署名用の表示名)
- `user_organization`: text (メール署名用の所属)

### `categories`
- `email_tone`: text (カテゴリ別の文体トーン指示)
- `category_footer`: text (カテゴリ専用の署名/追伸)

### `business_cards`
- `user_id`: uuid (RLS 用)
- `name`, `name_kana`, `company_name`, `position`, `email`, `tel`, `address`: text
- `notes`: text (面談メモ)
- `location_name`: text (位置情報から変換された地名)
- `thumbnail_base64`: text (100px幅 jpeg/webp)
- `created_at`: timestamptz (INDEX 推奨)

## 5. セキュリティ
- **RLS**: 全テーブルに `auth.uid() = user_id` を適用し、他人のデータ閲覧を物理遮断。
- **Prompt Security**: System Instruction による役割固定と JSON Schema 強制。
- **Sanitization**: 出力時の HTML エスケープ徹底。

## 6. ディレクトリ構造 (App Router)
- `src/app/page.tsx`: ダッシュボード（タイル型メニュー）
- `src/app/login/page.tsx`: 認証画面
- `src/app/settings/page.tsx`: BYO/SQL設定
- `src/app/(dashboard)/cards/page.tsx`: スリムリスト一覧
- `src/app/(dashboard)/cards/new/page.tsx`: OCRスキャン画面
- `src/app/(dashboard)/cards/[id]/page.tsx`: 詳細・編集・位置情報・AIメール作成
- `src/hooks/useBYOConfig.ts`: 設定管理・DB同期ロジック