// (c) 2026 ambe / Business_Card_Folder
# design_doc.md v3.0 — Privacy-Safe Edition

## 1. 製品概要
- **製品名**: 「あんべの名刺代わり」(Business_Card_Folder)
- **コンセプト**: 現場での出会いを最速でお礼メールと資産に変える、**完全プライバシー保護** の BYO 型名刺管理ツール。
  - **Zero External API Calls**: 画像解析は100% ブラウザ内で実行。Gemini等の外部AIを使用しない。
  - **配布可能な信頼**: スマートフォンや共有端末での使用を想定し、個人情報が外部に流出しない設計。
- **ターゲット**: プライバシー意識の高いコンサルタント。モバイルでの「俯瞰性」と「片手操作」を最優先。

## 2. 設計原則 (Architecture Principles)

### 2.1 セキュリティ・ファースト (Security-by-Design)

**Zero Cloud Extraction**:
- 名刺画像の OCR 解析に外部 AI（Gemini等）を使用することは厳禁。
- すべてのテキスト抽出は Tesseract.js を用いてブラウザ内で完結する。

**Privacy by Design**:
- 画像データはブラウザのメモリ内でのみ処理される。
- 解析完了後、元画像は即座に廃棄（`URL.revokeObjectURL()` + メモリ解放）。
- DB に保存されるのは、抽出後の構造化テキスト（名前、メール等）と軽量サムネイルのみ。

**Offline Integrity**:
- ユーザーが「機内モード」でも、名刺の解析・フォーム入力・ローカル編集が動作する。
- Supabase との同期は、再度オンラインになった時点で自動実行。

### 2.2 BYO + Auth一元化（ハイブリッド・ブートストラップ）
- **Hybrid Storage**: Supabase 接続情報は `localStorage` を基本とするが、新規端末での利便性のため
  **環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）をデフォルト参照**できる設計とする。
- **Simplified Config**: Gemini API Key は不要。ユーザー設定（表示名、所属）のみ `user_settings` に保存。
- **Auth-Sync**: ログイン一発で、複数端末（PC/スマホ）での同期を維持。

### 2.3 Intelligent Image Pipeline（Phase 1-2 実装済み、Phase 3 予定）

**Phase 1 (実装済み): Canvas-Based Preprocessing**
- **Grayscale + Contrast Enhancement**: Canvas API を用いた簡易前処理。
- **実装**: `src/lib/image/processor.ts` で ITU-R BT.601 重み付け変換と対比度ストレッチを実行。
- **効果**: Tesseract の認識精度向上を図る。

**Phase 2 (予定): OpenCV.js 統合**
- **Perspective Transform**: 輪郭検出による台形補正（`window.cv` 利用可能時）。
- **Adaptive Thresholding**: 照明ムラを除去する動的二値化処理。
- **Orientation Correction**: 文字列の並びから天地を自動修正。
- **Denoising**: 認識率を下げるノイズ（影や反射）の除去。
- **実装予定**: `src/lib/image/processor.ts` にフック済み。`cv.wasm` のロード機構を整備次第、段階的に有効化可能。

**Phase 3 (予定): Hybrid Picker UI**
- **自動解析の限界**: 背景と文字のコントラストが低い、複雑な配置の場合。
- **アシスト機構**: ユーザーが画像上のテキストを「タップして流し込む」直感的なUI。
- **効果**: 100%の認識率を目指さず、ユーザー協力で実用的な完成度を達成。

### Mobile-First UX
- **High Contrast**: 屋外視認性を確保するため slate-950（深紺）ベースの強コントラスト UI を採用。
- **Direct Camera**: `capture="environment"` による背面カメラ直結起動。
- **Feedback**: 解析中はスキャンバー・アニメーションを表示し、ユーザーの体感待ち時間を軽減する。

## 3. 認証・同期フロー
1. **ブートストラップ**: localStorage が空の場合、環境変数を参照して自動的に接続先を特定。
2. **認証**: メール/パスワード認証。`NEXT_PUBLIC_SITE_URL` により本番環境での認証メールリダイレクトを制御。
3. **同期**: ログイン成功時、`user_settings` から ユーザー設定（表示名、所属）を取得。（Gemini Key は不要）
4. **利用**: 以降、ログインセッションがある限り、どの端末からでも即座に利用可能。

## 3.2 OCR & 入力フロー（Tesseract.js ベース）

1. **撮影**: カメラ起動（背面固定）→ 名刺撮影。
2. **前処理**: Canvas API による簡易グレースケール・対比度強化 (`preprocessCardImage()`)。
3. **解析**: Tesseract.js による日本語/英語テキスト抽出（ブラウザ内、30秒タイムアウト）。
   - **Web Worker**: UI をブロックしない Singleton パターン（`src/lib/ocr/engine.ts`）。
   - **正規表現パーサー**: メール、電話、住所、URL等を構造化フィールドに自動分類（`src/lib/ocr/parser.ts`）。
