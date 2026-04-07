import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const STORAGE_KEY = "BYO_CONFIG";

let cachedClient: SupabaseClient<Database> | null = null;
let cachedFingerprint: string | null = null;

/**
 * BYO方式: ユーザー提供のURL/キーからSupabaseクライアントを動的生成する。
 * サーバー側の環境変数には依存しない。
 */
export function createBYOClient(
  supabaseUrl: string,
  supabaseAnonKey: string
): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

/**
 * localStorage に有効な接続情報がある場合のみクライアントを返す。
 * 未設定の場合は null を返す。
 * クライアントサイドでのみ呼び出すこと。
 */
export function getDynamicSupabase(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null;

  let supabaseUrl = "";
  let supabaseAnonKey = "";

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      supabaseUrl: unknown;
      supabaseAnonKey: unknown;
    }>;
    supabaseUrl = typeof parsed.supabaseUrl === "string" ? parsed.supabaseUrl : "";
    supabaseAnonKey =
      typeof parsed.supabaseAnonKey === "string" ? parsed.supabaseAnonKey : "";
  } catch {
    return null;
  }

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const fingerprint = `${supabaseUrl}::${supabaseAnonKey}`;
  if (cachedClient && cachedFingerprint === fingerprint) return cachedClient;

  cachedFingerprint = fingerprint;
  cachedClient = createBYOClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}
