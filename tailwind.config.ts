// (c) 2026 ambe / Business_Card_Folder
// Ambe Design System v5.0.6 — Obsidian & Champagne Gold Edition
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    colors: {
      // Ambe Design System Color Palette
      white: "#FFFFFF",
      slate: {
        50: "#F8FAFC",
        100: "#F1F5F9",
        200: "#E2E8F0",
        300: "#CBD5E1",
        400: "#94A3B8",
        500: "#64748B",
        600: "#475569",
        700: "#334155",
        800: "#1E293B",
        900: "#0F172A",
        950: "#020617",
      },
      blue: {
        50: "#EFF6FF",
        100: "#DBEAFE",
        200: "#BFDBFE",
        300: "#93C5FD",
        400: "#60A5FA",
        500: "#3B82F6",
        600: "#2563EB", // Primary Trust Color
        700: "#1D4ED8",
        800: "#1E40AF",
        900: "#1E3A8A",
      },
      emerald: {
        50: "#F0FDF4",
        100: "#DCFCE7",
        200: "#BBF7D0",
        300: "#86EFAC",
        400: "#4ADE80",
        500: "#10B981", // Accent Success Color
        600: "#059669",
        700: "#047857",
        800: "#065F46",
        900: "#064E3B",
      },
      amber: {
        50: "#FFFBEB",
        100: "#FEF3C7",
        200: "#FDE68A",
        300: "#FCD34D",
        400: "#FBBF24",
        500: "#F59E0B",
        600: "#D97706",
        700: "#B45309",
        800: "#92400E",
        900: "#78350F",
      },
      red: {
        50: "#FEF2F2",
        100: "#FEE2E2",
        200: "#FECACA",
        300: "#FCA5A5",
        400: "#F87171",
        500: "#EF4444",
        600: "#DC2626",
        700: "#B91C1C",
        800: "#991B1B",
        900: "#7F1D1D",
      },
      cyan: {
        300: "#67E8F9",
        400: "#22D3EE",
        500: "#06B6D4",
      },
      teal: {
        400: "#2DD4BF",
        500: "#14B8A6",
        600: "#0D9488",
      },
      purple: {
        400: "#C084FC",
        500: "#A855F7",
        600: "#9333EA",
      },
      pink: {
        400: "#F472B6",
        500: "#EC4899",
      },
      // ── v5.0.6: Obsidian & Champagne Gold ────────────────────────────────
      gold: {
        100: "#F5EAB0",
        200: "#EDD97A",
        300: "#E4C84A",
        400: "#D4AF37", // Champagne Gold (primary accent)
        500: "#B8960C",
        600: "#9A7B0A",
      },
      silver: {
        200: "#E8E8E8",
        300: "#D0D0D0",
        400: "#C0C0C0", // Silver (secondary accent)
        500: "#A8A8A8",
        600: "#909090",
      },
      obsidian: {
        DEFAULT: "#000000",
        50:  "#0A0A0A",
        100: "#111111",
        200: "#1A1A1A",
        300: "#242424",
      },
      transparent: "transparent",
      current: "currentColor",
    },
    fontFamily: {
      // System fonts prioritized for clean aesthetics
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        '"Noto Sans"',
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
      ],
      mono: [
        "ui-monospace",
        "SFMono-Regular",
        '"SF Mono"',
        "Monaco",
        '"Cascadia Code"',
        '"Roboto Mono"',
        "Consolas",
        '"Courier New"',
        "monospace",
      ],
    },
    fontSize: {
      // Semantic size scale
      xs: ["12px", { lineHeight: "16px", letterSpacing: "0.5px" }],
      sm: ["14px", { lineHeight: "20px", letterSpacing: "0.25px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["18px", { lineHeight: "28px" }],
      xl: ["20px", { lineHeight: "28px", fontWeight: "600" }],
      "2xl": ["24px", { lineHeight: "32px", fontWeight: "700" }],
      "3xl": ["30px", { lineHeight: "36px", fontWeight: "700" }],
    },
    spacing: {
      // 8px base unit system
      0: "0",
      1: "4px",
      2: "8px",
      3: "12px",
      4: "16px",
      5: "20px",
      6: "24px",
      7: "28px",
      8: "32px",
      9: "36px",
      10: "40px",
      12: "48px",
      14: "56px",
      16: "64px",
      20: "80px",
      24: "96px",
      32: "128px",
    },
    borderRadius: {
      // Clear rounding hierarchy
      none: "0",
      sm: "4px",
      md: "8px",
      lg: "12px", // Ambe standard card radius
      xl: "16px",
      "2xl": "24px",
      full: "9999px",
    },
    boxShadow: {
      // Subtle depth cues
      none: "0 0 0 0 rgba(0,0,0,0)",
      sm: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
      DEFAULT:
        "0 1px 3px 0 rgba(15, 23, 42, 0.1), 0 1px 2px -1px rgba(15, 23, 42, 0.1)",
      md: "0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)",
      lg: "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.1)",
      xl: "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)",
      "2xl": "0 25px 50px -12px rgba(15, 23, 42, 0.15)",
    },
    extend: {
      keyframes: {
        scan: {
          "0%": { top: "0%" },
          "50%": { top: "calc(100% - 4px)" },
          "100%": { top: "0%" },
        },
        "scan-beam": {
          "0%": { transform: "translateY(-60px)" },
          "100%": { transform: "translateY(360px)" },
        },
        "bracket-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(37, 99, 235, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(37, 99, 235, 0.5)" },
        },
        // ── v5.0.6 Luxury Animations ───────────────────────────────────────
        // 静寂と信頼: 息を吸うような、ゆっくりとした光の動き
        "gold-breathe": {
          "0%, 100%": { opacity: "0.15", transform: "scale(0.82)" },
          "50%":       { opacity: "1",    transform: "scale(1)" },
        },
        "light-thread": {
          "0%":   { transform: "translateX(-120%)", opacity: "0" },
          "15%":  { opacity: "1" },
          "85%":  { opacity: "1" },
          "100%": { transform: "translateX(520%)",  opacity: "0" },
        },
        "shimmer-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212,175,55,0)" },
          "50%":       { boxShadow: "0 0 0 6px rgba(212,175,55,0.12), 0 0 24px rgba(212,175,55,0.08)" },
        },
        "gold-fade-in": {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        scan: "scan 1.6s ease-in-out infinite",
        "scan-beam": "scan-beam 2s linear infinite",
        "bracket-pulse": "bracket-pulse 2s ease-in-out infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        // v5.0.6 luxury
        "gold-breathe":  "gold-breathe 2.4s cubic-bezier(0.45,0,0.55,1) infinite",
        "light-thread":  "light-thread 2.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "shimmer-pulse": "shimmer-pulse 2.6s ease-in-out infinite",
        "gold-fade-in":  "gold-fade-in 0.5s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;