4. **UX（解析中）**: 画像プレビュー上に「半透明オーバーレイ + スキャンバー（アニメーション）」を重畳。
   - テキスト: 「ブラウザで名刺を解析中...」（Gemini への外部通信がないことを明示）。
5. **編集**: 抽出結果をフォーム表示。ユーザーが画像を見ながら修正・保存。
   - 不確定フィールド（フリガナ、役職、電話等）は **amber ボーダー** で視認性を向上。
6. **メール下書き**: ユーザープロフィール + 相手情報から、テンプレートベースで「お礼メール」を作成（`src/lib/email/templates.ts`）。
   - **外部API ナシ**: テンプレート式なため計算も軽量。
7. **完了**: DB インサート（upsert）成功後、一覧へ遷移。

## 4. データ設計 (Database Schema)

### `user_settings`（プロフィール・署名情報）
- `user_id`: uuid (FK to auth.users, UNIQUE)
- `user_display_name`: text（メール署名用：表示名）
- `user_organization`: text（メール署名用：所属）
- **Note**: `gemini_api_key` は削除。外部 API 不要。

### `categories`（メールトーン設定）
- `user_id`: uuid（RLS 用）
- `name`: text（カテゴリ名）
- `color_hex`: text（UI表示用カラー）
- `email_tone`: text（例: "情熱的", "フォーマル"）
- `category_footer`: text（カテゴリ専用署名）

### `business_cards`（名刺データ）
- `user_id`: uuid（RLS 用）
- `full_name`, `kana`, `company`, `department`, `title`, `email`, `phone`, `address`, `url`, `notes`: text
- `postal_code`: text
- `source`: enum ('camera' | 'line' | 'manual')
- `location_name`: text（Nominatim が座標から変換した地名）
- `location_lat`, `location_lng`, `location_accuracy_m`: float（GPS 座標、任意）
- `thumbnail_base64`: text（100px 幅・ブラウザ生成のみ）
- `exchanged_at`: date
- `created_at`: timestamptz（INDEX）
- **Note**: 元画像は一切保存しない。ブラウザメモリ内のみで処理・破棄。

## 5. セキュリティ・ポリシー（再掲・強調）

### 5.1 ローカル処理の原則
- **Image Processing**: Canvas API（グレースケール、対比度）+ OpenCV.js フック（将来）。
- **OCR**: Tesseract.js Worker（ブラウザ内、UI 非ブロッキング）。
- **Email Drafting**: テンプレートベース（計算のみ、外部 API ナシ）。
- **Geo Conversion**: Nominatim（GPS 座標のみ送信、個人情報不含）→ 将来的には OpenStreetMap のローカルデータ活用も検討。

### 5.2 RLS & Privacy
- **Row Level Security**: 全テーブルに `auth.uid() = user_id` を適用。
- **Image Handling**: 元画像は解析後即廃棄。100px サムネイル（base64 で DB 保存）のみを保持。
- **Geolocation**: GPS 座標の同期は任意。ユーザーが「機内モード」を選んでもアプリは機能。

### 5.3 監査・透明性
- **設定画面** で「このアプリはあなたのデータを外に送信しません」宣言を表示。
- **Health Check** の通知をユーザーに可視化し、信頼醸成。

## 6. ディレクトリ構造 (App Router + Privacy-Safe Architecture)

### 6.1 App Routes
- `src/app/page.tsx`: ダッシュボード（タイル型メニュー）
- `src/app/login/page.tsx`: 認証（ブートストラップ対応）
- `src/app/settings/page.tsx`: 接続設定・プロフィール管理（Gemini Key 入力欄なし）
- `src/app/(dashboard)/cards/page.tsx`: スリムリスト（高密度表示、tel: / mailto: ボタン）
- `src/app/(dashboard)/cards/new/page.tsx`: OCR スキャン（Tesseract.js ベース、アニメーション層あり）
- `src/app/(dashboard)/cards/[id]/page.tsx`: 詳細・編集・テンプレートメール作成・vCard DL

### 6.2 Core Libraries (Privacy-First Implementation)

**OCR Pipeline** (`src/lib/ocr/`)
- `engine.ts`: Tesseract.js Web Worker **Singleton** パターン（メモリリーク防止）
- `parser.ts`: OCR テキスト → 構造化フィールド（正規表現ベース）
- `index.ts`: `analyzeBusinessCard()` パブリック API

**Image Preprocessing** (`src/lib/image/`)
- `processor.ts`: Canvas ベースのグレースケール＋対比度強化（OpenCV.js フック済み）
- `index.ts`: `preprocessCardImage()` パブリック API

**Email Generation** (`src/lib/email/`)
- `templates.ts`: テンプレートベースのお礼メール・フォローアップメール生成
- `index.ts`: `generateThankYouEmailDraft()`, `generateFollowUpEmail()`

**Geolocation** (`src/lib/geo/`)
- `reverse.ts`: Nominatim 逆ジオコーディング（GPS 座標 → 地名、開示のみ）

