// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { withTimeout, TimeoutError } from "@/lib/async";
import type { BusinessCard, Category } from "@/types";
import type { FormState } from "@/hooks/useGeminiOCR";

export type SortKey = "exchanged_desc" | "exchanged_asc" | "name_asc" | "name_desc";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 名刺一覧の取得・検索・ソート・保存ロジックを UI から分離するカスタムフック。
 */
export function useBusinessCards() {
  const { client, isConfigured } = useSupabase();

  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("exchanged_desc");

  // ──────────────────────────────────────────
  // 一覧フェッチ
  // ──────────────────────────────────────────
  useEffect(() => {
    if (!client) return;
    const c = client;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
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
        if (!cancelled) setError(e instanceof Error ? e.message : "読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [client]);

  // ──────────────────────────────────────────
  // カテゴリ Map
  // ──────────────────────────────────────────
  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // ──────────────────────────────────────────
  // フィルタ・ソート
  // ──────────────────────────────────────────
  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = cards;
    if (q) {
      rows = rows.filter((c) => {
        return (
          (c.full_name ?? "").toLowerCase().includes(q) ||
          (c.kana ?? "").toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q)
        );
      });
    }
    const copy = [...rows];
    copy.sort((a, b) => {
      const ad = a.exchanged_at ?? "";
      const bd = b.exchanged_at ?? "";
      switch (sortKey) {
        case "exchanged_asc":  return ad.localeCompare(bd, "ja");
        case "exchanged_desc": return bd.localeCompare(ad, "ja");
        case "name_asc":  return (a.full_name ?? "").localeCompare(b.full_name ?? "", "ja");
        case "name_desc": return (b.full_name ?? "").localeCompare(a.full_name ?? "", "ja");
      }
    });
    return copy;
  }, [cards, query, sortKey]);

  // ──────────────────────────────────────────
  // 保存
  // ──────────────────────────────────────────
  const saveCard = useCallback(
    async (form: FormState): Promise<void> => {
      if (!client) throw new Error("接続されていません");

      const { data: userData } = await client.auth.getUser();
      if (!userData.user) throw new Error("ログインが必要です（/login）");

      const id = crypto.randomUUID();
      const payload = {
        id,
        user_id: userData.user.id,
        category_id: null,
        full_name: form.full_name.trim(),
        kana: form.kana.trim() || null,
        company: form.company.trim() || null,
        department: form.department.trim() || null,
        title: form.title.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        postal_code: null,
        address: form.address.trim() || null,
        url: form.url.trim() || null,
        thumbnail_base64: form.thumbnail_base64 ?? null,
        notes: form.notes.trim() || null,
        location_name: null,
        location_lat: null,
        location_lng: null,
        location_accuracy_m: null,
        source: "camera",
        exchanged_at: form.exchanged_at || todayISO(),
      };

      const { error } = (await withTimeout(
        (client.from("business_cards") as any).upsert(payload, { onConflict: "id" }),
        30_000,
        "保存がタイムアウトしました（ネットワークをご確認ください）"
      )) as any;

      if (error) throw error;
    },
    [client]
  );

  return {
    cards,
    categories,
    loading,
    error,
    query,
    setQuery,
    sortKey,
    setSortKey,
    filteredSorted,
    categoryById,
    saveCard,
    isConfigured,
    client,
  };
}
