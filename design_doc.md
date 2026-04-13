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
2. セキュリティ・アーキテクチャ (Zero-Knowledge & Recovery)
2.1 分散型多層鍵管理 (Distributed Trust)
メイン認証: WebAuthn（FaceID/指紋認証）により保護された端末内秘密鍵
。
フォールバック: ユーザー設定パスコードから PBKDF2 (HMAC-SHA256, 10万回反復) により派生させた鍵
。
リカバリ: 24単語の物理リカバリキー生成と整合性テストの強制に加え、端末の連絡先に「復旧用パスコード」を自動作成する救済フローを実装
。
2.2 Azure AI Document Intelligence (Japan East)
ローカルOCRを廃止し、AzureのPrebuiltモデルに集約。データ学習・ログ保存はオプトアウト設定済みの法人契約APIを使用
。
解析後の元画像はDBに保存せず、メモリから即座に抹消
。

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

### 6.12 Visual Trust & Slots
**Visual Trust**: 鍵生成プロセスをアニメーション化し、「セキュリティ・コンテキストを構築中」と表示して安心感を可視化。
**Slots**: 「スキャン（Identity）」、「名刺一覧（Dashboard）」、「設定（ElegantRescue）」の3タブを配置。
**Device Frame**: デスクトップでは 390px デバイスフレーム（Dynamic Island・ホームインジケーター付き）をブラウザ中央に表示。

---
Version: 5.0.6 Phoenix Edition (Deep Midnight + Gradient Vitality) Status: Implementation Ready (c) 2026 ambe / Business_Card_Folder