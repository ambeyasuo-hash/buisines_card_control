// (c) 2026 ambe / Business_Card_Folder
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          950: "#020617",
        },
      },
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
      },
      animation: {
        scan: "scan 1.6s ease-in-out infinite",
        "scan-beam": "scan-beam 2s linear infinite",
        "bracket-pulse": "bracket-pulse 2s ease-in-out infinite",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

