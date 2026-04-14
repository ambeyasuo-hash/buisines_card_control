Phoenix Edition v5.0.7 修正仕様書（差分）
1. グローバル・アクセシビリティ (視認性の一括管理)
動的スケーリングシステム:

localStorage に font-size-preference（小・標準・大・特大）を保存。

CSS変数 --base-font-size をルート (<html>) に適用し、アプリ全体の文字サイズを一括制御。

「標準」の基準値を従来の1.2倍に底上げし、モバイルでの可読性を確保。

ダークモードの強制:

モバイルブラウザのシステム設定に左右されず、常に #0a0f1a (Deep Midnight) を背景色として適用。

2. モバイル・エルゴノミクス (操作性の最適化)
セーフエリア対応:

h-[100svh] (Small Viewport Height) を採用し、ブラウザのツールバーやノッチに干渉されないレイアウト。

上部に pt-[env(safe-area-inset-top)] を確保し、アイコンの重なりを解消。

グローバル・ナビゲーション:

全サブページに 「Floating Back Button」 を設置。

単なるテキストではなく、直径 40px 以上のタップしやすい円形グラスモーフィズム・ボタンとしてデザイン。

3. 設定 UX (インテリジェント・セットアップ)
Supabase スキーマ・プロビジョニング:

設定画面内に「SQLコピーボタン」を設置。

ユーザーがワンクリックで最新のテーブル定義（E2EE/Analytics Zone含む）を取得し、Supabase SQL Editorへ遷移できる導線を確保。

Azure OCR 疎通テストの改善:

CORS制限を考慮し、軽量なテストリクエスト（POST/GET）による疎通確認ロジックへリファクタリング。

TypeError: Load failed 発生時に、エンドポイントの形式修正やCORS設定を促す日本語アドバイスを表示。

4. データ・インテグリティ (解析・保存の整合性)
解析パイプラインの修正:

OCR抽出データと暗号化データのマッピング不全を解消。

詳細画面において、id に紐づく暗号化JSONが正しく復号・表示されるよう、データのハイドレーション処理を再構築。

エラーメッセージの日本語化:

技術的なコード（404, 500等）を廃止。

「光の反射を抑えて撮影してください」「ブラウザのカメラ許可を確認してください」など、ユーザーが次に取るべき行動を示すマイルドな表現に統一。

あんべの名刺代わり — Design Document v5.0.5
Zero-Knowledge + Searchable Encryption + Elegant Resilience

--------------------------------------------------------------------------------
1. 製品概要
コンセプト: 「軍用レベルの堅牢性と、隣人に寄り添う優しさの共存」
 サーバー管理者が一切のデータを見ることができない「ゼロ知識証明」を貫きつつ、ユーザーが認証に迷った際の救済策を備えた、究極のUXを持つ名刺DXプラットフォーム
。 ターゲット: プライバシー意識の極めて高い法人・コンサルタント・営業職
 技術的特性:
Searchable Encryption (Blind Indexing): データを秘匿したまま、サーバー側での高速な検索・統計を可能にするハイブリッド設計
。
Elegant Rescue: 認証失敗時の絶望を回避するため、端末の電話帳を活用したリカバリ機能を搭載
。
Placeholder-Based AI: Geminiには非PII（個人特定不能）属性のみを送信し、実データとの結合はブラウザ側で完結させる
。

--------------------------------------------------------------------------------
2. セキュリティ・アーキテクチャ (Zero-Knowledge & Biometric Protection)

### 2.1 Wrapped Key Storage による二重暗号化 (Biometric-Protected)

**第1層：マスターキー** (AES-256-GCM, 32 bytes)
- 業務カード全体を保護する暗号化キー
- ローカル localStorage に直接保存しない（暗号化状態でのみ保存）

**第2層：生体認証ラッパー** (WebAuthn/Secure Enclave)
- マスターキーを保護する外側の鍵層
- navigator.credentials.get() による FaceID / 指紋認証
- Secure Enclave （iOS） / Trusted Execution Environment（Android） / Windows Hello に統合
- **サーバーに一切の生体データ・秘密鍵を送信しない**

**暗号化フロー**：
```
ユーザー起動時:
  ↓
WebAuthn生体認証 ← (FaceID / 指紋 / 顔認証)
  ↓ (成功時)
生体認証署名から鍵導出 (HMAC-SHA256 + Salt)
  ↓
マスターキー復号 (AES-256-GCM unwrap)
  ↓
業務カード復号 & 検索 & UI表示
```

**フォールバック認証**:
- WebAuthn非対応環境：ユーザー設定PIN （4～8桁） から PBKDF2 派生鍵を使用
- 互換性：すべてのブラウザで最低限の保護を保証

