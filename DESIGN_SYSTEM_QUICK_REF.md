# Design System Quick Reference
### Phoenix Edition v5.0.5 - Copy & Paste Guide

---

## 🎨 Colors (Hex)
```
Primary:     #2563EB (Blue-600)
Accent:      #10B981 (Emerald-500)
Surface:     #FFFFFF
Background:  #F8FAFC (Slate-50)
Text:        #0F172A (Slate-900)
Border:      #E2E8F0 (Slate-200)
```

---

## 📏 Spacing (px)
```
1:  4px    | 2:  8px    | 3:  12px   | 4:  16px
5:  20px   | 6:  24px   | 8:  32px   | 12: 48px
```

---

## 🔲 Border Radius
```
sm: 4px    | md: 8px    | lg: 12px (STANDARD)
xl: 16px   | 2xl: 24px  | full: 9999px
```

---

## 📦 Common Components

### Card
```tsx
<div className="ambe-card p-4">
  内容
</div>
```

### Buttons
```tsx
<button className="ambe-button-primary">主要アクション</button>
<button className="ambe-button-secondary">副アクション</button>
<button className="ambe-button-accent">成功</button>
<button className="ambe-button-danger">削除</button>
<button className="ambe-button-ghost">ゴースト</button>
```

### Input
```tsx
<input className="ambe-input" placeholder="入力" />
```

### Headings
```tsx
<h1 className="ambe-heading-1">タイトル</h1>
<h2 className="ambe-heading-2">見出し2</h2>
<h3 className="ambe-heading-3">見出し3</h3>
```

### Text
```tsx
<p className="ambe-text-body">本文テキスト</p>
<p className="ambe-text-secondary">副情報</p>
<p className="ambe-text-muted">補足情報</p>
```

### Badge
```tsx
<span className="ambe-badge-primary">タグ</span>
<span className="ambe-badge-accent">成功</span>
<span className="ambe-badge-warning">注意</span>
<span className="ambe-badge-danger">エラー</span>
```

### Link
```tsx
<a href="#" className="ambe-link">リンク</a>
<a href="#" className="ambe-link-subtle">サブリンク</a>
```

### Container
```tsx
<div className="ambe-container-mobile">
  {/* 600px max, centered, px-4, py-8 */}
</div>
```

### Icons
```tsx
<Icon className="ambe-icon-sm" />    {/* 16px */}
<Icon className="ambe-icon-md" />    {/* 20px */}
<Icon className="ambe-icon-lg" />    {/* 24px */}
<Icon className="ambe-icon-xl" />    {/* 32px */}
```

---

## 🎯 Common Patterns

### Form Group
```tsx
<div className="ambe-form-group">
  <label className="ambe-label">ラベル</label>
  <input className="ambe-input" />
</div>
```

### Modal / Dialog
```tsx
<div className="ambe-dialog-overlay">
  <div className="ambe-dialog">
    {/* Content */}
  </div>
</div>
```

### Focus Ring
```tsx
className="ambe-focus-ring"
```

### Divider
```tsx
<div className="ambe-divider" />
```

---

## ❌ FORBIDDEN (Never use these)
```
❌ style={{ padding: '15px' }}
❌ style={{ color: '#123456' }}
❌ style={{ borderRadius: '10px' }}
❌ <div className="custom-button" style={{...}}>
❌ Arbitrary colors (not in palette)
❌ Non-8px spacing values
```

---

## ✅ ALWAYS DO
```
✅ Use ambe-* classes
✅ Use Tailwind utilities
✅ Use CSS variables
✅ Keep spacing in 8px units
✅ Use system fonts (no @import)
✅ Use lg (12px) for card radius
✅ Test on mobile (600px max)
```

---

## 🎬 Animation Timing
```
--transition-fast: 150ms
--transition-base: 200ms
--transition-slow: 300ms
```

---

## 🔍 Testing Checklist
- [ ] Mobile viewport (375px to 600px)
- [ ] Focus ring visible on all buttons
- [ ] Text contrast 4.5:1 minimum
- [ ] No inline styles used
- [ ] All spacing in multiples of 4px
- [ ] Colors from palette only
- [ ] System font rendering correct

---

## 📞 Questions?
→ See `DESIGN_SYSTEM.md` for full documentation

**Version**: v5.0.5  
**Last Updated**: 2026-04-13
