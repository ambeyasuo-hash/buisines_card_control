// (c) 2026 ambe / Business_Card_Folder
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        scan: {
          "0%": { top: "0%" },
          "50%": { top: "calc(100% - 4px)" },
          "100%": { top: "0%" },
        },
      },
      animation: {
        scan: "scan 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

