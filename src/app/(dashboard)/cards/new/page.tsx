// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { prefetchGeolocation } from "@/lib/geolocation";
import { preprocessCardImage } from "@/lib/imageProcessor";
import { generateThankYouEmailDraft } from "@/lib/email";
import { TimeoutError, withTimeout } from "@/lib/async";
import { toMailtoUrl } from "@/lib/utils";
import { useSupabase } from "@/hooks/useSupabase";
import { useEmailDraft } from "@/hooks/useEmailDraft";
import { useWASMInit } from "@/hooks/useWASMInit";
import { Toast } from "@/components/ui/Toast";
import { analyzeBusinessCardAction } from "@/app/actions/ocr";
import type { Category } from "@/types";
import type { OCRStatus } from "@/types/business-card";

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
  category_id: string | null;
  thumbnail_base64?: string | null;
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
  category_id: null,
};

export default function NewCardPage() {
  const router = useRouter();
  const { client, isConfigured } = useSupabase();
  const { status: wasmStatus, isReady: isWasmReady } = useWASMInit();

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
  const [categories, setCategories] = useState<Category[]>([]);
  const formFieldsRef = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  useEffect(() => {
    void prefetchGeolocation();
  }, []);

  useEffect(() => {
    async function loadCategories() {
      if (!client) return;
      try {
        const { data, error } = (await client.from("categories").select("*")) as any;
        if (error) throw error;
        const cats = (data || []) as Category[];
        setCategories(cats);
        if (cats && cats.length > 0) {
          setForm((prev) => ({ ...prev, category_id: cats[0].id }));
        }
      } catch {
        // 失敗してもカテゴリなしで続行
      }
    }
    loadCategories();
  }, [client]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Combined loading state: OCR processing OR WASM initialization
  const isLoading = status.state === "running" || wasmStatus.state === "initializing";

  // メール下書き生成 — useEmailDraft フックに委譲
  const mailGenerator = useCallback(
    () =>
      generateThankYouEmailDraft({
        toName: form.full_name,
        toCompany: form.company || undefined,
        notes: form.notes || undefined,
        exchangedAt: form.exchanged_at || undefined,
      }),
    [form.full_name, form.company, form.notes, form.exchanged_at]
  );

  const { mailStatus, onGenerateMail: _onGenerateMail } = useEmailDraft({
    emailAddress: form.email,
    generator: mailGenerator,
  });

  // 氏名バリデーションを追加したラッパー
  const onGenerateEmail = useCallback(async () => {
    if (!form.full_name.trim()) {
      setToast("氏名を入力してからメール下書きを生成してください");
      window.setTimeout(() => setToast(null), 2000);
      return;
    }
    await _onGenerateMail();
  }, [form.full_name, _onGenerateMail]);

  const run = useCallback(async (f: File) => {
    setStatus({ state: "running" });
    try {
      // Step 1: Convert image to Base64 for Azure API
      const reader = new FileReader();

      return new Promise<void>((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;

            // Step 2: Get user session for authentication
            if (!client) {
              throw new Error("Supabase接続が未設定です");
            }

            const { data: sessionData } = await client.auth.getSession();
            const accessToken = sessionData?.session?.access_token;

            if (!accessToken) {
              throw new Error("ログインセッションが有効ではありません");
            }

            // Step 3: Call Server Action (Azure OCR + Supabase Save)
            const result = await withTimeout(
              analyzeBusinessCardAction(base64, accessToken),
              60_000,
              "OCR解析がタイムアウトしました"
            );

            if (!result.success) {
              throw new Error(result.error || "解析に失敗しました");
            }

            if (!result.data) {
              throw new Error("データ取得に失敗しました");
            }

            // Step 4: Populate form with extracted data (Azure response + Supabase saved)
            setForm((prev) => ({
              ...prev,
              full_name: result.data!.full_name ?? "",
              kana: result.data!.kana ?? "",
              company: result.data!.company ?? "",
              department: result.data!.department ?? "",
              title: result.data!.title ?? "",
              email: result.data!.email ?? "",
              phone: result.data!.phone ?? "",
              address: result.data!.address ?? "",
              url: result.data!.url ?? "",
              notes: result.data!.notes ?? "",
              thumbnail_base64: result.data!.thumbnail_base64,
              exchanged_at: result.data!.exchanged_at ?? todayISO(),
            }));

            setStatus({ state: "ok" });
            resolve();
          } catch (e) {
            const msg =
              e instanceof TimeoutError
                ? e.message
                : e instanceof Error
                  ? e.message
                  : "OCR解析に失敗しました";
            setForm((prev) => ({
              ...EMPTY_FORM,
              exchanged_at: prev.exchanged_at || todayISO(),
            }));
            setStatus({ state: "ng", message: msg });
            reject(e);
          }
        };

        reader.onerror = () => {
          const msg = "画像の読み込みに失敗しました";
          setStatus({ state: "ng", message: msg });
          reject(new Error(msg));
        };

        // Read file as Data URL (Base64)
        reader.readAsDataURL(f);
      }).catch(() => {
        // Error already handled above
      });
    } catch (e) {
      const msg =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "OCR解析に失敗しました";
      setForm((prev) => ({
        ...EMPTY_FORM,
        exchanged_at: prev.exchanged_at || todayISO(),
      }));
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
        category_id: form.category_id || null,
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
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
        <div className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/95 flex items-center gap-2 px-4 h-14">
          <a href="/cards" className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center shrink-0">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <span className="font-bold text-white">名刺スキャン</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-5 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold mb-2">設定が必要です</h1>
            <p className="text-sm text-slate-400 mb-4">先に接続設定（Supabase URL / Anon Key）を完了してください。</p>
            <a href="/settings" className="inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-6 text-sm font-medium text-white hover:bg-blue-700 transition">
              設定へ
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/95 flex items-center gap-2 px-4 h-14">
        <a href="/cards" className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center shrink-0 hover:bg-white/10 transition">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <span className="font-bold text-white">名刺スキャン</span>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">
        {/* ファイル入力 */}
        {!file && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-xs font-semibold text-slate-400 mb-3">写真を撮ってOCR</div>
            <label htmlFor={inputId} className="block">
              <div className={`grid place-items-center py-4 rounded-xl transition cursor-pointer ${
                isWasmReady
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-600/40 opacity-50 cursor-not-allowed"
              }`}>
                <div className="flex flex-col items-center gap-2">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-bold text-white">
                    {isWasmReady ? "写真を撮る" : "初期化中..."}
                  </span>
                </div>
              </div>
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={!isWasmReady}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setStatus({ state: "idle" });
                setForm({ ...EMPTY_FORM, exchanged_at: todayISO(), category_id: categories[0]?.id || null });
                if (f) {
                  void prefetchGeolocation();
                  void run(f);
                }
              }}
            />
            <div className="mt-3 text-xs text-slate-500">※ PCの場合はファイル選択になります</div>
          </div>
        )}

        {/* プレビュー + スキャンアニメーション */}
        {previewUrl && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">プレビュー</span>
              {status.state === "ok" && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  解析完了
                </span>
              )}
            </div>
            <div className="relative overflow-hidden bg-black/20" style={{ height: "200px" }}>
              <img src={previewUrl} alt="" className="w-full h-full object-cover" />

              {isLoading && (
                <>
                  <div className="absolute inset-0 bg-slate-950/55" />
                  <div className="absolute inset-x-0 top-0 bottom-0 overflow-hidden pointer-events-none">
                    <div className="animate-scan-beam relative">
                      <div className="absolute inset-x-0 bottom-3 h-14 bg-gradient-to-b from-transparent via-blue-500/20 to-blue-500/5" />
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_14px_5px_rgba(59,130,246,0.5)]" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-blue-400/70 animate-bracket-pulse" />
                  <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-blue-400/70 animate-bracket-pulse" />
                  <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-blue-400/70 animate-bracket-pulse" />
                  <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-blue-400/70 animate-bracket-pulse" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
                    {/* Loading animation + message */}
                    <div className="flex items-center gap-2 rounded-full bg-slate-950/90 px-4 py-2 backdrop-blur border border-blue-500/20">
                      <div className="h-2 w-2 rounded-full bg-blue-400 pulse-dot" />
                      <span className="text-xs font-medium text-white/90">セキュリティを確保しながら解析中...</span>
                    </div>

                    {/* Security info skeleton */}
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <svg className="h-3 w-3 text-emerald-400/60" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>Azure でプライバシー安全に OCR</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="h-3 w-3 text-emerald-400/60" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span>個人情報は日本国内に保護</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* エラー表示 */}
        {status.state === "ng" && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
            {status.message}
            <div className="mt-2 text-xs text-slate-400">解析に失敗しましたが、下のフォームから手動で登録できます。</div>
          </div>
        )}

        {/* フォームセクション（完了後） */}
        {showForm && (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
              <div>
                <div className="font-bold text-sm text-white">内容を確認して保存</div>
                <div className="text-xs text-slate-400 mt-0.5">解析結果を確認・修正してから保存してください。</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 氏名（必須） */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">氏名（必須）</label>
                  <input
                    ref={(el) => { if (el) formFieldsRef.current["full_name"] = el; }}
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                  />
                </div>

                {/* フリガナ */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    フリガナ
                    {!form.kana && <span className="text-[10px] font-normal text-amber-400/70">要確認</span>}
                  </label>
                  <div className={`h-11 rounded-xl border px-3 flex items-center text-sm relative ${
                    !form.kana
                      ? "border-amber-500/50 bg-amber-500/5 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]"
                      : "border-white/15 bg-white/5"
                  }`}>
                    <input
                      ref={(el) => { if (el) formFieldsRef.current["kana"] = el; }}
                      type="text"
                      value={form.kana}
                      onChange={(e) => setForm({ ...form, kana: e.target.value })}
                      className="w-full bg-transparent text-white placeholder-slate-500 outline-none"
                    />
                    {!form.kana && (
                      <div className="absolute inset-0 rounded-xl border-2 border-amber-400/60 animate-pulse pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* 会社名 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">会社名</label>
                  <input
                    ref={(el) => { if (el) formFieldsRef.current["company"] = el; }}
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                  />
                </div>

                {/* 役職 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    役職
                    {!form.title && <span className="text-[10px] font-normal text-amber-400/70">要確認</span>}
                  </label>
                  <div className={`h-11 rounded-xl border px-3 flex items-center text-sm ${
                    !form.title ? "border-amber-500/35 bg-white/[0.02]" : "border-white/15 bg-white/5"
                  }`}>
                    <input
                      ref={(el) => { if (el) formFieldsRef.current["title"] = el; }}
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full bg-transparent text-white placeholder-slate-500 outline-none"
                    />
                  </div>
                </div>

                {/* メールアドレス */}
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300">メールアドレス</label>
                  <input
                    ref={(el) => { if (el) formFieldsRef.current["email"] = el; }}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white placeholder-slate-500"
                  />
                </div>

                {/* 電話 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                    電話番号
                    {!form.phone && <span className="text-[10px] font-normal text-amber-400/70">要確認</span>}
                  </label>
                  <div className={`h-11 rounded-xl border px-3 flex items-center text-sm ${
                    !form.phone ? "border-amber-500/35 bg-white/[0.02]" : "border-white/15 bg-white/5"
                  }`}>
                    <input
                      ref={(el) => { if (el) formFieldsRef.current["phone"] = el; }}
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full bg-transparent text-white placeholder-slate-500 outline-none"
                      placeholder="未検出"
                    />
                  </div>
                </div>

                {/* 交換日 */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">交換日</label>
                  <input
                    ref={(el) => { if (el) formFieldsRef.current["exchanged_at"] = el; }}
                    type="date"
                    value={form.exchanged_at}
                    onChange={(e) => setForm({ ...form, exchanged_at: e.target.value })}
                    className="h-11 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white"
                  />
                </div>

                {/* メモ */}
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300">メモ</label>
                  <textarea
                    ref={(el) => { if (el) formFieldsRef.current["notes"] = el; }}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="min-h-16 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-sm text-white placeholder-slate-500 resize-none"
                  />
                </div>

                {/* カテゴリ選択 */}
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300">📂 カテゴリ</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setForm({ ...form, category_id: cat.id })}
                          className={`h-9 px-4 rounded-full text-xs font-medium transition-all ${
                            form.category_id === cat.id
                              ? "bg-blue-600 text-white"
                              : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">カテゴリなし</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* メール下書きセクション */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="font-bold text-sm text-white">📧 お礼メール下書き</div>

              {mailStatus.state === "idle" && (
                <button
                  type="button"
                  onClick={onGenerateEmail}
                  disabled={!form.full_name.trim()}
                  className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition"
                >
                  お礼メール下書きを生成
                </button>
              )}

              {mailStatus.state === "running" && (
                <div className="flex items-center justify-center h-11 rounded-full bg-blue-600/20 border border-blue-500/30">
                  <svg className="h-4 w-4 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} className="opacity-25" />
                    <path strokeWidth={2} d="M4 12a8 8 0 018-8v0m0 16a8 8 0 01-8-8m8 8v-2m0-12v2" className="opacity-75" />
                  </svg>
                  <span className="ml-2 text-sm text-blue-300">生成中...</span>
                </div>
              )}

              {mailStatus.state === "ok" && (
                <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">【件名】</div>
                    <div className="text-sm text-white break-words">{mailStatus.subject}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">【本文】</div>
                    <div className="text-sm text-slate-300 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                      {mailStatus.body}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.email) {
                        setToast("メールアドレスが必要です");
                        window.setTimeout(() => setToast(null), 1500);
                        return;
                      }
                      window.location.href = toMailtoUrl({
                        to: form.email,
                        subject: mailStatus.subject,
                        body: mailStatus.body,
                      });
                    }}
                    disabled={!form.email}
                    className="w-full h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 transition"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    メールを起動
                  </button>
                  {form.email && <div className="text-xs text-slate-500">送信先: {form.email}</div>}
                </div>
              )}

              {mailStatus.state === "ng" && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{mailStatus.message}</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ボトムアクションバー（固定） */}
      {showForm && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/8 bg-slate-950/97 backdrop-blur px-4 py-3">
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setStatus({ state: "idle" });
                setForm({ ...EMPTY_FORM, exchanged_at: todayISO(), category_id: categories[0]?.id || null });
              }}
              className="h-14 rounded-full bg-white text-slate-950 font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              撮り直し
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || isLoading || !client}
              className="h-14 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/35"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* Toast — WASM status or user messages (WASM messages take priority) */}
      <Toast
        message={
          wasmStatus.state === "initializing"
            ? "初期化中: WASM ライブラリをロード中..."
            : wasmStatus.state === "error"
            ? `エラー: ${wasmStatus.message}`
            : toast
        }
        className="bottom-24"
      />
    </div>
  );
}
