# Phoenix Edition v5.0.5 Design System
### 「軍用レベルの堅牢性と、隣人に寄り添う優しさ」を体現する UI/UX ガイドライン

---

## 📋 目次
1. [デザイン哲学](#デザイン哲学)
2. [カラーパレット](#カラーパレット)
3. [タイポグラフィ](#タイポグラフィ)
4. [スペーシング & レイアウト](#スペーシング--レイアウト)
5. [コンポーネント規格](#コンポーネント規格)
6. [実装ルール](#実装ルール)

---

## デザイン哲学

### Minimalist Security
- **Apple のシステムUIのような簡潔さ** — 余分な装飾を排除し、本質的な機能美を追求
- **Notion のような機能美** — 明確な階層構造とスペーシングで迷わない設計
- **Zero-Knowledge Architecture との親和性** — 数字で信頼を構築する

### 色彩心理
- **Blue-600（#2563EB）**: 深い信頼感、プロフェッショナリズム、セキュリティの象徴
- **Emerald-500（#10B981）**: 安全性、成功、成長、隣人への優しさ
- **Slate**: ニュートラルで信頼感のあるベース

---

## カラーパレット

### Primary Colors（推奨使用）
```
背景色:      #F8FAFC (Slate-50)   - 清潔感、安心感
テキスト:    #0F172A (Slate-900)  - 高コントラスト、読みやすさ
Primary:     #2563EB (Blue-600)   - CTA、重要要素
Accent:      #10B981 (Emerald-500) - 成功、ポジティブ
```

### Secondary Colors（補助）
```
Border:      #E2E8F0 (Slate-200)  - 明細感
Text-Sec:    #475569 (Slate-600)  - 副情報
Warning:     #F59E0B (Amber-500)  - 注意
Danger:      #DC2626 (Red-600)    - 危険
```

### 使用例
| 要素 | 色 | 用途 |
|------|------|------|
| CTA Button | Blue-600 | 主要アクション |
| Success | Emerald-500 | 完了、成功メッセージ |
| Warning | Amber-500 | 注意、確認 |
| Error | Red-600 | エラー、削除 |
| Border | Slate-200 | カード、入力欄の枠 |

---

## タイポグラフィ

### フォントファミリー
```css
/* システムフォント優先（ウェブフォント不要） */
font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
           "Helvetica Neue", Arial, "Noto Sans", sans-serif;

font-mono: SFMono-Regular, "SF Mono", Monaco, "Cascadia Code", 
           "Roboto Mono", Consolas, "Courier New", monospace;
```

### サイズ体系
```
xs:   12px / 16px line-height  (補助情報、ラベル)
sm:   14px / 20px line-height  (メタ情報、説明)
base: 16px / 24px line-height  (本文、一般テキスト)
lg:   18px / 28px line-height  (小見出し)
xl:   20px / 28px line-height  (中見出し、font-weight: 600)
2xl:  24px / 32px line-height  (大見出し、font-weight: 700)
3xl:  30px / 36px line-height  (ページタイトル、font-weight: 700)
```

### 使用例
```tsx
// ❌ インラインスタイル禁止
<h1 style={{ fontSize: "24px", fontWeight: "bold" }}>
  見出し
</h1>

// ✅ Tailwind or CSS class
<h1 className="ambe-heading-2">見出し</h1>
```

---

## スペーシング & レイアウト

### 8px Base Unit System
```
1:  4px   (最小単位、アイコン内部)
2:  8px   (パディング、ギャップ)
3:  12px  (スペーサー)
4:  16px  (標準パディング)
5:  20px  (セクション間)
6:  24px  (大セクション間)
```

### モバイルコンテナ（必須）
```tsx
<div className="ambe-container-mobile">
  {/* max-width: 600px, px: 16px, py: 32px */}
  コンテンツ
</div>
```

### レイアウト例
```tsx
// ❌ インラインパディング
<div style={{ padding: "15px 20px" }}>
  NGな例
</div>

// ✅ Tailwind spacing (8px unit)
<div className="p-4">
  OK な例 (16px)
</div>
```

---

## コンポーネント規格

### 1. Card (基本)
```tsx
<div className="ambe-card p-4">
  {/* 
    仕様:
    - 背景: 白
    - ボーダー: 1px Slate-200
    - 角丸: 12px (rounded-lg)
    - シャドウ: shadow-sm
    - ホバー: shadow-md + border-color upgrade
  */}
  カードコンテンツ
</div>
```

### 2. Button (Primary)
```tsx
<button className="ambe-button-primary">
  {/* 
    仕様:
    - 背景: Blue-600
    - テキスト: 白
    - ホバー: Blue-700
    - フォーカス: ring-2 + offset
    - アイコン: gap-2
  */}
  アクション
</button>
```

### 3. Button (Secondary)
```tsx
<button className="ambe-button-secondary">
  {/* 
    仕様:
    - 背景: 白
    - テキスト: Slate-900
    - ボーダー: 2px Slate-300
    - ホバー: Slate-50 bg
  */}
  キャンセル
</button>
```

### 4. Button (Accent)
```tsx
<button className="ambe-button-accent">
  {/* 成功・ポジティブアクション用 */}
  送信
</button>
```

### 5. Input Field
```tsx
<input 
  className="ambe-input" 
  placeholder="入力欄"
/>
```

### 6. Badge
```tsx
<span className="ambe-badge-primary">
  新規
</span>
```

### 7. Link
```tsx
<a href="#" className="ambe-link">
  テキストリンク
</a>
```

---

## 実装ルール

### ✅ DO（推奨）
```tsx
// ✅ CSS classes を使う
<button className="ambe-button-primary">送信</button>

// ✅ Tailwind の標準クラスを使う
<div className="p-4 rounded-lg border border-slate-200">
  コンテンツ
</div>

// ✅ CSS 変数を参照
<div style={{ boxShadow: 'var(--shadow-md)' }}>
  コンテンツ
</div>

// ✅ 複数クラスは className 文字列で
<button className={`ambe-button-primary ${isLoading ? 'opacity-50' : ''}`}>
  送信
</button>
```

### ❌ DON'T（禁止）
```tsx
// ❌ インラインスタイルは絶対禁止
<button style={{ 
  backgroundColor: '#2563EB', 
  padding: '12px 16px' 
}}>
  送信
</button>

// ❌ 独断的なカラーコード
<div style={{ color: '#123456' }}>
  NG
</div>

// ❌ 任意の border-radius
<div style={{ borderRadius: '10px' }}>
  NG
</div>

// ❌ 不規則なパディング
<div style={{ padding: '17px 22px' }}>
  NG
</div>
```

---

## 実装例

### Example: Identity Card Component
```tsx
import { Download } from 'lucide-react';

export function IdentityCard() {
  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="ambe-card p-6">
        <h2 className="ambe-heading-3 mb-4">
          安部ヤスオ
        </h2>
        <p className="ambe-text-secondary mb-6">
          Business Card Folder Architect
        </p>
      </div>

      {/* Action Button */}
      <button className="w-full ambe-button-primary">
        <Download className="ambe-icon-sm" />
        vCard を出力
      </button>
    </div>
  );
}
```

### Example: Form
```tsx
export function ContactForm() {
  return (
    <form className="space-y-4">
      <div className="ambe-form-group">
        <label className="ambe-label">
          メールアドレス
        </label>
        <input 
          className="ambe-input"
          type="email" 
          placeholder="your@email.com"
        />
      </div>

      <button className="w-full ambe-button-primary">
        送信
      </button>
    </form>
  );
}
```

---

## ブランドカラーの動的使用

### CSS Variables で統一管理
```css
:root {
  --color-primary: #2563EB;
  --color-accent: #10B981;
  --color-text: #0F172A;
}
```

```tsx
// JavaScript で色を変更する場合
document.documentElement.style.setProperty(
  '--color-primary', 
  '#2563EB'
);
```

---

## アクセシビリティ (WCAG 2.1 AA)

### カラーコントラスト
- Text on Background: 最小 4.5:1 (通常テキスト)
- UI Components: 最小 3:1 (ボーダー、アイコン)
- **本システムは全て WCAG AA 以上です**

### フォーカス指標
```tsx
// 全ボタンに focus ring
.ambe-button:focus {
  outline: none;
  ring: 2px ring-blue-500 ring-offset-2;
}
```

### Semantic HTML
```tsx
// ✅ 正しい
<button className="ambe-button-primary">
  送信
</button>

// ❌ 間違い
<div className="ambe-button-primary cursor-pointer">
  送信
</div>
```

---

## モバイルファースト設計

### Breakpoints
```
Mobile:   < 640px  (default)
Tablet:   640px    (sm:)
Desktop:  1024px   (lg:)
```

### 容器クエリ
```tsx
<div className="ambe-container">
  {/* 自動的に最大幅 600px, 中央配置 */}
  コンテンツ
</div>
```

---

## パフォーマンス

### システムフォントの利点
- Web フォント読み込み不要 → 高速
- OS ネイティブのレンダリング → 最適
- ユーザーの視認性 → 親しみ

### シャドウの最小化
本システムのシャドウは 4 段階のみ:
- `shadow-sm`: 最小の深さ
- `shadow-md`: 標準の深さ
- `shadow-lg`: カード・モーダル
- `shadow-xl`: 最大の深さ

---

## アップデート手順

1. **新しい要素が必要な場合**
   - まず `DESIGN_SYSTEM.md` を更新
   - `tailwind.config.ts` に追加
   - `globals.css` に `@apply` で定義

2. **全コンポーネントに周知**
   - 既存コンポーネントを可能な限り統一

3. **バージョニング**
   - v5.0.5 で固定（変更なし）
   - 大規模変更時は v5.1.0 へ

---

## 参考資料
- [Tailwind CSS Official](https://tailwindcss.com)
- [WCAG 2.1 Accessibility](https://www.w3.org/WAI/WCAG21/quickref/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)

---

**作成**: 2026-04-13  
**バージョン**: v5.0.5 Phoenix Edition  
**ステータス**: Production Ready
