import type { BYOConfig } from "@/types";

// ---------------------------------------------------------------------------
// Tailwind CSS v4 クラスマージ
// Tailwind v4 は CSS-first のため clsx のみで十分（twMerge 不要）
// ---------------------------------------------------------------------------
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// BYO Config: localStorage 読み書き
// ---------------------------------------------------------------------------
const STORAGE_KEY = "BYO_CONFIG";
const LEGACY_STORAGE_KEY = "ambe_byo_config";

export function getBYOConfig(): BYOConfig {
  if (typeof window === "undefined") {
    return { supabaseUrl: "", supabaseAnonKey: "", geminiApiKey: "" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BYOConfig;

    // 互換性: 旧キーが残っている場合は読み取り、最新キーへ移行する
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      // localStorage が空の場合は環境変数（Vercel等）をデフォルト値として優先利用する
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      return { supabaseUrl, supabaseAnonKey, geminiApiKey: "" };
    }
    const parsed = JSON.parse(legacyRaw) as BYOConfig;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    return { supabaseUrl, supabaseAnonKey, geminiApiKey: "" };
  }
}

export function setBYOConfig(config: BYOConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearBYOConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
