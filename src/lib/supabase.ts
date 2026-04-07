// (c) 2026 ambe / Business_Card_Folder

import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getBYOConfig, setBYOConfig } from "@/lib/utils";

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
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
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

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * メール/パスワードでサインイン。
 * 成功時は Session を返す。失敗時は error.message をスローする。
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<Session> {
  const client = getDynamicSupabase();
  if (!client) throw new Error("Supabase の設定が未完了です（URL / Anon Key を設定してください）");

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error("セッションの取得に失敗しました");
  return data.session;
}

/**
 * メール/パスワードで新規登録。
 * 成功時は Session を返す（メール確認不要の場合）。
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ session: Session | null; needsConfirmation: boolean }> {
  const client = getDynamicSupabase();
  if (!client) throw new Error("Supabase の設定が未完了です（URL / Anon Key を設定してください）");

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  // メール確認が必要な場合 session は null
  return { session: data.session, needsConfirmation: !data.session };
}

/**
 * サインアウト。
 */
export async function signOut(): Promise<void> {
  const client = getDynamicSupabase();
  if (!client) return;
  await client.auth.signOut();
}

/**
 * 現在のセッションを取得する。未ログインの場合は null。
 */
export async function getSession(): Promise<Session | null> {
  const client = getDynamicSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

// ---------------------------------------------------------------------------
// user_settings helpers
// ---------------------------------------------------------------------------

/**
 * ログイン済みユーザーの user_settings を取得する。
 * 存在しない場合は null を返す。
 */
export async function fetchUserSettings(): Promise<
  Database["public"]["Tables"]["user_settings"]["Row"] | null
> {
  const client = getDynamicSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from("user_settings")
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[fetchUserSettings]", error.message);
    return null;
  }
  return data;
}

/**
 * ログイン成功後に呼び出す: user_settings から Gemini API Key を取得し
 * localStorage の BYO_CONFIG へ自動展開する。
 * @returns 取得した gemini_api_key（設定がなければ空文字）
 */
export async function syncUserSettingsToLocal(): Promise<string> {
  const settings = await fetchUserSettings();
  const geminiApiKey = settings?.gemini_api_key ?? "";
  if (geminiApiKey) {
    const current = getBYOConfig();
    setBYOConfig({ ...current, geminiApiKey });
  }
  return geminiApiKey;
}

/**
 * user_settings を upsert する（ログイン後の設定保存に使用）。
 */
export async function upsertUserSettings(
  geminiApiKey: string
): Promise<void> {
  const client = getDynamicSupabase();
  if (!client) throw new Error("Supabase クライアントが未初期化です");

  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  // supabase-js の型推論が `never` に落ちる環境があるため、ここだけ緩める
  const { error } = await (client.from("user_settings") as any).upsert(
    { user_id: user.id, gemini_api_key: geminiApiKey },
    { onConflict: "user_id" }
  );

  if (error) throw new Error(error.message);
}
