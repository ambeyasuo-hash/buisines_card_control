// (c) 2026 ambe / Business_Card_Folder

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSupabase } from "@/hooks/useSupabase";
import { useEmailDraft } from "@/hooks/useEmailDraft";
import type { BusinessCard } from "@/types";
import { geoToLocationName, generateFollowUpEmail } from "@/lib/gemini";
import { prefetchGeolocation } from "@/lib/geolocation";
import { downloadVCard } from "@/lib/vcard";
import { toMailtoUrl, cleanPhoneNumber } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Toast } from "@/components/ui/Toast";
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

function isValidUrl(str: string): boolean {
  try {
    new URL(str.startsWith("http") ? str : `https://${str}`);
    return true;
  } catch {
    return false;
  }
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
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-slate-300">{label}</label>
      <input
        className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500 disabled:opacity-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
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
    return () => { cancelled = true; };
  }, [client, id]);

  const canEdit = useMemo(() => Boolean(edit), [edit]);

  // メール下書き生成 — useEmailDraft フックに委譲
  const mailGenerator = useCallback(() => {
    if (!edit) return Promise.reject(new Error("データが読み込まれていません"));
    return generateFollowUpEmail({
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
    });
  }, [edit, userSettings, category]);

  const { mailStatus, onGenerateMail } = useEmailDraft({
    emailAddress: edit?.email,
    generator: mailGenerator,
  });

  if (!isConfigured) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">詳細</h1>
        <p className="text-sm text-slate-400 mb-4">
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/95 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/cards" className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center hover:bg-white/10 transition">
              <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-bold text-white">詳細</span>
          </div>
          <div className="flex items-center gap-2">
            {card && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => downloadVCard(card)}
                title="連絡先へ追加（vCard形式でダウンロード）"
              >
                連絡先へ追加
              </Button>
            )}
            <Button
              variant="primary"
              onClick={onSave}
              disabled={saving || loading || !canEdit}
              loading={saving}
            >
              保存
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 max-w-4xl mx-auto w-full space-y-6">
        <Toast message={toast} />

        {errorMsg && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-400">読込中...</div>
        ) : !edit ? (
          <div className="text-sm text-slate-400">データが見つかりません。</div>
        ) : (
        <div className="space-y-6">
          {/* フォローアップメール */}
          <SectionCard
            headerRight={
              <Button
                variant="ghost"
                size="sm"
                onClick={onGenerateMail}
                disabled={mailStatus.state === "running"}
                loading={mailStatus.state === "running"}
                className="border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
              >
                メール生成
              </Button>
            }
          >
            <div>
              <div className="font-bold text-slate-50">📧 フォローアップメール</div>
              <div className="text-sm text-slate-400">
                ユーザー設定（表示名/所属）とカテゴリ設定（トーン/署名）を反映して生成します。
              </div>
            </div>

            {mailStatus.state === "ng" ? (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                {mailStatus.message}
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={onGenerateMail}>再試行</Button>
                </div>
              </div>
            ) : null}

            {mailStatus.state === "ok" ? (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1.5">
                  <div className="text-xs font-semibold text-slate-300">件名</div>
                  <input
                    className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                    value={mailStatus.subject}
                    readOnly
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="text-xs font-semibold text-slate-300">本文（コピー用）</div>
                  <textarea
                    className="min-h-40 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder-slate-500 resize-none"
                    value={mailStatus.body}
                    readOnly
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={mailStatus.mailto}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 transition"
                  >
                    メーラーを起動
                  </a>
                  <Button
                    variant="secondary"
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
                  >
                    本文をコピー
                  </Button>
                </div>
              </div>
            ) : null}
          </SectionCard>

          {/* 基本情報 */}
          <SectionCard title="基本情報">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="氏名" value={edit.full_name} onChange={(v) => setEdit({ ...edit, full_name: v })} />
              <Field label="かな" value={edit.kana} onChange={(v) => setEdit({ ...edit, kana: v })} />
              <Field label="会社名" value={edit.company} onChange={(v) => setEdit({ ...edit, company: v })} />
              <Field label="部署" value={edit.department} onChange={(v) => setEdit({ ...edit, department: v })} />
              <Field label="役職" value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} />
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-slate-300">登録元</label>
                <select
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
                  value={edit.source}
                  onChange={(e) => setEdit({ ...edit, source: e.target.value as any })}
                >
                  <option value="camera">camera</option>
                  <option value="line">line</option>
                  <option value="manual">manual</option>
                </select>
              </div>
              <Field label="交換日" value={edit.exchanged_at} onChange={(v) => setEdit({ ...edit, exchanged_at: v })} />
            </div>
          </SectionCard>

          {/* 連絡先 */}
          <SectionCard title="連絡先">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-slate-300">メール</label>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                    value={edit.email}
                    onChange={(v) => setEdit({ ...edit, email: v.target.value })}
                  />
                  {edit.email && (
                    <a
                      href={toMailtoUrl({ to: edit.email })}
                      className="h-11 w-11 rounded-full border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-300 hover:bg-blue-500/20 transition flex-shrink-0"
                      title="メールを送信"
                    >
                      ✉️
                    </a>
                  )}
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-slate-300">電話</label>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                    value={edit.phone}
                    onChange={(v) => setEdit({ ...edit, phone: v.target.value })}
                  />
                  {edit.phone && (
                    <a
                      href={`tel:${cleanPhoneNumber(edit.phone)}`}
                      className="h-11 w-11 rounded-full border border-green-500/30 bg-green-500/10 flex items-center justify-center text-green-300 hover:bg-green-500/20 transition flex-shrink-0"
                      title="電話を発信"
                    >
                      📞
                    </a>
                  )}
                </div>
              </div>
              <Field label="郵便番号" value={edit.postal_code} onChange={(v) => setEdit({ ...edit, postal_code: v })} />
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-slate-300">URL</label>
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                    value={edit.url}
                    onChange={(v) => setEdit({ ...edit, url: v.target.value })}
                  />
                  {edit.url && isValidUrl(edit.url) && (
                    <a
                      href={edit.url.startsWith("http") ? edit.url : `https://${edit.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 w-11 rounded-full border border-violet-500/30 bg-violet-500/10 flex items-center justify-center text-violet-300 hover:bg-violet-500/20 transition flex-shrink-0"
                      title="ウェブサイトを開く"
                    >
                      🔗
                    </a>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <div className="text-xs font-semibold text-slate-300">住所</div>
                <input
                  className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                  value={edit.address}
                  onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                />
              </div>
            </div>
          </SectionCard>

          {/* 位置情報 */}
          <SectionCard
            headerRight={
              <Button variant="secondary" onClick={onUpdateLocation} disabled={saving}>
                位置情報を更新
              </Button>
            }
          >
            <div>
              <div className="font-semibold">位置情報</div>
              <div className="text-sm text-slate-400">
                座標を取得し、Geminiで地名に変換して `location_name` に保存します。
              </div>
            </div>

            {geoErr ? (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                {geoErr}
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={onUpdateLocation} disabled={saving}>再試行</Button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <Field label="地名 (location_name)" value={edit.location_name} onChange={(v) => setEdit({ ...edit, location_name: v })} />
              <Field label="精度(m)" value={edit.location_accuracy_m} onChange={(v) => setEdit({ ...edit, location_accuracy_m: v })} />
              <Field label="緯度" value={edit.location_lat} onChange={(v) => setEdit({ ...edit, location_lat: v })} />
              <Field label="経度" value={edit.location_lng} onChange={(v) => setEdit({ ...edit, location_lng: v })} />
            </div>
          </SectionCard>

          {/* メモ */}
          <SectionCard>
            <div className="font-semibold mb-2">メモ</div>
            <textarea
              className="min-h-28 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder-slate-500 resize-none"
              value={edit.notes}
              onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
            />
          </SectionCard>

          {/* 削除 */}
          <SectionCard>
            <div className="text-sm text-slate-400 mb-3">
              削除は取り消せません。誤操作防止のため、画面下部に配置しています。
            </div>
            <Button
              variant="danger"
              onClick={onDelete}
              disabled={saving || loading || !card}
              className="w-full h-12"
            >
              削除
            </Button>
          </SectionCard>
        </div>
      )}
      </div>
    </div>
  );
}
