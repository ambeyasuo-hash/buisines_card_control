// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useBYOConfig } from "@/hooks/useBYOConfig";

function Tile({
  href,
  title,
  desc,
  icon: Icon,
  color,
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "violet";
  disabled?: boolean;
}) {
  const colorMap = {
    blue: "border-blue-500/20 bg-white/[0.03] hover:border-blue-500/35 hover:shadow-lg hover:shadow-blue-500/10 group",
    emerald: "border-emerald-500/15 bg-white/[0.03] hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/10",
    violet: "border-violet-500/15 bg-white/[0.03] hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10",
  };

  const iconBgMap = {
    blue: "bg-blue-600/20 border-blue-500/25",
    emerald: "bg-emerald-500/20 border-emerald-500/25",
    violet: "bg-violet-500/20 border-violet-500/25",
  };

  const iconColorMap = {
    blue: "text-blue-200",
    emerald: "text-emerald-200",
    violet: "text-violet-200",
  };

  if (disabled) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 opacity-50 pointer-events-none">
        <div className="flex items-center gap-3.5">
          <div className={`h-14 w-14 rounded-2xl ${iconBgMap[color]} border grid place-items-center shrink-0`}>
            <div className={`h-6 w-6 ${iconColorMap[color]}`}>{Icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white">{title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
          </div>
          <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <Link href={href}>
      <div className={`rounded-2xl border p-4 transition-all cursor-pointer ${colorMap[color]}`} style={{ boxShadow: color === "blue" ? "0 0 20px rgba(59,130,246,0.06)" : "none" }}>
        <div className="flex items-center gap-3.5">
          <div className={`h-14 w-14 rounded-2xl ${iconBgMap[color]} border grid place-items-center shrink-0`}>
            <div className={`h-6 w-6 ${iconColorMap[color]}`}>{Icon}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-white">{title}</div>
            <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
          </div>
          <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function RootPage() {
  const { isConfigured, isReady, loaded, loggedIn, userEmail, logout } = useBYOConfig();
  const disabled = loaded ? !isReady : true;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* グローバルヘッダー */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-blue-600/80 grid place-items-center">
            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
              <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
              <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
              <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">あんべの名刺代わり</span>
        </div>
        {loggedIn && (
          <button
            type="button"
            onClick={logout}
            className="text-xs text-slate-400 flex items-center gap-1 hover:text-slate-200 transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            ログアウト
          </button>
        )}
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 px-5 py-8">
        {/* ページヘッダー */}
        <div className="text-center space-y-1 mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Dashboard</p>
          <h2 className="text-2xl font-bold text-white tracking-tight">あんべの名刺代わり</h2>
          <p className="text-xs text-slate-400">現場での出会いを最速でお礼メールと資産に変える</p>
        </div>

        {/* 警告バナー */}
        {loaded && !isConfigured && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
            ⚠️ Supabase URL / Anon Key が未設定です。
            <Link href="/settings" className="ml-2 underline font-medium hover:text-amber-300">
              設定画面へ
            </Link>
          </div>
        )}
        {loaded && isConfigured && !loggedIn && (
          <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-300">
            ログインするとデータの保存・同期が可能になります。
            <Link href="/login" className="ml-2 underline font-medium hover:text-blue-200">
              ログイン
            </Link>
          </div>
        )}
        {loaded && loggedIn && !isReady && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
            ⚠️ Gemini API Key が未設定です。
            <Link href="/settings" className="ml-2 underline font-medium hover:text-amber-300">
              設定画面でキーを登録してください
            </Link>
          </div>
        )}

        {/* タイルグリッド */}
        <div className="space-y-3">
          <Tile
            href="/cards/new"
            title="名刺をスキャン"
            desc="カメラで撮影してAI解析"
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            color="blue"
            disabled={disabled}
          />
          <Tile
            href="/cards"
            title="名刺一覧"
            desc="保存済みの名刺を確認"
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
            color="emerald"
            disabled={disabled}
          />
          <Tile
            href="/settings"
            title="設定"
            desc="API キーとプロフィール"
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            color="violet"
            disabled={false}
          />
        </div>

        <p className="text-center text-[10px] text-slate-700 pt-8">© 2026 ambe / Business_Card_Folder</p>
      </div>
    </div>
  );
}
