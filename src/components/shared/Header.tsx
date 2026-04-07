// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useBYOConfig } from "@/hooks/useBYOConfig";

export default function Header() {
  const { loggedIn, userEmail, logout, loaded } = useBYOConfig();

  return (
    <header className="border-b border-slate-900/10 bg-slate-950 text-slate-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-50">
          あんべの名刺代わり
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/cards" className="text-slate-50/90 hover:text-slate-50">
            名刺一覧
          </Link>
          <Link href="/settings" className="text-slate-50/90 hover:text-slate-50">
            設定
          </Link>
          {loaded && (
            loggedIn ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-50/70 hidden sm:inline truncate max-w-[120px]">
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-slate-50/75 hover:text-slate-50 transition"
                >
                  ログアウト
                </button>
              </span>
            ) : (
              <Link href="/login" className="text-slate-50 hover:text-slate-50/90 font-bold">
                ログイン
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
