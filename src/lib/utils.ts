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
    return { supabaseUrl: "", supabaseAnonKey: "" };
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
      };
    }

    // 互換性: 旧キーが残っている場合は読み取り、最新キーへ移行する
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return { supabaseUrl: envSupabaseUrl, supabaseAnonKey: envSupabaseAnonKey };
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
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return { supabaseUrl: envSupabaseUrl, supabaseAnonKey: envSupabaseAnonKey };
  }
}

export function setBYOConfig(config: BYOConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearBYOConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// 共通ユーティリティ（連絡先・エクスポート用）
// ---------------------------------------------------------------------------

/**
 * mailto: URL を生成する。
 * 改行は CRLF で encode — iOS/Android メーラー対策。
 */
export function toMailtoUrl(input: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const to = input.to ? `mailto:${encodeURIComponent(input.to)}` : "mailto:";
  const params: string[] = [];
  if (input.subject) params.push(`subject=${encodeURIComponent(input.subject)}`);
  if (input.body) params.push(`body=${encodeURIComponent(input.body.replace(/\n/g, "\r\n"))}`);
  return params.length ? `${to}?${params.join("&")}` : to;
}

/**
 * 電話番号から余分な文字を除去し tel: リンク用の文字列を生成する。
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}

/**
 * Blob をブラウザでダウンロードさせる。
 * vcard.ts / csv.ts の共通パターンをここに集約。
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
