// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmail, signUpWithEmail } from "@/lib/supabase";
import { getBYOConfig, setBYOConfig } from "@/lib/utils";

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

  const [config, setConfig] = useState(() => getBYOConfig());
  const canSubmit = Boolean(email && password && config.supabaseUrl && config.supabaseAnonKey);

  useEffect(() => {
    // URLクエリでSupabase設定をインポート: ?supa_url=...&supa_key=...
    const params = new URLSearchParams(window.location.search);
    const supaUrl = params.get("supa_url");
    const supaKey = params.get("supa_key");
    if (!supaUrl && !supaKey) return;

    const current = getBYOConfig();
    const next = {
      ...current,
      ...(supaUrl ? { supabaseUrl: supaUrl } : {}),
      ...(supaKey ? { supabaseAnonKey: supaKey } : {}),
    };
    setBYOConfig(next);
    setConfig(next);

    // 誤って共有URLを再利用しないよう、パラメータはURLから取り除く
    params.delete("supa_url");
    params.delete("supa_key");
    const rest = params.toString();
    router.replace(rest ? `/login?${rest}` : "/login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus({ state: "loading" });

    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
        router.replace("/");
      } else {
        const { needsConfirmation } = await signUpWithEmail(email, password);
        if (needsConfirmation) {
          setStatus({ state: "needs_confirmation" });
          return;
        }
        // メール確認不要の場合はそのままサインイン
        await signInWithEmail(email, password);
        router.replace("/");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      setStatus({ state: "error", message });
    }
  }

  const notConfigured = !config.supabaseUrl || !config.supabaseAnonKey;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 space-y-2">
          <div className="h-12 w-12 rounded-lg bg-blue-600/80 grid place-items-center mx-auto">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
              <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
              <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
              <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">あんべの名刺代わり</h1>
          <p className="text-sm text-slate-400">{mode === "signin" ? "ログイン" : "新規登録"}</p>
        </div>

        {notConfigured && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400 mb-6">
            ⚠️ Supabase URL / Anon Key が未設定です。
            <a href="/settings" className="underline font-medium hover:text-amber-300 ml-1">
              設定画面でキー登録
            </a>
          </div>
        )}

        {status.state === "needs_confirmation" ? (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-4 text-center space-y-2">
            <div className="font-semibold text-blue-300">確認メールを送信しました</div>
            <div className="text-sm text-slate-400">メール内のリンクをクリックして登録を完了してください。</div>
            <div className="mt-3 text-xs text-slate-500 leading-relaxed">
              ※ 本番環境では Supabase Dashboard の <span className="font-medium">Authentication &gt; URL Configuration</span> に本番URL を追加してください。
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">パスワード</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition"
                placeholder="6文字以上"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            {status.state === "error" && (
              <div className="text-sm text-red-400 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                {status.message}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || status.state === "loading"}
              className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium text-white transition shadow-lg shadow-blue-600/35"
            >
              {status.state === "loading"
                ? "処理中..."
                : mode === "signin"
                ? "ログイン"
                : "新規登録"}
            </button>

            <div className="text-center text-sm text-slate-400 pt-2">
              {mode === "signin" ? (
                <>
                  アカウントをお持ちでない方は{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setStatus({ state: "idle" });
                    }}
                    className="underline font-medium text-slate-200 hover:text-white transition"
                  >
                    新規登録
                  </button>
                </>
              ) : (
                <>
                  既にアカウントをお持ちの方は{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setStatus({ state: "idle" });
                    }}
                    className="underline font-medium text-slate-200 hover:text-white transition"
                  >
                    ログイン
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
