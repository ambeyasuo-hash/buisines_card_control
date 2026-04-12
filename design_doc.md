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
6. UI/UX デザイン規格 (Ambe Design System) — Phoenix Edition v5.0.5

### 6.1 デザイン哲学
**Minimalist Security** — Apple のシステムUIのような簡潔さを追求。余分な装飾を排除し、本質的な機能美を実現。
**Kindness-Centered UX** — 認証失敗時の救済策（Elegant Rescue）を含め、隣人に寄り添うデザイン。
**Zero-Knowledge Compatibility** — 数字で信頼を構築する視覚言語（信頼色=Blue-600、安全色=Emerald-500）。

### 6.2 カラーパレット
| 用途 | 色 | 値 | 用途 |
|------|------|------|------|
| Primary Color | Blue-600 | #2563EB | CTA、信頼感、セキュリティ象徴 |
| Accent Color | Emerald-500 | #10B981 | 成功、安全性、ポジティブ |
| Surface | White | #FFFFFF | コンテンツ背景 |
| Background | Slate-50 | #F8FAFC | ページ背景、清潔感 |
| Text Primary | Slate-900 | #0F172A | 本文、高コントラスト |
| Text Secondary | Slate-600 | #475569 | 副情報 |
| Border | Slate-200 | #E2E8F0 | カード/入力欄枠線 |
| Warning | Amber-500 | #F59E0B | 注意 |
| Error | Red-600 | #DC2626 | エラー、削除 |

### 6.3 タイポグラフィシステム
**フォントファミリー**: システムフォント優先
```
sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
      "Helvetica Neue", Arial, "Noto Sans", sans-serif
mono: SFMono-Regular, "SF Mono", Monaco, Consolas, "Courier New", monospace
```

**サイズ体系**:
- xs: 12px / 16px line-height (ラベル、補助情報)
- sm: 14px / 20px line-height (メタ情報)
- base: 16px / 24px line-height (本文)
- lg: 18px / 28px line-height (小見出し)
- xl: 20px / 28px line-height (中見出し、font-weight: 600)
- 2xl: 24px / 32px line-height (大見出し、font-weight: 700)
- 3xl: 30px / 36px line-height (ページタイトル、font-weight: 700)

### 6.4 スペーシング & レイアウト
**8px Base Unit System** (全パディング・マージン・ギャップに適用):
```
1: 4px   | 2: 8px   | 3: 12px  | 4: 16px
5: 20px  | 6: 24px  | 8: 32px  | 12: 48px
```

**モバイルセントリック設計**:
- 最大幅: 600px（厳守）
- 中央配置: margin: auto
- パディング: 16px (px-4)
- Breakpoints: Mobile < 640px (default) | Tablet 640px+ (sm:) | Desktop 1024px+ (lg:)

### 6.5 コンポーネント規格

#### Cards
```tsx
.ambe-card {
  背景: 白, ボーダー: 1px Slate-200, 角丸: 12px (rounded-lg)
  シャドウ: shadow-sm, ホバー: shadow-md + border upgrade
}
.ambe-card-elevated { // より高い elevation
  背景: 白, 角丸: 12px, シャドウ: shadow-md
}
```

#### Buttons (5 variants)
```tsx
.ambe-button-primary   // Blue-600 filled, white text
.ambe-button-secondary // White bg, Slate-900 text, 2px border
.ambe-button-accent    // Emerald-500, success/positive action
.ambe-button-danger    // Red-600, destructive action
.ambe-button-ghost     // Transparent, minimal style
```
全ボタン共通: パディング px-4 py-3, 角丸 lg, フォーカス ring-2 ring-offset-2

#### Inputs & Forms
```tsx
.ambe-input {
  パディング: 12px (px-3, py-3), ボーダー: 1px Slate-300, 角丸: lg
  フォーカス: ring-2 ring-blue-500
}
.ambe-label { font-weight: 500, margin-bottom: 8px }
.ambe-form-group { space-y-2, margin-bottom: 16px }
```

#### Typography
```tsx
.ambe-heading-1   // 30px, bold, page title
.ambe-heading-2   // 24px, bold, section
.ambe-heading-3   // 20px, semibold, subsection
.ambe-text-body   // 16px, standard
.ambe-text-secondary // 14px, supporting
.ambe-text-muted  // 12px, hints
```

#### Badges
```tsx
.ambe-badge-primary   // Blue background, blue text
.ambe-badge-accent    // Emerald background
.ambe-badge-warning   // Amber background
.ambe-badge-danger    // Red background
```

#### Icons
```tsx
.ambe-icon-sm  // 16px
.ambe-icon-md  // 20px
.ambe-icon-lg  // 24px
.ambe-icon-xl  // 32px
```

