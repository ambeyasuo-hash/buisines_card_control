// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { prefetchGeolocation } from "@/lib/geolocation";
import { analyzeBusinessCard } from "@/lib/gemini";
import { TimeoutError, withTimeout } from "@/lib/async";
import { useSupabase } from "@/hooks/useSupabase";

type FormState = {
  full_name: string;
  kana: string;
  company: string;
  department: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  url: string;
  notes: string;
  exchanged_at: string;
  thumbnail_base64?: string;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EMPTY_FORM: FormState = {
  full_name: "",
  kana: "",
  company: "",
  department: "",
  title: "",
  email: "",
  phone: "",
  address: "",
  url: "",
  notes: "",
  exchanged_at: todayISO(),
};

export default function NewCardPage() {
  const router = useRouter();
  const { client, isConfigured } = useSupabase();

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok" }
    | { state: "ng"; message: string }
  >({ state: "idle" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void prefetchGeolocation();
  }, []);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isLoading = status.state === "running";

  const run = useCallback(async (f: File) => {
    setStatus({ state: "running" });
    try {
      const res = await withTimeout(
        analyzeBusinessCard(f),
        30_000,
        "OCR解析がタイムアウトしました（ネットワークをご確認ください）"
      );
      // JSON表示は行わず、即フォームへ反映して編集可能にする
      setForm((prev) => ({
        ...prev,
        full_name: res.name ?? "",
        kana: res.name_kana ?? "",
        company: res.company ?? "",
        department: res.department ?? "",
        title: res.title ?? "",
        email: res.email ?? "",
        phone: (res.mobile ?? res.phone ?? "") ?? "",
        address: res.address ?? "",
        url: res.website ?? "",
        notes: res.notes ?? "",
        thumbnail_base64: res.thumbnail_base64,
      }));
      setStatus({ state: "ok" });
    } catch (e) {
      const msg =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "OCR解析に失敗しました";
      // 解析に失敗しても空フォームで手入力できるようにする
      setForm((prev) => ({ ...EMPTY_FORM, exchanged_at: prev.exchanged_at || todayISO() }));
      setStatus({ state: "ng", message: msg });
    }
  }, []);

  const inputId = "scan-camera-input";

  const showForm = Boolean(file) && status.state !== "running";

  async function onSave() {
    if (!client) return;
    if (!form.full_name.trim()) {
      setToast("氏名は必須です");
      window.setTimeout(() => setToast(null), 1200);
      return;
    }
    setSaving(true);
    try {
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

      // upsert: id をこちらで払い出し、onConflict=id で確実に 1 行として保存する
      const { error } = (await withTimeout(
        (client.from("business_cards") as any).upsert(payload, { onConflict: "id" }),
        30_000,
        "保存がタイムアウトしました（ネットワークをご確認ください）"
      )) as any;
      if (error) throw error;

      router.push("/cards");
    } catch (e) {
      const message =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "保存に失敗しました";
      setToast(message);
      window.setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!isConfigured) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-2">スキャン</h1>
        <p className="text-sm text-muted-foreground mb-4">
          先に接続設定（Supabase URL / Anon Key / Gemini Key）を完了してください。
        </p>
        <a
          href="/settings"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          設定へ
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">スキャン</h1>

      <div className="space-y-4">
        <section className="rounded-lg border bg-card p-4">
          <div className="font-semibold mb-2">写真を撮ってOCR</div>

          <div className="grid place-items-center py-2">
            <label
              htmlFor={inputId}
              className="inline-flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-bold text-primary-foreground"
            >
              <Camera className="h-5 w-5" />
              写真を撮る
            </label>
          </div>

          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setStatus({ state: "idle" });
              setForm({ ...EMPTY_FORM, exchanged_at: todayISO() });
              if (f) {
                void prefetchGeolocation();
                void run(f);
              }
            }}
          />

          <div className="mt-2 text-xs text-muted-foreground">
            ※ PCの場合はファイル選択になります（対応ブラウザのみカメラが起動します）。
          </div>
        </section>

        {previewUrl ? (
          <section className="rounded-lg border bg-card p-4">
            <div className="font-semibold mb-2">プレビュー</div>

            <div className="relative overflow-hidden rounded-md border bg-background">
              <img src={previewUrl} alt="" className="w-full h-auto block" />

              <div
                className={[
                  "absolute inset-0 transition-opacity duration-300",
                  isLoading ? "opacity-100" : "opacity-0 pointer-events-none",
                ].join(" ")}
                aria-hidden={!isLoading}
              >
                <div className="absolute inset-0 bg-slate-950/50" />
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_5px_rgba(59,130,246,0.5)] animate-scan"
                    style={{ top: 0 }}
                  />
                </div>
                <div className="absolute inset-0 flex items-end justify-center p-4">
                  <div className="text-sm font-medium text-white/90">
                    AIが名刺を解析中...（台形補正・OCR）
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {status.state === "ng" ? (
          <div className="rounded-md border bg-card p-4 text-sm text-destructive">
            {status.message}
            <div className="mt-2 text-xs text-muted-foreground">
              解析に失敗しましたが、下のフォームから手動で登録できます。
            </div>
          </div>
        ) : null}

        {toast ? (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-full border bg-white px-4 py-2 text-sm shadow">
            {toast}
          </div>
        ) : null}

        {showForm ? (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold">内容を確認して保存</div>
                <div className="text-sm text-muted-foreground">
                  解析結果はそのまま保存せず、ここで必ず確認・修正できます。
                </div>
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || isLoading || !client}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">氏名（必須）</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">かな</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.kana}
                  onChange={(e) => setForm({ ...form, kana: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">会社名</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">部署</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">役職</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">交換日</label>
                <input
                  type="date"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.exchanged_at}
                  onChange={(e) => setForm({ ...form, exchanged_at: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">メール</label>
                <input
                  type="email"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">電話</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <label className="text-sm font-medium">住所</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <label className="text-sm font-medium">URL</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <label className="text-sm font-medium">メモ</label>
                <textarea
                  className="min-h-28 w-full rounded-md border bg-background p-3 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

