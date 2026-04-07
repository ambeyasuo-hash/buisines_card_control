// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useMemo, useState } from "react";
import { useBYOConfig } from "@/hooks/useBYOConfig";
import { getDynamicSupabase } from "@/lib/supabase";

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
  const [testStatus, setTestStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
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
            <label className="text-sm font-medium">Supabase URL</label>
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
            <label className="text-sm font-medium">Supabase Anon Key</label>
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
            <label className="text-sm font-medium">Gemini API Key</label>
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

