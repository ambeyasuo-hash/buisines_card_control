// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail, signUpWithEmail, syncUserSettingsToLocal } from "@/lib/supabase";
import { getBYOConfig } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "needs_confirmation" }
  >({ state: "idle" });

  const config = getBYOConfig();
  const canSubmit = Boolean(email && password && config.supabaseUrl && config.supabaseAnonKey);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ state: "loading" });

    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        await syncUserSettingsToLocal();
        router.replace("/");
      } else {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          setStatus({ state: "needs_confirmation" });
          return;
        }
        // メール確認不要の場合はそのままサインイン
        await signInWithEmail(email, password);
        await syncUserSettingsToLocal();
        router.replace("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      setStatus({ state: "error", message });
    }
  }

  const notConfigured = !config.supabaseUrl || !config.supabaseAnonKey;

  return (
    <div className="container mx-auto px-4 py-12 max-w-sm">
      <div className="text-center mb-8">
        <div className="text-2xl font-bold tracking-tight">あんべの名刺代わり</div>
        <div className="mt-1 text-sm text-black/60">
          {mode === "signin" ? "ログイン" : "新規登録"}
        </div>
      </div>

      {notConfigured ? (
        <div className="rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-6">
          ⚠️ Supabase URL / Anon Key が未設定です。
          先に{" "}
          <a href="/settings" className="underline font-medium">
            設定画面
          </a>
          {" "}でキーを登録してください。
        </div>
      ) : null}

      {status.state === "needs_confirmation" ? (
        <div className="rounded-lg border bg-blue-50 px-4 py-4 text-sm text-blue-900 text-center">
          <div className="font-semibold mb-1">確認メールを送信しました</div>
          <div className="text-black/60">
            メール内のリンクをクリックして登録を完了してください。
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">パスワード</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="6文字以上"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          {status.state === "error" ? (
            <div className="text-sm text-red-600 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              {status.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || status.state === "loading"}
            className="w-full h-10 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {status.state === "loading"
              ? "処理中..."
              : mode === "signin"
              ? "ログイン"
              : "新規登録"}
          </button>

          <div className="text-center text-sm text-black/60">
            {mode === "signin" ? (
              <>
                アカウントをお持ちでない方は{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setStatus({ state: "idle" }); }}
                  className="underline font-medium text-foreground"
                >
                  新規登録
                </button>
              </>
            ) : (
              <>
                既にアカウントをお持ちの方は{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signin"); setStatus({ state: "idle" }); }}
                  className="underline font-medium text-foreground"
                >
                  ログイン
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
