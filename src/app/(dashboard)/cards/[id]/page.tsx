// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSupabase } from "@/hooks/useSupabase";
import type { BusinessCard } from "@/types";
import { geoToLocationName, generateFollowUpEmail } from "@/lib/gemini";
import { prefetchGeolocation } from "@/lib/geolocation";
import type { Database } from "@/types/database";
import { TimeoutError, withTimeout } from "@/lib/async";

type EditState = {
  full_name: string;
  kana: string;
  company: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  postal_code: string;
  address: string;
  url: string;
  notes: string;
  exchanged_at: string;
  source: BusinessCard["source"];
  location_name: string;
  location_lat: string;
  location_lng: string;
  location_accuracy_m: string;
};

function toStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function toMailtoUrl(input: { to?: string; subject: string; body: string }): string {
  // mailto: はクライアント/メーラー実装差が大きいので、個別に encodeURIComponent する。
  // 改行は CRLF の方が維持されやすい（iOS/Androidの一部メーラー対策）。
  const subject = encodeURIComponent(input.subject);
  const body = encodeURIComponent(input.body.replace(/\n/g, "\r\n"));
  const to = input.to ? `mailto:${encodeURIComponent(input.to)}` : "mailto:";
  return `${to}?subject=${subject}&body=${body}`;
}

