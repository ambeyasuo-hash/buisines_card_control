// (c) 2026 ambe / Business_Card_Folder
# design_doc.md v2.3

## 1. 製品概要
- **製品名**: 「あんべの名刺代わり」(Business_Card_Folder)
- **コンセプト**: 現場での出会いを最速でお礼メールと資産に変える、AI駆動の BYO 型名刺管理ツール。
- **ターゲット**: サービス業界のコンサルタント。モバイルでの「俯瞰性」と「片手操作」を最優先。

## 2. 設計原則 (Architecture Principles)

### BYO + Auth一元化（ハイブリッド・ブートストラップ）
- **Hybrid Storage**: Supabase 接続情報は `localStorage` を基本とするが、新規端末での利便性のため
  **環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）をデフォルト参照**できる設計とする。
- **Centralized Config**: Gemini API Key 等の個人設定は Supabase Auth ログイン後、`user_settings` テーブルから取得・同期する。
- **Auth-Sync**: ログイン一発で、複数端末（PC/スマホ）の設定が自動的に同期される状態を維持する。

### Intelligent Image Pipeline
- **Client-Side Processing**: ブラウザ上で OpenCV.js 等を用い、撮影した名刺の「四隅」を自動検出。
- **Perspective Transform**: 台形補正を行い、歪みのない「真っ直ぐな名刺画像」へ整形。
- **Auto-Rotation**: 名刺の向き（天地）を自動判定し、正位置に回転。
- **Thumbnail (案A)**: 補正・回転済みの画像から 100px 幅の軽量 base64 を生成し DB 保存。

### Mobile-First UX
- **High Contrast**: 屋外視認性を確保するため slate-950（深紺）ベースの強コントラスト UI を採用。
- **Direct Camera**: `capture="environment"` による背面カメラ直結起動。
- **Feedback**: 解析中はスキャンバー・アニメーションを表示し、ユーザーの体感待ち時間を軽減する。

## 3. 認証・同期フロー
1. **ブートストラップ**: localStorage が空の場合、環境変数を参照して自動的に接続先を特定。
2. **認証**: メール/パスワード認証。`NEXT_PUBLIC_SITE_URL` により本番環境での認証メールリダイレクトを制御。
3. **同期**: ログイン成功時、`user_settings` から `gemini_api_key` 等を取得し localStorage へ展開（不足分の補完）。
4. **利用**: 以降、ログインセッションがある限り、どの端末からでも即座に利用可能。

## 4. データ設計 (Database Schema)

### `user_settings`（設定一元化）
- `user_id`: uuid (FK to auth.users, UNIQUE)
- `gemini_api_key`: text (RLS 保護)
- `user_display_name`: text（メール署名用：表示名）
- `user_organization`: text（メール署名用：所属）

### `categories`（メールトーン設定）
- `user_id`: uuid（RLS 用）
- `name`: text
- `email_tone`: text（例: "情熱的", "フォーマル"）
- `category_footer`: text（カテゴリ専用署名）

### `business_cards`（名刺データ）
- `user_id`: uuid（RLS 用）
- `name`, `name_kana`, `company_name`, `position`, `email`, `tel`, `address`, `notes`: text
- `location_name`: text（Gemini が座標から変換した地名）
- `location_lat`, `location_lng`, `location_accuracy_m`: float8
- `thumbnail_base64`: text（100px 幅・補正済み画像）
- `created_at`: timestamptz（INDEX）

## 5. OCR & 入力フロー
1. **撮影**: カメラ起動（背面固定）→ 名刺撮影。
2. **整形**: 自動台形補正・回転実行。
3. **解析**: Gemini 2.5 Flash による解析（JSON抽出）。
4. **UX（解析中）**: 画像プレビュー上に「半透明オーバーレイ + スキャンバー（アニメーション）」を重畳し、
   「AIが名刺を解析中...（台形補正・OCR）」を表示して待ち時間の不安を減らす。
5. **編集**: 抽出結果をフォーム表示。ユーザーが画像を見ながら修正・保存。
6. **完了**: DB インサート（upsert）成功後、一覧へ遷移。

## 6. セキュリティ
- **RLS**: 全テーブルに `auth.uid() = user_id` を適用。
- **Privacy**: 元画像は解析後即廃棄。100px サムネイルのみ保持。
- **Prompt Security**: System Instruction による役割固定と JSON Schema 強制。

## 7. ディレクトリ構造 (App Router)
- `src/app/page.tsx`: ダッシュボード（タイル型メニュー）
- `src/app/login/page.tsx`: 認証（ブートストラップ対応）
- `src/app/settings/page.tsx`: 接続設定・プロフィール管理
- `src/app/(dashboard)/cards/page.tsx`: スリムリスト（高密度表示）
- `src/app/(dashboard)/cards/new/page.tsx`: OCR スキャン（アニメーション層あり）
- `src/app/(dashboard)/cards/[id]/page.tsx`: 詳細・編集・AIメール作成
