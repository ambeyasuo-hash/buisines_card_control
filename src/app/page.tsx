// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useBYOConfig } from "@/hooks/useBYOConfig";

function Tile({
  href,
  title,
  desc,
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  const base =
    "h-24 rounded-xl border bg-white p-4 text-left transition shadow-sm";
  const enabled = "hover:shadow-md hover:border-black/20";
  const off = "opacity-50 pointer-events-none";

  return (
    <Link href={href} className={`${base} ${disabled ? off : enabled}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sm text-black/60">{desc}</div>
    </Link>
  );
}

export default function RootPage() {
  const { isConfigured, isReady, loaded, loggedIn, userEmail, logout } = useBYOConfig();
  const disabled = loaded ? !isReady : true;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="text-center mb-8">
        <div className="text-3xl font-bold tracking-tight">あんべの名刺代わり</div>
        <div className="mt-2 text-sm text-black/60">
          現場での出会いを、最速で資産に。
        </div>
      </div>

      {/* 認証ステータスバー */}
      {loaded ? (
        <div className="mb-6 flex items-center justify-between rounded-lg border bg-white px-4 py-2.5 text-sm shadow-sm">
          {loggedIn ? (
            <>
              <span className="text-emerald-600 font-medium">
                ログイン中: {userEmail}
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-black/50 hover:text-black transition text-xs"
              >
                ログアウト
              </button>
            </>
          ) : (
            <>
              <span className="text-black/60">未ログイン</span>
              <Link href="/login" className="text-xs font-medium underline">
                ログイン / 新規登録
              </Link>
            </>
          )}
        </div>
      ) : null}

      {/* 警告バナー */}
      {loaded && !isConfigured ? (
        <div className="mb-4 rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ Supabase URL / Anon Key が未設定です。
          <Link href="/settings" className="ml-1 underline font-medium">
            設定画面へ
          </Link>
        </div>
      ) : loaded && isConfigured && !loggedIn ? (
        <div className="mb-4 rounded-lg border bg-blue-50 px-4 py-3 text-sm text-blue-900">
          ログインするとデータの保存・同期が可能になります。
          <Link href="/login" className="ml-1 underline font-medium">
            ログイン
          </Link>
        </div>
      ) : loaded && loggedIn && !isReady ? (
        <div className="mb-4 rounded-lg border bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ Gemini API Key が未設定です。
          <Link href="/settings" className="ml-1 underline font-medium">
            設定画面でキーを登録してください
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile
          href="/cards/new"
          title="スキャン"
          desc="名刺を撮影/選択して解析"
          disabled={disabled}
        />
        <Tile
          href="/cards"
          title="一覧"
          desc="名刺リストを表示"
          disabled={disabled}
        />
        <Tile href="/settings" title="設定" desc="キーの登録・SQLガイド" />
      </div>
    </div>
  );
}
