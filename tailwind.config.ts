// (c) 2026 ambe / Business_Card_Folder
// Phoenix Edition v5.0.5 Design System
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
      },
      animation: {
        scan: "scan 1.6s ease-in-out infinite",
        "scan-beam": "scan-beam 2s linear infinite",
        "bracket-pulse": "bracket-pulse 2s ease-in-out infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