### 2.2 PAA (Passkey-Assisted Authentication) セッションポリシー

**認証トリガー**:
- **初回起動 / ページリロード**: WebAuthn再認証を要求
- **15分間の無操作**: セッションタイマーが満了し、再認証画面へ自動遷移
- **ユーザー明示的ログアウト**: セッション破棄、メモリ上のマスターキーをクリア

**セッション状態**:
- `LOCKED`: 初期状態。マスターキーはメモリに存在しない。
- `AUTHENTICATING`: WebAuthn認証中。UI は生体認証プロンプトを表示。
- `UNLOCKED`: 認証済み。マスターキーがメモリ上でアクティブ。15分タイマー カウントダウン中。

**メモリ管理**：
- マスターキー（CryptoKey オブジェクト）は JavaScript 専用メモリ領域に隔離
- ページ遷移・ブラウザタブ閉鎖時は自動クリア（Web Crypto API 仕様）
- localStorage には格納しない（暗号化ラッパーのみ保持）

### 2.3 Azure AI Document Intelligence (Japan East)
ローカルOCRを廃止し、AzureのPrebuiltモデルに集約。データ学習・ログ保存はオプトアウト設定済みの法人契約APIを使用
。
解析後の元画像はDBに保存せず、メモリから即座に抹消
。

### 2.4 リカバリ戦略 (最後の砦：24単語物理バックアップ)

**日常利用**: WebAuthn（生体認証）でマスターキーをアンラップ

**緊急リカバリのみ**: 24単語シークレットフレーズ
- **用途**: 端末紛失 / ブラウザ完全クリア / localStorage 消失時のみ
- **特性**: オフライン完全対応。QR コード or 印刷可能
- **保管**: 電話帳 vCard / メール下書き / 金庫等の物理保管
- **復旧フロー**: リカバリ画面で24単語入力 → マスターキー復元 → 業務カード復号

**重要**: 日常利用では WebAuthn が推奨。24単語は「保険」の位置付け。

### 2.5 Non-Biometric Fallback Authentication (PIN/Password)

**背景**: WebAuthn 非対応環境（レガシーブラウザ、特定の PC）でも、安全な認証を実現。

**実装方式**:
- **PIN 方式**: 4～8 桁の数字をユーザーが設定
- **鍵導出**: PBKDF2-SHA256（100,000 iterations）でストレッチング
  ```
  wrapping_key = PBKDF2(pin, encryption_salt, 100000, "SHA-256")
  ```
- **マスターキー保護**: wrapping key で AES-256-GCM 暗号化
  ```
  encrypted_master_key = AES-256-GCM(master_key, wrapping_key, random_iv)
  ```

**ロック画面 UX**:
```
[認証方法を選択]
├─ FaceID / 指紋 (WebAuthn対応デバイス)
└─ PIN入力 (4～8桁、全環境対応)
```

### 2.6 Secure Device Handshake Protocol (Multi-Device Pairing)

**目的**: 複数デバイス（スマホ ↔ PC）間でマスターキーを安全に共有。

**E2EE 鍵転送フロー**:
```
Device A (既存):
  ├─ RSA-2048 公開鍵を QR code に埋め込み
  └─ QR 表示

Device B (新規):
  ├─ QR code スキャン → Device A の公開鍵 取得
  ├─ Ephemeral AES-256 session key 生成
  ├─ Session key を RSA-2048 wrap
  └─ Wrapped session key を Device A に送信

Device A:
  ├─ Session key を RSA-2048 unwrap
  ├─ Master key を AES-256-GCM wrap
  └─ Wrapped master key を Device B に送信

Device B:
  ├─ Master key を AES-256-GCM unwrap
  └─ 複数デバイスで同じマスターキーを保有
```

**暗号化アルゴリズム**: RSA-2048（鍵交換） + AES-256-GCM（マスターキー保護）

### 2.7 Realtime Sync Policy (LWW 競合解決)

**データ同期**: Supabase Realtime により複数デバイス間の名刺変更をリアルタイム伝播。

**競合解決ルール**: LWW (Last Write Wins)
- 同じカード の同時編集 → `max(Device A.updated_at, Device B.updated_at)` の版を採用
- オフライン編集 → 接続復旧時に LWW で自動解決
- 削除 vs 編集 → 最後の操作が優先

**設計根拠**: 名刺管理の性質上、「最後に更新したデバイスが正」で十分。CRDT 不要。