function toEditState(card: any): EditState {
  return {
    full_name: toStr(card.full_name),
    kana: toStr(card.kana),
    company: toStr(card.company),
    department: toStr(card.department),
    title: toStr(card.title),
    email: toStr(card.email),
    phone: toStr(card.phone),
    postal_code: toStr(card.postal_code),
    address: toStr(card.address),
    url: toStr(card.url),
    notes: toStr(card.notes),
    exchanged_at: toStr(card.exchanged_at),
    source: (card.source as BusinessCard["source"]) ?? "manual",
    location_name: toStr(card.location_name),
    location_lat: card.location_lat == null ? "" : String(card.location_lat),
    location_lng: card.location_lng == null ? "" : String(card.location_lng),
    location_accuracy_m:
      card.location_accuracy_m == null ? "" : String(card.location_accuracy_m),
  };
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <input
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

export default function CardDetailPage() {
  const { client, isConfigured } = useSupabase();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [card, setCard] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [mailStatus, setMailStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok"; subject: string; body: string; mailto: string }
    | { state: "ng"; message: string }
  >({ state: "idle" });
  const [userSettings, setUserSettings] = useState<Database["public"]["Tables"]["user_settings"]["Row"] | null>(null);
  const [category, setCategory] = useState<Database["public"]["Tables"]["categories"]["Row"] | null>(null);

  const [edit, setEdit] = useState<EditState | null>(null);

  useEffect(() => {
    if (!client || !id) return;
    const c = client;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await c
          .from("business_cards")
          .select(
            "id,category_id,full_name,kana,company,department,title,email,phone,postal_code,address,url,thumbnail_base64,notes,location_name,location_lat,location_lng,location_accuracy_m,source,exchanged_at,created_at"
          )
          .eq("id", id)
          .maybeSingle();

        if (res.error) throw res.error;
        if (cancelled) return;
        const dataAny = res.data as any;
        setCard(dataAny ?? null);
        setEdit(dataAny ? toEditState(dataAny) : null);

        const [settingsRes, catRes] = await Promise.all([
          c.from("user_settings").select("*").maybeSingle(),
          dataAny?.category_id
            ? c.from("categories").select("*").eq("id", dataAny.category_id).maybeSingle()
            : Promise.resolve({ data: null, error: null } as any),
        ]);
        if (!cancelled) {
          setUserSettings((settingsRes.data ?? null) as any);
          setCategory((catRes.data ?? null) as any);
        }
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
  }, [client, id]);

  const canEdit = useMemo(() => Boolean(edit), [edit]);

  if (!isConfigured) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">詳細</h1>
        <p className="text-sm text-muted-foreground mb-4">
          先に接続設定を完了してください。
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

  async function onSave() {
    if (!client || !id || !edit) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const patch: Database["public"]["Tables"]["business_cards"]["Update"] = {
        full_name: edit.full_name,
        kana: edit.kana || null,
        company: edit.company || null,
        department: edit.department || null,
        title: edit.title || null,
        email: edit.email || null,
        phone: edit.phone || null,
        postal_code: edit.postal_code || null,
        address: edit.address || null,
        url: edit.url || null,
        notes: edit.notes || null,
        exchanged_at: edit.exchanged_at,
        source: edit.source,
        location_name: edit.location_name || null,
        location_lat: edit.location_lat ? Number(edit.location_lat) : null,
        location_lng: edit.location_lng ? Number(edit.location_lng) : null,
        location_accuracy_m: edit.location_accuracy_m
          ? Number(edit.location_accuracy_m)
          : null,
      };

      // supabase-js の型推論が `never` に落ちる環境があるため、ここだけクエリビルダーを緩める
      const { error } = (await withTimeout(
        (client.from("business_cards") as any).update(patch).eq("id", id),
        30_000,
        "保存がタイムアウトしました（ネットワークをご確認ください）"
      )) as any;
      if (error) throw error;
      setToast("保存しました");
      window.setTimeout(() => setToast(null), 1200);
      window.setTimeout(() => router.replace("/cards"), 650);
    } catch (e) {
      const message =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "保存に失敗しました";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!client || !id) return;
    if (!confirm("この名刺を削除します。よろしいですか？")) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = (await withTimeout(
        client.from("business_cards").delete().eq("id", id),
        30_000,
        "削除がタイムアウトしました（ネットワークをご確認ください）"
      )) as any;
      if (error) throw error;
      router.replace("/cards");
    } catch (e) {
      const message =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "削除に失敗しました";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  }

  async function onUpdateLocation() {
    if (!edit) return;
    setSaving(true);
    setErrorMsg(null);
    setGeoErr(null);
    try {
      const loc = await withTimeout(
        prefetchGeolocation(),
        30_000,
        "位置情報取得がタイムアウトしました（権限/ネットワークをご確認ください）"
      );
      if (!loc) {
        setGeoErr("位置情報を取得できませんでした（権限/設定をご確認ください）");
        return;
      }
      const name = await withTimeout(
        geoToLocationName(loc.lat, loc.lng),
        30_000,
        "地名変換がタイムアウトしました（ネットワークをご確認ください）"
      );
      const fallback = `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
      setEdit({
        ...edit,
        location_lat: String(loc.lat),
        location_lng: String(loc.lng),
        location_accuracy_m: String(loc.accuracyMeters),
        location_name: name ?? fallback,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateMail() {
    if (!edit) return;
    setMailStatus({ state: "running" });
    try {
      const draft = await withTimeout(
        generateFollowUpEmail({
          toName: edit.full_name,
          toCompany: edit.company,
          toDepartment: edit.department,
          toTitle: edit.title,
          notes: edit.notes,
          exchangedAt: edit.exchanged_at,
          locationName: edit.location_name,
          userDisplayName: userSettings?.user_display_name,
          userOrganization: userSettings?.user_organization,
          emailTone: category?.email_tone,
          categoryFooter: category?.category_footer,
        }),
        30_000,
        "メール生成がタイムアウトしました（ネットワークをご確認ください）"
      );

      const mailto = toMailtoUrl({
        to: edit.email ? edit.email.trim() : undefined,
        subject: draft.subject,
        body: draft.body,
      });

      setMailStatus({ state: "ok", subject: draft.subject, body: draft.body, mailto });
    } catch (e) {
      const message =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "メール生成に失敗しました";
      setMailStatus({ state: "ng", message });
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">詳細</h1>
          <div className="text-sm text-muted-foreground">
            {card?.created_at ? `作成: ${card.created_at}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/cards"
            className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
          >
            一覧へ
          </Link>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || loading || !canEdit}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-full border bg-white px-4 py-2 text-sm shadow">
          {toast}
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mb-4 rounded-md border bg-card p-3 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">読込中...</div>
      ) : !edit ? (
        <div className="text-sm text-muted-foreground">データが見つかりません。</div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">AIメール作成</div>
                <div className="text-sm text-muted-foreground">
                  ユーザー設定（表示名/所属）とカテゴリ設定（トーン/署名）を反映して生成します。
                </div>
              </div>
              <button
                type="button"
                onClick={onGenerateMail}
                className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
                disabled={mailStatus.state === "running"}
              >
                {mailStatus.state === "running" ? "生成中..." : "AIメール作成"}
              </button>
            </div>

            {mailStatus.state === "ng" ? (
              <div className="mt-3 rounded-md border bg-background p-3 text-sm text-destructive">
                {mailStatus.message}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={onGenerateMail}
                    className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium"
                  >
                    再試行
                  </button>
                </div>
              </div>
            ) : null}

            {mailStatus.state === "ok" ? (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1.5">
                  <div className="text-xs text-muted-foreground">件名</div>
                  <input
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={mailStatus.subject}
                    readOnly
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="text-xs text-muted-foreground">本文（コピー用）</div>
                  <textarea
                    className="min-h-40 w-full rounded-md border bg-background p-3 text-sm"
                    value={mailStatus.body}
                    readOnly
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={mailStatus.mailto}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                  >
                    メーラーを起動
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(mailStatus.body);
                        setToast("コピーしました");
                        window.setTimeout(() => setToast(null), 1000);
                      } catch {
                        setToast("コピーに失敗しました");
                        window.setTimeout(() => setToast(null), 1200);
                      }
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
                  >
                    本文をコピー
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="氏名"
                value={edit.full_name}
                onChange={(v) => setEdit({ ...edit, full_name: v })}
              />
              <Field
                label="かな"
                value={edit.kana}
                onChange={(v) => setEdit({ ...edit, kana: v })}
              />
              <Field
                label="会社名"
                value={edit.company}
                onChange={(v) => setEdit({ ...edit, company: v })}
              />
              <Field
                label="部署"
                value={edit.department}
                onChange={(v) => setEdit({ ...edit, department: v })}
              />
              <Field
                label="役職"
                value={edit.title}
                onChange={(v) => setEdit({ ...edit, title: v })}
              />
              <div className="grid gap-1.5">
                <div className="text-xs text-muted-foreground">登録元</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.source}
                  onChange={(e) =>
                    setEdit({ ...edit, source: e.target.value as any })
                  }
                >
                  <option value="camera">camera</option>
                  <option value="line">line</option>
                  <option value="manual">manual</option>
                </select>
              </div>
              <Field
                label="交換日"
                value={edit.exchanged_at}
                onChange={(v) => setEdit({ ...edit, exchanged_at: v })}
              />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="メール"
                value={edit.email}
                onChange={(v) => setEdit({ ...edit, email: v })}
              />
              <Field
                label="電話"
                value={edit.phone}
                onChange={(v) => setEdit({ ...edit, phone: v })}
              />
              <Field
                label="郵便番号"
                value={edit.postal_code}
                onChange={(v) => setEdit({ ...edit, postal_code: v })}
              />
              <Field
                label="URL"
                value={edit.url}
                onChange={(v) => setEdit({ ...edit, url: v })}
              />
              <div className="sm:col-span-2 grid gap-1.5">
                <div className="text-xs text-muted-foreground">住所</div>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={edit.address}
                  onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold">位置情報</div>
                <div className="text-sm text-muted-foreground">
                  座標を取得し、Geminiで地名に変換して `location_name` に保存します。
                </div>
              </div>
              <button
                type="button"
                onClick={onUpdateLocation}
                className="inline-flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium"
                disabled={saving}
              >
                位置情報を更新
              </button>
            </div>

            {geoErr ? (
              <div className="mb-3 rounded-md border bg-background p-3 text-sm text-destructive">
                {geoErr}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={onUpdateLocation}
                    className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium"
                    disabled={saving}
                  >
                    再試行
                  </button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="地名 (location_name)"
                value={edit.location_name}
                onChange={(v) => setEdit({ ...edit, location_name: v })}
              />
              <Field
                label="精度(m)"
                value={edit.location_accuracy_m}
                onChange={(v) => setEdit({ ...edit, location_accuracy_m: v })}
              />
              <Field
                label="緯度"
                value={edit.location_lat}
                onChange={(v) => setEdit({ ...edit, location_lat: v })}
              />
              <Field
                label="経度"
                value={edit.location_lng}
                onChange={(v) => setEdit({ ...edit, location_lng: v })}
              />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="font-semibold mb-2">メモ</div>
            <textarea
              className="min-h-28 w-full rounded-md border bg-background p-3 text-sm"
              value={edit.notes}
              onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
            />
          </section>

          <section className="rounded-lg border bg-card p-4">
            <div className="text-sm text-muted-foreground mb-3">
              削除は取り消せません。誤操作防止のため、画面下部に配置しています。
            </div>
            <button
              type="button"
              onClick={onDelete}
              disabled={saving || loading || !card}
              className="inline-flex h-12 w-full items-center justify-center rounded-md border bg-background text-sm font-medium text-destructive disabled:opacity-50"
            >
              削除
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

