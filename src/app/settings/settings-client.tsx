// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useEffect, useMemo, useState } from "react";
import { useBYOConfig } from "@/hooks/useBYOConfig";
import { getDynamicSupabase, upsertUserSettings } from "@/lib/supabase";
import type { Database } from "@/types/database";
import { ExternalLink } from "lucide-react";

type Props = {
  schemaSql: string;
};

export default function SettingsClient({ schemaSql }: Props) {
  const { config, save, clear, isConfigured, loaded } = useBYOConfig();

  const [supabaseUrl, setSupabaseUrl] = useState(config.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(config.supabaseAnonKey);
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey);

  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok" }
    | { state: "ng"; message: string }
  >({ state: "idle" });

  const [profile, setProfile] = useState<{ user_display_name: string; user_organization: string }>({
    user_display_name: "",
    user_organization: "",
  });
  const [profileStatus, setProfileStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "ok" }
    | { state: "ng"; message: string }
  >({ state: "idle" });

  const [cats, setCats] = useState<Array<Database["public"]["Tables"]["categories"]["Row"]>>([]);
  const [catsStatus, setCatsStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "ok" }
    | { state: "ng"; message: string }
  >({ state: "idle" });

  // 初回ロード時にフォームへ反映
  useMemo(() => {
    if (!loaded) return;
    setSupabaseUrl(config.supabaseUrl);
    setSupabaseAnonKey(config.supabaseAnonKey);
    setGeminiApiKey(config.geminiApiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const client = getDynamicSupabase();
    if (!client) return;
    const c = client;
    let cancelled = false;

    async function run() {
      setAuthMsg(null);
      setProfileStatus({ state: "loading" });
      setCatsStatus({ state: "loading" });
      try {
        const { data: userData } = await c.auth.getUser();
        if (!userData.user) {
          if (!cancelled) setAuthMsg("カテゴリ/ユーザー設定の保存にはログインが必要です（/login）");
        }

        const [settingsRes, catsRes] = await Promise.all([
          c.from("user_settings").select("user_display_name,user_organization").maybeSingle(),
          c
            .from("categories")
            .select("id,user_id,name,color_hex,email_tone,category_footer,created_at")
            .order("created_at", { ascending: true }),
        ]);
        if (settingsRes.error) throw settingsRes.error;
        if (catsRes.error) throw catsRes.error;

        if (cancelled) return;
        const settingsData = settingsRes.data as any;
        setProfile({
          user_display_name: settingsData?.user_display_name ?? "",
          user_organization: settingsData?.user_organization ?? "",
        });
        setProfileStatus({ state: "ok" });
        setCats((catsRes.data ?? []) as any);
        setCatsStatus({ state: "ok" });
      } catch (e) {
        const message = e instanceof Error ? e.message : "読み込みに失敗しました";
        if (!cancelled) {
          setProfileStatus({ state: "ng", message });
          setCatsStatus({ state: "ng", message });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loaded]);

  const canSave = Boolean(supabaseUrl && supabaseAnonKey && geminiApiKey);

  async function onCopySql() {
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopyMsg("コピーしました");
      window.setTimeout(() => setCopyMsg(null), 1500);
    } catch {
      setCopyMsg("コピーに失敗しました（クリップボード権限をご確認ください）");
      window.setTimeout(() => setCopyMsg(null), 2500);
    }
  }

  function onSave() {
    save({ supabaseUrl, supabaseAnonKey, geminiApiKey });
    setSaveMsg("保存しました");
    window.setTimeout(() => setSaveMsg(null), 1500);
  }

  function onClear() {
    clear();
    setSupabaseUrl("");
    setSupabaseAnonKey("");
    setGeminiApiKey("");
    setSaveMsg("削除しました");
    window.setTimeout(() => setSaveMsg(null), 1500);
  }

  async function onTestConnection() {
    setTestStatus({ state: "running" });
    try {
      const client = getDynamicSupabase();
      if (!client) {
        setTestStatus({ state: "ng", message: "設定が未保存です（先に保存してください）" });
        return;
      }
      const { error } = await client.auth.getSession();
      if (error) {
        setTestStatus({ state: "ng", message: error.message });
        return;
      }
      setTestStatus({ state: "ok" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "不明なエラー";
      setTestStatus({ state: "ng", message });
    }
  }

  async function onSaveProfile() {
    setProfileStatus({ state: "loading" });
    try {
      await upsertUserSettings({
        userDisplayName: profile.user_display_name,
        userOrganization: profile.user_organization,
      });
      setProfileStatus({ state: "ok" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存に失敗しました";
      setProfileStatus({ state: "ng", message });
    }
  }

  async function onSaveCategory(idx: number) {
    const client = getDynamicSupabase();
    if (!client) return;
    const row = cats[idx];
    setCatsStatus({ state: "loading" });
    try {
      const { error } = await (client.from("categories") as any)
        .update({ email_tone: row.email_tone, category_footer: row.category_footer })
        .eq("id", row.id);
      if (error) throw error;
      setCatsStatus({ state: "ok" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存に失敗しました";
      setCatsStatus({ state: "ng", message });
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold">BYO キー設定</h2>
            <p className="text-sm text-muted-foreground">
              Supabase URL / Anon Key と Gemini API Key を入力してください。
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {isConfigured ? "設定済み" : "未設定"}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>Supabase URL</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Supabase Dashboard <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </label>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="https://xxxx.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>Supabase Anon Key</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                取得先 <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </label>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="eyJhbGciOi..."
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>Gemini API Key</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Google AI Studio <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </label>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="AIza..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              onClick={onTestConnection}
              className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
              disabled={testStatus.state === "running"}
            >
              {testStatus.state === "running" ? "接続テスト中..." : "接続テスト"}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium text-destructive"
            >
              削除
            </button>

            <div className="ml-auto text-sm text-muted-foreground">
              {saveMsg ?? ""}
            </div>
          </div>

          {testStatus.state === "ok" ? (
            <div className="text-sm text-emerald-600">接続OK（認証エンドポイント到達）</div>
          ) : testStatus.state === "ng" ? (
            <div className="text-sm text-destructive">
              接続NG: {testStatus.message}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold">ユーザー設定（メール署名）</h2>
            <p className="text-sm text-muted-foreground">
              お礼メール生成の差出人情報に使います。
            </p>
            {authMsg ? (
              <p className="text-xs text-muted-foreground mt-1">{authMsg}</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">表示名</label>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profile.user_display_name}
              onChange={(e) =>
                setProfile({ ...profile, user_display_name: e.target.value })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">所属（会社/屋号など）</label>
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={profile.user_organization}
              onChange={(e) =>
                setProfile({ ...profile, user_organization: e.target.value })
              }
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onSaveProfile}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={profileStatus.state === "loading"}
            >
              {profileStatus.state === "loading" ? "保存中..." : "保存"}
            </button>
            {profileStatus.state === "ng" ? (
              <div className="text-sm text-destructive">{profileStatus.message}</div>
            ) : profileStatus.state === "ok" ? (
              <div className="text-sm text-emerald-600">保存しました</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-3">
          <h2 className="font-semibold">カテゴリ別メール設定</h2>
          <p className="text-sm text-muted-foreground">
            トーン指示とカテゴリ専用フッターを管理します。
          </p>
        </div>

        {catsStatus.state === "ng" ? (
          <div className="mb-3 text-sm text-destructive">{catsStatus.message}</div>
        ) : null}

        <div className="space-y-4">
          {cats.map((c, idx) => (
            <div key={c.id} className="rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color_hex }}
                    aria-hidden="true"
                  />
                  <div className="font-medium truncate">{c.name}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSaveCategory(idx)}
                  className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium"
                  disabled={catsStatus.state === "loading"}
                >
                  保存
                </button>
              </div>

              <div className="grid gap-3 mt-3">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">メールトーン（email_tone）</label>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    placeholder='例: "フォーマル" / "フレンドリー"'
                    value={c.email_tone}
                    onChange={(e) => {
                      const next = [...cats];
                      next[idx] = { ...c, email_tone: e.target.value };
                      setCats(next);
                    }}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">カテゴリ専用フッター（category_footer）</label>
                  <textarea
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                    placeholder="例: 署名や一言を追記"
                    value={c.category_footer}
                    onChange={(e) => {
                      const next = [...cats];
                      next[idx] = { ...c, category_footer: e.target.value };
                      setCats(next);
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {catsStatus.state === "loading" ? (
            <div className="text-sm text-muted-foreground">読込/保存中...</div>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold">SQLウィザード（テーブル作成）</h2>
            <p className="text-sm text-muted-foreground">
              Supabase の SQL Editor で実行してテーブルを作成してください。
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ※ テーブル定義が更新されたため、既存ユーザーはテーブルの再作成が必要です。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopySql}
              className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
            >
              テーブル作成用SQLをコピー
            </button>
            <div className="text-sm text-muted-foreground">{copyMsg ?? ""}</div>
          </div>
        </div>

        <pre className="max-h-[420px] overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
          {schemaSql}
        </pre>
      </section>
    </div>
  );
}