--------------------------------------------------------------------------------
3. 技術スタック (v5.0.5)
Frontend & Security
Next.js 15/16 (App Router) / Tailwind CSS v4
Encryption: AES-GCM (256-bit)
Hashing: HMAC-SHA256 (Blind Indexing用)
Cloud OCR & AI
Azure AI Document Intelligence (@azure/ai-form-recognizer)
Google Gemini 2.5 Flash: 構造化テンプレート生成のみを担当
Backend
Supabase (PostgreSQL) + RLS (Row Level Security)

--------------------------------------------------------------------------------
4. 解析・検索パイプライン
Extract: Azure OCRにより構造化データを抽出（日本リージョン・学習なし）
。
Normalize: src/lib/normalize.ts を用い、企業名から「株式会社」等のノイズを除去し、検索用単語に分割
。
Client-side Processing:
実データ：AES-GCMで一括暗号化
。
検索ワード：固有ソルトを用いて個別にハッシュ化（Blind Indexing）
。
Storage: サーバーには「暗号化されたデータ」と「比較用のハッシュ」、「非PII属性（業界等）」のみを送信
。
AI Generation & Hydration: 属性に基づき生成された「{{氏名}}」入りテンプレートを、ブラウザ上で実データと結合
。

--------------------------------------------------------------------------------
5. データ設計（Supabase）
business_cards Table
[E2EE Zone: 復号鍵が必須]
encrypted_data: PII一括暗号化JSON
encrypted_thumbnail: 暗号化済みサムネイルBase64
[Search Zone: 盲目的索引]
search_hashes: 名字、名前、社名の個別HMACハッシュ（配列格納）
[Analytics Zone: 統計用平文]
industry_category: 業界カテゴリ（IT、製造等）
attributes: 役職ランク、ミッション等の非PII属性
[Security & Recovery]
encryption_salt: ユーザー固有UUIDソルト
auth_verify_hash: パスコード検証用ハッシュ
recovery_hash: シードフレーズ検証用ハッシュ

--------------------------------------------------------------------------------
6. UI/UX デザイン規格 (Ambe Design System) — Phoenix Edition v5.0.6

### 6.1 デザイン哲学
**Deep Dark Luxury** — iOS コントロールセンター / Linear / Vercel に代表されるミニマルかつ高級感のある質感を追求。
**Device-in-Browser** — デスクトップではブラウザ内に「スマートフォンが浮かぶ」体験を提供（390px デバイスフレーム）。
**Gradient Vitality** — 3色グラデーション体系（ブルー・エメラルド・パープル）でカテゴリを直感的に色分けし、UIに生命感を与える。
**Kindness-Centered UX** — 認証失敗時の救済策（Elegant Rescue）を含め、隣人に寄り添うデザイン。

### 6.2 カラーパレット

#### 背景色
| 用途 | OKLCH | 概算HEX | 備考 |
|------|-------|---------|------|
| メイン背景 | `oklch(0.12 0.02 250)` | `#0a0f1a` | ページ・デバイス外フレーム |
| カード背景 | `oklch(0.15 0.025 250)` | `#0d1220` | コンテンツカード |
| サイドバー | `oklch(0.14 0.02 250)` | `#0b1019` | サイドバー |
| 入力フィールド | `oklch(0.18 0.02 250)` | `#111827` | `bg-white/5` 相当 |
| ミュート | `oklch(0.20 0.015 250)` | `#141c2a` | 補助背景 |

#### アクセントカラー（3色グラデーション体系）
| 番号 | 名称 | グラデーション | 用途 |
|------|------|--------------|------|
| 1 | ブルー/シアン | `from-blue-500 to-cyan-400` | プライマリアクション・ヘッダーアイコン・第1カテゴリ (`index % 3 === 0`) |
| 2 | エメラルド/ティール | `from-emerald-500 to-teal-500` | 確認アクション・成功・第2カテゴリ (`index % 3 === 1`) |
| 3 | パープル/ピンク | `from-purple-500 to-pink-500` | 特別なアクション・第3カテゴリ (`index % 3 === 2`) |

#### テキスト・ボーダー
| 用途 | 値 |
|------|-----|
| Foreground (本文) | `oklch(0.95 0 0)` ≈ `#f2f2f2` |
| Muted Foreground (副情報) | `oklch(0.60 0.01 250)` ≈ `#7a8599` |
| ボーダー デフォルト | `border-white/10` または `border-white/20` |
| ボーダー アクティブ | 各グラデーションカラーの 30% 透過 |
| デストラクティブ | `oklch(0.577 0.245 27.325)` |

