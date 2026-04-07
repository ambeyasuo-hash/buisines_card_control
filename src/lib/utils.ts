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
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BYOConfig>;
      return {
        supabaseUrl: typeof parsed.supabaseUrl === "string" && parsed.supabaseUrl ? parsed.supabaseUrl : envSupabaseUrl,
        supabaseAnonKey:
          typeof parsed.supabaseAnonKey === "string" && parsed.supabaseAnonKey
            ? parsed.supabaseAnonKey
            : envSupabaseAnonKey,
        geminiApiKey: typeof parsed.geminiApiKey === "string" ? parsed.geminiApiKey : "",
      };
    }

    // 互換性: 旧キーが残っている場合は読み取り、最新キーへ移行する
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      // localStorage が空の場合は環境変数（Vercel等）をデフォルト値として優先利用する
      return { supabaseUrl: envSupabaseUrl, supabaseAnonKey: envSupabaseAnonKey, geminiApiKey: "" };
    }
    const legacyParsed = JSON.parse(legacyRaw) as Partial<BYOConfig>;
    const migrated: BYOConfig = {
      supabaseUrl:
        typeof legacyParsed.supabaseUrl === "string" && legacyParsed.supabaseUrl
          ? legacyParsed.supabaseUrl
          : envSupabaseUrl,
      supabaseAnonKey:
        typeof legacyParsed.supabaseAnonKey === "string" && legacyParsed.supabaseAnonKey
          ? legacyParsed.supabaseAnonKey
          : envSupabaseAnonKey,
      geminiApiKey: typeof legacyParsed.geminiApiKey === "string" ? legacyParsed.geminiApiKey : "",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return { supabaseUrl: envSupabaseUrl, supabaseAnonKey: envSupabaseAnonKey, geminiApiKey: "" };
  }
}

export function setBYOConfig(config: BYOConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearBYOConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
