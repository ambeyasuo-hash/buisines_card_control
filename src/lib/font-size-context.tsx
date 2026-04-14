'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZE_SCALE: Record<FontSize, number> = {
  small: 0.9,       // 16 * 0.9 = 14.4px
  medium: 1.0,      // 16 * 1.0  = 16px (base)
  large: 1.4,       // 16 * 1.4  = 22.4px
  'extra-large': 1.75, // 16 * 1.75 = 28px
};

const LS_KEY = 'app_font_size';
const DEFAULT_FONT_SIZE: FontSize = 'medium';

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(DEFAULT_FONT_SIZE);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as FontSize | null;
    if (saved && FONT_SIZE_SCALE[saved]) {
      setFontSizeState(saved);
      applyFontSize(saved);
    }
    setMounted(true);
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(LS_KEY, size);
    applyFontSize(size);
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {mounted && children}
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
  const scale = FONT_SIZE_SCALE[size];
  const baseSize = 16; // 1rem = 16px
  const newSize = Math.round(baseSize * scale);

  if (typeof document !== 'undefined') {
    // Set CSS variable for dynamic scaling
    document.documentElement.style.setProperty('--base-font-size', scale.toString());
    // Also set font-size directly for backward compatibility
    document.documentElement.style.fontSize = `${newSize}px`;
  }
}

// Export for server-side usage (to set initial size from localStorage)
export function applyFontSizeFromStorage() {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(LS_KEY) as FontSize | null;
    if (saved && FONT_SIZE_SCALE[saved]) {
      applyFontSize(saved);
    }
  }
}
