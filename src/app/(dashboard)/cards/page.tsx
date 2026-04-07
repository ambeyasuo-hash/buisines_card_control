// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">名刺一覧</h1>
        <p className="text-sm text-muted-foreground mb-4">
          先に接続設定（Supabase URL / Anon Key / Gemini Key）を完了してください。
        </p>
        <Link
          href="/settings"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          設定へ
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0 sm:px-4 py-0 sm:py-8">
      <div className="px-4 sm:px-0 pt-6 sm:pt-0">
        <h1 className="text-2xl font-bold mb-3">名刺一覧</h1>
      </div>

      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="container mx-auto px-4 sm:px-0 py-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between max-w-none">
          <div className="flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="氏名 / かな / 会社名で検索"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="exchanged_desc">交換日: 新しい順</option>
              <option value="exchanged_asc">交換日: 古い順</option>
              <option value="name_asc">氏名: 昇順</option>
              <option value="name_desc">氏名: 降順</option>
            </select>
            <div className="text-xs text-muted-foreground w-[5.5rem] text-right">
              {loading ? "読込中..." : `${filteredSorted.length}件`}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-0 sm:px-4 max-w-none">
        {errorMsg ? (
          <div className="px-4 sm:px-0 py-6">
            <div className="rounded-md border bg-card p-4 text-sm text-destructive">
              読み込みエラー: {errorMsg}
            </div>
          </div>
        ) : null}

        <div className="divide-y">
          {filteredSorted.map((c) => {
            const cat = c.category_id ? categoryById.get(c.category_id) : undefined;
            const dotColor = cat?.color_hex ?? "#94a3b8";
            const exchanged = formatDate(c.exchanged_at);
            const company = c.company?.trim() || "（会社名なし）";

            return (
              <Link
                key={c.id}
                href={`/cards/${c.id}`}
                className="h-16 px-4 sm:px-0 flex items-center gap-3 hover:bg-black/[0.02]"
              >
                <div className="w-10 flex items-center justify-center shrink-0">
                  {c.thumbnail_base64 ? (
                    <img
                      src={c.thumbnail_base64}
                      alt=""
                      className="h-9 w-9 rounded-sm object-cover border"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                      aria-label={cat?.name ?? "カテゴリ未設定"}
                      title={cat?.name ?? "カテゴリ未設定"}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="text-[11px] leading-4 text-muted-foreground truncate">
                      {c.kana ?? ""}
                    </div>
                    <div className="font-medium leading-5 truncate">
                      {c.full_name}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 w-[44%] sm:w-[40%]">
                  <div className="text-sm leading-5 truncate">{company}</div>
                  <div className="text-[11px] leading-4 text-muted-foreground truncate">
                    {c.location_name ?? ""}
                  </div>
                </div>

                <div className="w-[6.5rem] sm:w-28 text-right">
                  <div className="text-xs text-muted-foreground leading-4">
                    {exchanged}
                  </div>
                  <div className="mt-1 inline-flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <SourceIcon source={c.source} />
                    <span className="sr-only">登録元</span>
                  </div>
                </div>
              </Link>
            );
          })}

          {!loading && filteredSorted.length === 0 ? (
            <div className="px-4 sm:px-0 py-10 text-sm text-muted-foreground">
              名刺がありません（または検索条件に一致しません）。
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