#### Layout & Utilities
```tsx
.ambe-container        // max-width: 600px, mx-auto
.ambe-container-mobile // + px-4 py-8
.ambe-divider          // 1px height, Slate-200
.ambe-link             // Blue-600, underline
.ambe-focus-ring       // ring-2 ring-blue-500 ring-offset-2
.ambe-dialog-overlay   // fixed inset-0, bg-black/50
.ambe-dialog           // modal container
```

### 6.6 実装ルール

✅ **推奨 (DO)**:
```tsx
// CSS classes を使う
<button className="ambe-button-primary">送信</button>

// Tailwind standard class
<div className="p-4 rounded-lg border border-slate-200">

// CSS 変数を参照
<div style={{ boxShadow: 'var(--shadow-md)' }}>

// 複数クラスは className 文字列で
<button className={`ambe-button-primary ${isLoading ? 'opacity-50' : ''}`}>
```

❌ **禁止 (DON'T)**:
```tsx
// インラインスタイルは絶対禁止
<button style={{ backgroundColor: '#2563EB', padding: '12px 16px' }}>

// 独断的なカラーコード
<div style={{ color: '#123456' }}>

// 任意の border-radius
<div style={{ borderRadius: '10px' }}>

// 不規則なパディング
<div style={{ padding: '17px 22px' }}>

// Arbitrary Tailwind values
<div className="w-[157px]">
```

### 6.7 シャドウシステム (4段階のみ)
```
shadow-sm:  0 1px 2px 0 rgba(15,23,42,0.05)   // カード at rest
shadow-md:  0 4px 6px -1px rgba(15,23,42,0.1) // カード on hover
shadow-lg:  0 10px 15px -3px rgba(15,23,42,0.1) // 浮き上がり、モーダル
shadow-xl:  0 20px 25px -5px rgba(15,23,42,0.1) // 最大の深さ
```

### 6.8 ボーダーラディウス階層
```
sm:  4px    (小要素、バッジ)
md:  8px    (ボタン、入力欄)
lg:  12px   ⭐ AMBE STANDARD (カード、コンテナ)
xl:  16px   (モーダル、ダイアログ)
2xl: 24px   (大きなサーフェス)
full: 9999px (円形、ピル)
```

### 6.9 アクセシビリティ (WCAG 2.1 AA)
- **カラーコントラスト**: 最小 4.5:1 (通常テキスト) / 3:1 (UI コンポーネント)
- **フォーカス指標**: 全ボタン・入力欄に ring-2 blue-500 ring-offset-2
- **セマンティック HTML**: 常に適切な要素を使用 (<button>, <input> など)
- **本システムは全て WCAG AA 以上を達成**

### 6.10 モバイルセントリック設計のデスクトップ展開
デスクトップで表示する際も 600px 幅を維持し、以下の手法で視認性を向上:
- **背景色**: ページ背景を Slate-100 に
- **中央コンテナ**: 600px, bg-white, shadow-2xl で「浮き上がって見える」演出
- **視認性**: ホワイトスペースで洗練されたデバイスライク表示

### 6.11 使用パターン

#### Form Group (基本)
```tsx
<div className="ambe-form-group">
  <label className="ambe-label">メールアドレス</label>
  <input className="ambe-input" type="email" />
</div>
```

#### Card + Button (一般的)
```tsx
<div className="ambe-card p-6">
  <h2 className="ambe-heading-3 mb-4">タイトル</h2>
  <p className="ambe-text-secondary mb-6">説明文</p>
  <button className="w-full ambe-button-primary">アクション</button>
</div>
```

#### Modal / Dialog
```tsx
<div className="ambe-dialog-overlay">
  <div className="ambe-dialog p-6">
    <h2 className="ambe-heading-2 mb-4">確認</h2>
    <p className="ambe-text-body mb-6">メッセージ</p>
    <div className="flex gap-2">
      <button className="flex-1 ambe-button-secondary">キャンセル</button>
      <button className="flex-1 ambe-button-primary">確認</button>
    </div>
  </div>
</div>
```

### 6.12 アニメーション
```
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
```

### 6.13 Visual Trust & Slots
**Visual Trust**: 鍵生成プロセスをアニメーション化し、「セキュリティ・コンテキストを構築中」と表示して安心感を可視化。
**Slots**: 「プロフィール（Identity）」、「カード管理（Dashboard）」、「復旧（ElegantRescue）」の各タブを配置。

---
Version: 5.0.5 Phoenix Edition (Elegant Resilience) Status: Implementation Ready (c) 2026 ambe / Business_Card_Folder