#### CSS 変数（globals.css に定義）
```css
:root, .dark {
  --background:         oklch(0.12 0.02 250);
  --foreground:         oklch(0.95 0 0);
  --card:               oklch(0.15 0.025 250);
  --card-foreground:    oklch(0.95 0 0);
  --popover:            oklch(0.15 0.025 250);
  --popover-foreground: oklch(0.95 0 0);
  --primary:            oklch(0.65 0.2 250);
  --primary-foreground: oklch(0.98 0 0);
  --secondary:          oklch(0.18 0.02 250);
  --secondary-foreground: oklch(0.95 0 0);
  --muted:              oklch(0.20 0.015 250);
  --muted-foreground:   oklch(0.60 0.01 250);
  --accent:             oklch(0.55 0.15 160);
  --accent-foreground:  oklch(0.98 0 0);
  --destructive:        oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.95 0 0);
  --border:             oklch(0.25 0.03 250);
  --input:              oklch(0.18 0.02 250);
  --ring:               oklch(0.65 0.2 250);
  --radius:             0.75rem;
}

@theme inline {
  --font-sans: 'Geist', 'Geist Fallback';
  --font-mono: 'Geist Mono', 'Geist Mono Fallback';
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card:       var(--card);
  /* ... 以下同様にすべての変数をマップ ... */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

### 6.3 タイポグラフィシステム
**フォントファミリー**: Geist 優先、フォールバックにシステムフォント
```
sans: 'Geist', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
mono: 'Geist Mono', SFMono-Regular, "SF Mono", Monaco, Consolas, monospace
```

**サイズ体系**（変更なし）:
- xs: 12px / 16px (ラベル・補助情報)
- sm: 14px / 20px (メタ情報)
- base: 16px / 24px (本文)
- lg: 18px / 28px (小見出し)
- xl: 20px / 28px, font-weight 600 (中見出し)
- 2xl: 24px / 32px, font-weight 700 (大見出し)
- 3xl: 30px / 36px, font-weight 700 (ページタイトル)

### 6.4 スペーシング & レイアウト
**8px Base Unit System**（変更なし）:
```
1: 4px  | 2: 8px  | 3: 12px | 4: 16px
5: 20px | 6: 24px | 8: 32px | 12: 48px
```

**レイアウト原則**:
- モバイルファースト: `max-w-2xl mx-auto px-4`
- 角丸: 大きめを基本 (`rounded-xl`, `rounded-2xl`)
- 透明感: `backdrop-blur-xl`, `bg-card/95`
- スペーシング: `gap-3`, `space-y-3` で統一感を維持

**デスクトップ展開（Device-in-Browser）**:
- デスクトップ (md+) では 390px × min(844px, 92svh) のデバイスフレームを表示
- 外側: 深い夜空 (`#020510`) ＋ 浮遊するアンビエントオーブ（ブルー・エメラルド・パープル）
- フレーム: `border-radius: 50px`, Dynamic Island, ホームインジケーター, サイドボタン
- モバイル: フレームなし、フルスクリーン表示

### 6.5 コンポーネント規格

#### グラデーションボーダーカード
```css
/* 1px グラデーションボーダーをラッパーで実現 */
.card-wrapper {
  @apply rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/40 to-cyan-500/40;
}
.card-inner {
  @apply rounded-2xl bg-card;
}
```

#### アクションカード（ダッシュボード用）
カード背景・アイコンコンテナ・ボーダーはすべて同一グラデーション系色で統一し、
カテゴリ番号 `index % 3` によって自動色分け:
- 0: ブルー系 `rgba(37,99,235,…)`
- 1: エメラルド系 `rgba(16,185,129,…)`
- 2: パープル系 `rgba(139,92,246,…)`

アイコンコンテナは `72×72px`, `border-radius: 18px`, 不透明度高めで背景から浮き立たせる。

#### ボタン
```css
/* プライマリ */
@apply bg-gradient-to-r from-blue-500 to-blue-600 text-white
       hover:from-blue-600 hover:to-blue-700 border-0 rounded-xl py-5;

/* アウトライン */
@apply border-white/20 bg-white/5 hover:bg-white/10 rounded-xl;
```

#### 入力フィールド
```css
@apply border-white/10 bg-white/5 rounded-xl
       focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50;
```

#### アイコンボックス
```css
@apply flex h-10 w-10 items-center justify-center rounded-lg
       bg-gradient-to-br from-blue-500/20 to-cyan-500/20
       border border-blue-500/30;
```

#### Typography / Badge / Icon サイズ（変更なし）
```tsx
.ambe-heading-1   // 30px, bold
.ambe-heading-2   // 24px, bold
.ambe-heading-3   // 20px, semibold
.ambe-text-body   // 16px
.ambe-text-secondary // 14px
.ambe-text-muted  // 12px

.ambe-badge-primary   // Blue/Cyan tint
.ambe-badge-accent    // Emerald/Teal tint
.ambe-badge-warning   // Amber tint
.ambe-badge-danger    // Red tint

.ambe-icon-sm  // 16px
.ambe-icon-md  // 20px
.ambe-icon-lg  // 24px
.ambe-icon-xl  // 32px
```

