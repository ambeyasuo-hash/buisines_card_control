// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useBYOConfig } from "@/hooks/useBYOConfig";

export default function Header() {
  const { loggedIn, userEmail, logout, loaded } = useBYOConfig();

  return (
    <header className="border-b border-black/10 bg-white">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-tight">
          あんべの名刺代わり
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/cards" className="hover:underline">
            名刺一覧
          </Link>
          <Link href="/settings" className="hover:underline">
            設定
          </Link>
          {loaded && (
            loggedIn ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-black/50 hidden sm:inline truncate max-w-[120px]">
                  {userEmail}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-black/60 hover:text-black transition"
                >
                  ログアウト
                </button>
              </span>
            ) : (
              <Link href="/login" className="hover:underline font-medium">
                ログイン
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
