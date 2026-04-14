'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type FontSize = 'medium' | 'large' | 'extra-large';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZE_SCALE: Record<FontSize, number> = {
  medium: 1.0,      // 16 * 1.0  = 16px (base)
  large: 1.3,       // 16 * 1.3  = 20.8px
  'extra-large': 1.6, // 16 * 1.6 = 25.6px
};

const LS_KEY = 'app_font_size';
const DEFAULT_FONT_SIZE: FontSize = 'medium';

export function FontSizeProvider({ children }: { children: ReactNode }) {
  // ═══════════════════════════════════════════════════════════════════
  // SSR 対策: 初期値は常に DEFAULT_FONT_SIZE
  // useEffect 内でのみ localStorage にアクセス
  // ═══════════════════════════════════════════════════════════════════
  const [fontSize, setFontSizeState] = useState<FontSize>(DEFAULT_FONT_SIZE);

  // Load from localStorage on mount and apply to DOM
  useEffect(() => {
    // SSR-safe: Only access localStorage inside useEffect on client-side
    const saved = localStorage.getItem(LS_KEY) as FontSize | null;
    const sizeToApply = (saved && FONT_SIZE_SCALE[saved]) ? saved : DEFAULT_FONT_SIZE;

    setFontSizeState(sizeToApply);
    applyFontSize(sizeToApply);
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(LS_KEY, size);
    applyFontSize(size);
  };

  // ═══════════════════════════════════════════════════════════════════
  // ハイドレーション修正: 常に children を描画
  // mounted フラグの条件レンダリングを廃止し、useEffect で style 適用
  // ═══════════════════════════════════════════════════════════════════
  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within FontSizeProvider');
  }
  return context;
}

function applyFontSize(size: FontSize) {
  if (typeof document === 'undefined') return;

  const htmlElement = document.documentElement;

  // ═══════════════════════════════════════════════════════════════════
  // 型ミスマッチ解消: data-font-size 属性のみに依存
  // inline style での CSS 変数設定は廃止（文字列型による calc 無効化を防止）
  // ═══════════════════════════════════════════════════════════════════

  // Set data-font-size attribute (CSS rules in globals.css will handle the rest)
  htmlElement.setAttribute('data-font-size', size);

  // Force synchronous DOM style recalculation
  void htmlElement.offsetHeight; // Trigger reflow
}