### 6.6 実装ルール

✅ **推奨 (DO)**:
```tsx
// Tailwind ユーティリティクラスを使う
<div className="rounded-2xl bg-card border border-white/10 p-6">

// CSS変数を参照
<div className="bg-background text-foreground">

// グラデーションは from-/to- で
<button className="bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl">

// カテゴリ色分けは index % 3 で動的に
const colorClass = ['from-blue-500/30 to-cyan-500/10',
                    'from-emerald-500/30 to-teal-500/10',
                    'from-purple-500/30 to-pink-500/10'][index % 3];

// Framer Motion で hover/tap に物理感を
<motion.button whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.97 }}>
```

❌ **禁止 (DON'T)**:
```tsx
// ライトモード前提の白背景カード
<div className="bg-white border border-slate-200">

// インラインスタイルでカラーコードを直書き（デバイスフレーム等の構造CSS は例外）
<div style={{ color: '#2563EB' }}>

// 不規則なパディング・任意値
<div style={{ padding: '17px 22px' }}>
<div className="w-[157px]">

// グラデーションなしのフラットなプライマリカラー
<button className="bg-blue-600">   // → bg-gradient-to-r from-blue-500 to-blue-600 に
```

### 6.7 シャドウシステム
```
/* ダーク背景向け（カラー付きグロー） */
card-glow-blue:    0 6px 36px rgba(37,99,235,0.20), inset 0 1px 0 rgba(255,255,255,0.08)
card-glow-emerald: 0 6px 36px rgba(16,185,129,0.16), inset 0 1px 0 rgba(255,255,255,0.08)
card-glow-purple:  0 6px 36px rgba(139,92,246,0.16), inset 0 1px 0 rgba(255,255,255,0.08)

/* デバイスフレーム */
device-shadow: drop-shadow(0 60px 120px rgba(0,0,0,0.85))
               drop-shadow(0 0 90px rgba(37,99,235,0.05))
```

### 6.8 ボーダーラディウス階層
```
sm:   4px     (小要素・バッジ)
md:   8px     (ボタン・入力欄)
lg:   12px    (標準カード)    ← --radius: 0.75rem
xl:   16px    (モーダル・ダイアログ)
2xl:  24px    (大きなサーフェス・アクションカード)
full: 9999px  (円形・ピル・Dynamic Island)
device-frame: 50px (デバイス外枠)
```

### 6.9 アクセシビリティ (WCAG 2.1 AA)
- **カラーコントラスト**: ダーク背景上の白テキストは自動的に高コントラストを満たす
- **フォーカス指標**: `outline-ring/50` をグローバル適用（`@layer base` の `*` セレクタ）
- **セマンティック HTML**: `<button>`, `<input>` 等を常に適切に使用

### 6.10 アニメーション（Framer Motion）
```tsx
// ページ遷移
PAGE:     initial { opacity: 0, x: 28 }  →  animate { opacity: 1, x: 0, duration: 0.24, ease: 'easeOut' }
SUB_PAGE: initial { opacity: 0, x: 32 }  →  animate { opacity: 1, x: 0, duration: 0.26, ease: 'easeOut' }

// カードホバー
whileHover: { y: -4, scale: 1.018 }
whileTap:   { scale: 0.965 }
transition: { type: 'spring', stiffness: 380, damping: 16 }

// アイコンホバー
animate: { scale: 1.12, rotate: 6 }
transition: { type: 'spring', stiffness: 380, damping: 16 }

// カード入場スタガー
delay: 0.14 + index * 0.08
```

### 6.11 使用パターン

#### グラデーションボーダー付きカード
```tsx
<div className="rounded-2xl p-[1px] bg-gradient-to-r from-blue-500/40 to-cyan-500/40">
  <div className="rounded-2xl bg-card p-6">
    <h2 className="text-xl font-semibold text-foreground mb-4">タイトル</h2>
    <p className="text-sm text-muted-foreground mb-6">説明文</p>
    <button className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl py-3">
      アクション
    </button>
  </div>
</div>
```

#### アイコンボックス付きリストアイテム
```tsx
// index % 3 で色分け
const gradients = [
  'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
  'from-purple-500/20 to-pink-500/20 border-purple-500/30',
];
<div className={`flex h-10 w-10 items-center justify-center rounded-lg
                 bg-gradient-to-br ${gradients[index % 3]} border`}>
  <Icon className="h-5 w-5" />
</div>
```

#### フォームグループ（ダーク）
```tsx
<div className="space-y-2 mb-4">
  <label className="text-sm font-medium text-foreground">メールアドレス</label>
  <input className="w-full border border-white/10 bg-white/5 rounded-xl px-4 py-3
                    focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50
                    text-foreground placeholder:text-muted-foreground" />
</div>
```

#### Modal / Dialog（ダーク）
```tsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="rounded-2xl bg-card border border-white/10 shadow-xl max-w-sm w-full p-6">
    <h2 className="text-xl font-bold text-foreground mb-4">確認</h2>
    <p className="text-sm text-muted-foreground mb-6">メッセージ</p>
    <div className="flex gap-3">
      <button className="flex-1 border border-white/20 bg-white/5 hover:bg-white/10
                         rounded-xl py-3 text-sm text-foreground">キャンセル</button>
      <button className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600
                         text-white rounded-xl py-3 text-sm font-medium">確認</button>
    </div>
  </div>
</div>
```

### 6.12 認証 UI & PAA 統合

**ロック画面 (LOCKED 状態)**:
- 中央に大きなアイコン: FaceID / 指紋 / 顔認証のシンボル
- テキスト: 「生体認証で保護されています」
- ボタン: 「認証」（tap で WebAuthn トリガー）
- 代替フロー: 「リカバリキーで復旧」リンク（緊急時）

**セッション進捗表示 (UNLOCKED 状態)**:
- 右上に小さなタイマー: 残り時間表示（14:32 → 14:31 ...）
- ホバーテキスト: 「15分間の無操作でロックされます」
- 色: 穏やかなブルー（警告ではなく情報）

**リカバリキー セクション (SettingsPage)**:
- **新規ラベル**: 「🔴 緊急リカバリ (Emergency Recovery)」
- **デフォルト状態**: 折り畳み（collapsed）。ユーザーが展開するまで隠蔽。
- **説明文**: 「端末紛失時のみ必要です。日常利用には生体認証をご使用ください。」
- **色分け**: Amber/Orange トーン（警告レベル）
- **24単語表示**: モノスペースフォント、折り返し対応

**Visual Trust & Slots**:
**Visual Trust**: 初回セットアップ時に「生体認証チップへの鍵の封じ込め」プロセスをアニメーション化。チェックマーク + 「✓ 生体認証で保護されています」表示で安心感を可視化。
**Slots**: 「スキャン（Identity）」、「名刺一覧（Dashboard）」、「設定（Settings）」の3タブ。認証状態に応じて動的に切り替え。
**Device Frame**: デスクトップでは 390px デバイスフレーム（Dynamic Island・ホームインジケーター付き）をブラウザ中央に表示。ロック状態では枠線を半透明に。

---

## 7. Database Schema Updates (v5.0.6+)

### 7.1 Two-Phase OCR Pipeline

名刺読み取りの「表面 + 裏面」二段階パイプラインに対応したスキーマ更新。

**新規カラム:**
- `notes TEXT` — 裏面全文テキスト（back-side full text for search/lookup）
  - Azure Document Intelligence の `prebuilt-read` で抽出
  - 検索・参照用途の完全テキスト
  - 暗号化対象外（Full-text search の簡易実装用）

**変更履歴:**

| カラム | v5.0.5 | v5.0.6+ | 説明 |
|---|---|---|---|
| `notes` | ❌ | ✅ | 裏面全文テキスト（新規追加） |
| `ocr_raw_text` | ✅ | ✅ | 表面 OCR 生テキスト |
| `thumbnail_url` | ✅ | ✅ | サムネイル (Base64) |
| `attributes` | ✅ | ✅ | 表面構造化フィールド JSON |
| `search_hashes` | ✅ | ✅ | 企業名・氏名の検索用ハッシュ |

### 7.2 Schema Definition (src/lib/supabase-sql.ts)

**CREATE TABLE business_cards:**
```sql
-- Primary & Security
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
encrypted_data TEXT NOT NULL
encryption_key_id TEXT NOT NULL DEFAULT 'v1'

-- OCR Results (Two-Phase)
attributes JSONB NOT NULL DEFAULT '{}' 
  └─ Front side: {name, company, title, email, tel, address}
notes TEXT
  └─ Back side: complete extracted text

-- Search & Filtering
search_hashes TEXT[] NOT NULL DEFAULT '{}'
  └─ Deterministic hashes for blind search
industry_category TEXT

-- Timestamps & Metadata
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
scanned_at TIMESTAMP WITH TIME ZONE
ocr_confidence FLOAT
thumbnail_url TEXT
```

**Indexes:**
- `idx_business_cards_user_id` — User filtering
- `idx_business_cards_created_at` — Timeline view
- `idx_business_cards_search_hashes` — GIN index for fast blind search
- `idx_business_cards_industry` — Category filtering
- `idx_business_cards_notes_fts` (optional) — Full-text search on back-side notes

**RLS Policies:**
- Users can only access own cards (SELECT, INSERT, UPDATE, DELETE)
- Service role has admin access

### 7.3 API Contract Updates (v5.0.6+)

**POST /api/save-business-card**

Request body:
```json
{
  "name": "山田太郎",
  "company": "株式会社ABC",
  "title": "営業部長",
  "email": "yamada@abc.co.jp",
  "tel": "+81-90-1234-5678",
  "address": "東京都渋谷区...",
  "notes": "営業用連絡先。定例会は毎週月曜午前。",
  "raw": "OCR生テキスト（表面全体）",
  "thumbnail": "data:image/jpeg;base64,...",
  "scannedAt": "2026-04-14T06:35:00Z"
}
```

Maps to business_cards table:
```json
{
  "attributes": {
    "name": "山田太郎",
    "company": "株式会社ABC",
    "title": "営業部長",
    "email": "yamada@abc.co.jp",
    "tel": "+81-90-1234-5678",
    "address": "東京都渋谷区..."
  },
  "notes": "営業用連絡先。定例会は毎週月曜午前。",
  "ocr_raw_text": "OCR生テキスト（表面全体）",
  "thumbnail_url": "data:image/jpeg;base64,...",
  "scanned_at": "2026-04-14T06:35:00Z",
  "search_hashes": ["株式会社abc", "山田太郎"]
}
```

### 7.4 Phase 7-3 UX/セキュリティ統合（Collapsible + Font Scaling + Backup）

**実装完了日**: 2026-04-14

**実装内容**:

#### アコーディオン化（Collapsible Sections）
- Supabase, Azure, Gemini 設定セクションを HTML `<details>` で折りたたみ化
- 設定完了時は「✓ 設定済み」バッジを表示してデフォルト閉じ
- 部分設定時はデフォルト展開、ユーザーの入力を促す
- ChevronDown アイコンで回転アニメーション

#### フォントサイズスケーリング UI 統合
- 既存 `font-size-context.tsx` と連携
- SettingsPage 内で 4段階選択（小/標準/大/特大）を実装
- リアルタイムで全アプリのテキストサイズと余白を一括更新
- CSS変数 `--base-font-size` をルート `<html>` に適用

#### 緊急時リカバリセクション（Backup Identity）
- **24単語フレーズ表示**: localStorage['encryption_key_b64'] から動的に BIP-39 ニーモニック生成
- **複数バックアップ導線**:
  - **コピーボタン**: 24単語をクリップボードにコピー
  - **電話帳に保存**: `shareOrDownloadVCF()` で .vcf エクスポート
    - 連絡先名: 「あんべの名刺代わり」（固定）
    - 備考欄（NOTE）: 24単語 + 説明文
  - **メールで送信**: `mailto:` スキーム
    - 件名: 「【バックアップ】あんべの名刺代わり・復号キー」
    - 本文: 24単語 + セキュリティ警告
    - 宛先: localStorage['user_email'] で自動入力（未設定なら空欄）

#### ユーザーメアド管理
- SettingsPage にメアド入力フィールド新設
- localStorage['user_email'] で永続化
- メール送信時に自動入力される

#### UI 最適化
- 設定値の「設定済み」バッジ表示で UI をスッキリ化
- デフォルト状態で不必要な詳細情報を非表示
- バッジクリックで アコーディオン自動展開

**Zero-Knowledge 原則の継続**:
- 24単語フレーズ・ユーザーメアドはサーバー非送信
- すべての処理はクライアント側のみで完結
- vCard/mailto は標準 Web API を活用

**ファイル変更**:
- `src/components/SettingsPage.tsx` (1900+ 行)
  - FormState に userEmail フィールド追加
  - expandedSections state 管理
  - Supabase/Azure/Gemini セクションを <details> でラップ
  - BackupKeyDisplay コンポーネント新設
  - 完了判定関数（isSupabaseComplete, isAzureComplete, isGeminiComplete）

**テスト検証**:
✅ アコーディオン開閉機能
✅ フォントサイズリアルタイム変更
✅ 24単語表示（localStorage から自動生成）
✅ コピー機能
✅ vCard エクスポート（Web Share API + ダウンロード対応）
✅ メール送信導線（mailto スキーム）
✅ ユーザーメアド保存・読み込み
✅ TypeScript 型チェック完了
✅ Build 成功（No errors）

---

## 4. 運用・保守 (Operations & Maintenance)

### 4.1 Vercel Cron Jobs による Supabase 生存維持

**目的**: Supabase の無料プランが自動停止されるのを防ぐため、24時間に1回、軽量な API エンドポイントを実行して、プロジェクトをアクティブに保つ。

**アーキテクチャ**:

```
┌─────────────────┐
│ Vercel Cron     │
│ (毎日 0:00 UTC) │
└────────┬────────┘
         │
         ▼
┌──────────────────────────┐
│ /api/cron/keep-alive     │
│ (CRON_SECRET 認証)       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Supabase (SELECT + UPDATE)           │
│ - profiles テーブルへの軽量クエリ     │
│ - 生存確認時刻の更新                  │
└──────────────────────────────────────┘
```

**エンドポイント詳細**:

| 項目 | 説明 |
|------|------|
| **URL** | `/api/cron/keep-alive` |
| **メソッド** | `GET` \| `POST` |
| **認証** | `Authorization: Bearer ${CRON_SECRET}` ヘッダー |
| **リクエスト内容** | リクエストボディなし（ステートレス） |
| **レスポンス** | `{ status: "success", timestamp: "2026-04-14T00:00:00Z" }` |

**セキュリティ**:

1. **CRON_SECRET**: Vercel 環境変数に設定（API エンドポイントで検証）
2. **リクエスト認証**: ヘッダー `Authorization` で Bearer Token 方式
3. **外部からのアクセス防止**: CRON_SECRET が一致した場合のみ処理実行
4. **ログ記録**: Vercel Function Logs に実行時刻・ステータスを記録

**Supabase クエリ内容**:

```sql
-- 1. profiles テーブルの生存確認クエリ
SELECT COUNT(*) FROM profiles LIMIT 1;

-- 2. 生存維持カラムの更新（オプション）
UPDATE profiles 
SET last_activity = NOW()
WHERE id = '<system-user-id>'
LIMIT 1;
```

**コスト効率**:

- **実行頻度**: 1日1回（毎日 0:00 UTC）
- **クエリ軽量性**: SELECT + UPDATE 合計 2 行のみ
- **Vercel 無料枠**: 月 100,000 回の Function 実行 → 30 回で充分（１ヶ月）
- **Supabase 無料枠**: 月 50,000 クエリ実行 → 30 回で充分

**実装ファイル**:

- `/src/app/api/cron/keep-alive/route.ts` — Keep-alive API エンドポイント
- `vercel.json` — Cron スケジュール設定

### 4.2 Vercel 設定 (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "0 0 * * *"
    }
  ]
}
```

| フィールド | 説明 |
|----------|------|
| **path** | API エンドポイント（相対パス） |
| **schedule** | Cron 式（UTC 時刻）<br>`0 0 * * *` = 毎日 0:00 UTC |

**時刻変換**:
- UTC 0:00 = JST 9:00（日本時間）
- 無停止確保のため、日本時間の営業時間後（深夜）に実行

### 4.3 環境変数設定 (Vercel Console)

**Vercel Dashboard**: https://vercel.com/ambeyasuo-hash/ambe_business_card/settings/environment-variables

| キー | 値 | 説明 |
|-----|-----|------|
| `CRON_SECRET` | `<生成されたシークレット>` | API 認証トークン（32 文字以上推奨） |
| `SUPABASE_URL` | 既存値 | Supabase プロジェクト URL |
| `SUPABASE_KEY` | 既存値 | Supabase API キー |

**CRON_SECRET 生成方法**:

```bash
# ターミナルで実行
openssl rand -base64 32
```

結果例: `xY7zK9mP2qLvW5nH8tG3jB6cD4fS1uR9E0=`

### 4.4 運用監視・トラブルシューティング

**ログ確認方法**:

1. Vercel Dashboard → **Deployments** → 最新デプロイ
2. **Functions** タブ → `/api/cron/keep-alive` を選択
3. **Logs** で実行履歴・エラーメッセージを確認

**トラブルシューティング**:

| 症状 | 原因 | 対応 |
|------|------|------|
| `401 Unauthorized` | CRON_SECRET が不一致 | Vercel 環境変数を再確認 |
| `500 Internal Server Error` | Supabase 接続失敗 | SUPABASE_URL/KEY を再確認 |
| Cron が実行されない | vercel.json 未デプロイ | リデプロイして vercel.json を反映 |

**手動トリガー（テスト用）**:

```bash
curl -X GET "https://ambe-business-card.vercel.app/api/cron/keep-alive" \
  -H "Authorization: Bearer <CRON_SECRET>"

# レスポンス例
# { "status": "success", "timestamp": "2026-04-14T00:00:00Z" }
```

---
Version: 5.0.7+ Phoenix Edition (Deep Midnight + Gradient Vitality) Status: Phase 7-3 Complete, Phase 8-1 Planning (c) 2026 ambe / Business_Card_Folder