**Utilities** (`src/lib/`)
- `csv.ts`: CSV エクスポート（RFC 4180 準拠）
- `vcard.ts`: vCard エクスポート（RFC 2426 準拠）
- `supabase.ts`: Supabase クライアント管理（Auth, DB 操作）
- `utils.ts`: 共通ヘルパー（toMailtoUrl, cleanPhoneNumber, downloadFile等）
- `geolocation.ts`: Browser Geolocation API ラッパー（キャッシング機構あり）
- `async.ts`: `withTimeout()` ユーティリティ（安全な非同期実行）

### 6.3 UI Components (`src/components/`)

**New (v3.0 Extraction)**
- `ui/Button.tsx`: プライマリ/セカンダリ/ダンジャーバリアント
- `ui/SectionCard.tsx`: セクション容器パターン
- `ui/Toast.tsx`: 固定位置通知（位置オーバーライド対応）

**Hooks** (`src/hooks/`)
- `useBYOConfig.ts`: BYO 設定・認証状態管理（Gemini Key 不要）
- `useSupabase.ts`: Supabase クライアント初期化
- `useEmailDraft.ts`: メール下書き状態機械（テンプレートエンジン統合）
- `useGeminiOCR.ts`: （互換性のため存続、Tesseract.js へ内部リダイレクト）

## 7. Phase 5: 実戦・効率化機能 (v2.4 — 実装完了)

### 8.1 クイック・アクション
- **一覧画面での直接操作**: 各行の電話番号・メールアドレスをタップで `tel:` / `mailto:` リンク起動。
- **詳細画面での拡張**: 電話、メール、Webサイト等への直接アクセスボタン。
- **UX**: スマートフォンネイティブな操作感を実現。

### 8.2 エクスポート機能
- **vCard（.vcf）形式**:
  - 個別名刺の vCard ダウンロード（詳細画面）。
  - スマートフォンの標準連絡先アプリへ直接インポート可能。
  - 名前、会社、電話、メール、住所、URL、メモ等を含める。

- **CSV 形式**:
  - 全名刺データの一括 CSV エクスポート。
  - PC 上で Excel / Google Sheets での管理・加工用。
  - 年賀状リスト作成等の用途。

### 7.3 サステナビリティ設定（Cold Start 対策）
- **Health Check 実装** (実装済み):
  - Supabase 無料枠の非アクティブ停止を防ぐため、定期的な Ping ロジック。
  - GitHub Actions または Cloud Scheduler での自動実行。
  - 最小限の API 呼び出し（`SELECT 1`）でサーバー活性を保持。

- **ユーザー視点**:
  - 連携情報は settings 画面で可視化（次回チェック時刻等）。
  - 手動 Health Check ボタンも提供。

## 8. Phase 6: 画像処理の高度化 (v3.5 — 予定)

### 8.1 OpenCV.js 統合
- **Trigger**: `src/lib/image/processor.ts` の既存フック機構を利用。
- **機能**:
  - Canny エッジ検出による輪郭抽出
  - 4点透視変換（Perspective Transform）による台形補正
  - Adaptive Gaussian Threshold による照明補正
  - Hough Line Transform による自動回転補正
- **実装**: `preprocessCardImage()` 内で `window.cv` を検査し、利用可能ならプリセット前処理を拡張。

### 8.2 Hybrid Picker UI
- **自動解析の限界を補う**: 低コントラスト、複雑な配置の場合。
- **UX**: ユーザーが画像上をタップしてテキストを「流し込む」直感的なポイント＆クリック。
- **実装**: `/cards/new` ページに「タップモード」トグル → Canvas 座標取得 → 抽出テキスト の親子フロー。

## 9. 実装完了チェックリスト (v3.0)

### Core Infrastructure
- [x] BYO Config (Supabase URL / Anon Key) → localStorage ベース
- [x] Next.js 16 App Router with TypeScript
- [x] Supabase Auth (メール/パスワード + RLS)
- [x] Slate-950 Dark Theme (Tailwind v4)

### OCR Pipeline
- [x] Tesseract.js (jpn+eng, Worker Singleton)
- [x] 正規表現パーサー（Email, Phone, URL, Address等）
- [x] Canvas グレースケール＋対比度処理
- [ ] OpenCV.js 統合（予定、フック準備済み）

### Email & Export
- [x] テンプレートベースのお礼メール・フォローアップ生成
- [x] vCard (RFC 2426) エクスポート
- [x] CSV (RFC 4180) エクスポート

### UX/Mobile
- [x] 背面カメラ直結（`capture="environment"`）
- [x] スキャンバー・アニメーション
- [x] tel: / mailto: クイックリンク
- [x] 片手操作最適化（モバイルファースト）
- [x] Amber ボーダーによる不確定フィールド表示

### セキュリティ
- [x] Zero Cloud Extraction（Gemini API 削除完了）
- [x] Privacy by Design（元画像即廃棄）
- [x] Offline Integrity（機内モード対応）
- [x] RLS 全テーブル適用

### Next Steps (v3.5+)
- [ ] OpenCV.js 統合
- [ ] Hybrid Picker UI
- [ ] 複数言語対応（中国語、韓国語等）
- [ ] オフラインデータベース（IndexedDB）によるシンク
