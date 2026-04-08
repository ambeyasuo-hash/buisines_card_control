// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { downloadCSV } from "@/lib/csv";
import { cleanPhoneNumber, toMailtoUrl } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { BusinessCard, Category } from "@/types";

type SortKey = "exchanged_desc" | "exchanged_asc" | "name_asc" | "name_desc";

function formatDate(dateLike?: string) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return dateLike;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function SourceIcon({ source }: { source: BusinessCard["source"] }) {
  const common = "h-4 w-4";
  if (source === "camera") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <path
          fill="currentColor"
          d="M9.5 4a1 1 0 0 0-.8.4L7.3 6H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-2.3l-1.4-1.6A1 1 0 0 0 14.5 4h-5ZM12 9a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
        />
      </svg>
    );
  }
  if (source === "line") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3C6.9 3 2.8 6.5 2.8 10.8c0 2.7 1.7 5.1 4.4 6.6V21l3.3-2.2c.5.1 1 .1 1.5.1 5.1 0 9.2-3.5 9.2-7.9S17.1 3 12 3Zm-3 8.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a1 1 0 0 0-.3-.7l-5.5-5.5A1 1 0 0 0 16.5 3H5Zm10 1.9V9h4.1L15 4.9Z"
      />
    </svg>
  );
}

export default function CardsPage() {
  const { client, isConfigured } = useSupabase();

  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("exchanged_desc");

  useEffect(() => {
    if (!client) return;
    const c = client;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [catsRes, cardsRes] = await Promise.all([
          c.from("categories").select("id,name,color_hex"),
          c
            .from("business_cards")
            .select(
              "id,category_id,full_name,kana,company,department,title,email,phone,postal_code,address,url,thumbnail_base64,notes,location_name,source,exchanged_at,created_at"
            ),
        ]);

        if (catsRes.error) throw catsRes.error;
        if (cardsRes.error) throw cardsRes.error;

        if (cancelled) return;
        setCategories((catsRes.data ?? []) as Category[]);
        setCards((cardsRes.data ?? []) as BusinessCard[]);
      } catch (e) {
        const message = e instanceof Error ? e.message : "読み込みに失敗しました";
        if (!cancelled) setErrorMsg(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = cards;
    if (q) {
      rows = rows.filter((c) => {
        const name = (c.full_name ?? "").toLowerCase();
        const kana = (c.kana ?? "").toLowerCase();
        const company = (c.company ?? "").toLowerCase();
        return name.includes(q) || kana.includes(q) || company.includes(q);
      });
    }

    const copy = [...rows];
    copy.sort((a, b) => {
      const ad = a.exchanged_at ?? "";
      const bd = b.exchanged_at ?? "";
      const an = (a.full_name ?? "").localeCompare(b.full_name ?? "", "ja");

      switch (sortKey) {
        case "exchanged_asc":
          return ad.localeCompare(bd, "ja");
        case "exchanged_desc":
          return bd.localeCompare(ad, "ja");
        case "name_asc":
          return an;
        case "name_desc":
          return -an;
      }
    });
    return copy;
  }, [cards, query, sortKey]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold mb-2">名刺一覧</h1>
            <p className="text-sm text-slate-400 mb-4">先に接続設定（Supabase URL / Anon Key / Gemini Key）を完了してください。</p>
            <Link href="/settings" className="inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 transition">
              設定へ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Sticky Header */}
      <div className="border-b border-white/8 bg-slate-950/95">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Link href="/cards" className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10 transition">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-bold text-white">名刺一覧</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => downloadCSV(filteredSorted)}
              disabled={loading || filteredSorted.length === 0}
              title="CSV形式で全データをダウンロード"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4v4m0 0H8m4 0h4M4 20h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              CSV
            </Button>
            <Link href="/cards/new" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700 transition">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              追加
            </Link>
          </div>
        </div>

        {/* 検索バー */}
        <div className="px-4 pb-3">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="名前、会社名、役職で検索..."
              className="h-10 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* 件数 + ソート */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500">
        <span>{loading ? "読込中..." : `${filteredSorted.length} 件`}</span>
        <div className="flex items-center gap-1 text-slate-400">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-transparent text-slate-400 text-xs cursor-pointer focus:outline-none"
          >
            <option value="exchanged_desc">交換日: 新しい順</option>
            <option value="exchanged_asc">交換日: 古い順</option>
            <option value="name_asc">氏名: 昇順</option>
            <option value="name_desc">氏名: 降順</option>
          </select>
        </div>
      </div>

      {/* リスト */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05] pb-4">
        {errorMsg ? (
          <div className="px-4 py-6">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">読み込みエラー: {errorMsg}</div>
          </div>
        ) : null}

        {filteredSorted.map((c) => {
          const cat = c.category_id ? categoryById.get(c.category_id) : undefined;
          const dotColor = cat?.color_hex ?? "#64748b";
          const exchanged = formatDate(c.exchanged_at);
          const company = c.company?.trim() || "";

          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition group">
              <Link
                href={`/cards/${c.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                {/* アバター */}
                <div className="h-10 w-10 rounded-xl border border-white/10 grid place-items-center shrink-0 overflow-hidden">
                  {c.thumbnail_base64 ? (
                    <img src={c.thumbnail_base64} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-sm font-bold" style={{ backgroundColor: `${dotColor}20`, color: dotColor }}>
                      {c.full_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* 左側：名前とかな */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-slate-500 leading-3.5">{c.kana ?? ""}</div>
                  <div className="text-sm font-semibold text-white">{c.full_name}</div>
                </div>

                {/* 中央：会社と地名 */}
                <div className="w-[38%] min-w-0">
                  <div className="text-sm text-slate-300 truncate">{company}</div>
                  <div className="text-[10px] text-slate-500">{c.location_name ?? ""}</div>
                </div>

                {/* 右側：日付とステータス */}
                <div className="text-right shrink-0 w-20">
                  <div className="text-[11px] text-slate-500">{exchanged}</div>
                  <div className="flex justify-end mt-1">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                      title={cat?.name ?? "カテゴリ未設定"}
                    />
                  </div>
                </div>
              </Link>

              {/* 連絡先アクションボタン（クリック時にリンク移動しない） */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                {c.email && (
                  <a
                    href={toMailtoUrl({ to: c.email })}
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 rounded-full border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-300 hover:bg-blue-500/20 transition text-sm"
                    title="メールを送信"
                  >
                    ✉️
                  </a>
                )}
                {c.phone && (
                  <a
                    href={`tel:${cleanPhoneNumber(c.phone)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 rounded-full border border-green-500/30 bg-green-500/10 flex items-center justify-center text-green-300 hover:bg-green-500/20 transition text-sm"
                    title="電話を発信"
                  >
                    📞
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {!loading && filteredSorted.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">名刺がありません（または検索条件に一致しません）。</div>
        ) : null}
      </div>

      {/* FAB */}
      <Link href="/cards/new" className="absolute bottom-6 right-4 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 grid place-items-center transition shadow-lg shadow-blue-600/35">
        <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Link>
    </div>
  );
}
