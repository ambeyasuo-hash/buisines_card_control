// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyzeBusinessCard } from "@/lib/ocr";
import { withTimeout, TimeoutError } from "@/lib/async";
import type { CardOCRResult } from "@/types";

export type OCRStatus =
  | { state: "idle" }
  | { state: "running" }
  | { state: "ok" }
  | { state: "ng"; message: string };

export type FormState = {
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

/** OCR 後に最初に空だったフィールド名を返す（自動フォーカス用） */
function findFirstEmptyField(form: FormState): keyof FormState | null {
  const priority: (keyof FormState)[] = [
    "full_name",
    "kana",
    "company",
    "title",
    "email",
    "phone",
  ];
  for (const key of priority) {
    if (!form[key]) return key;
  }
  return null;
}

/**
 * 名刺 OCR ロジックを UI から分離するカスタムフック。
 *
 * - `file` / `status` / `form` / `previewUrl` を管理
 * - `scan(file)` で解析開始
 * - `reset()` で撮り直し
 * - `firstEmptyField`: OCR 完了直後に空だったフィールド（自動フォーカス用）
 * - `ocrResult`: OCR で得られた raw 結果（フィールドが uncertain かどうか判定に使う）
 */
export function useGeminiOCR() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<OCRStatus>({ state: "idle" });
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [firstEmptyField, setFirstEmptyField] = useState<keyof FormState | null>(null);
  const [ocrResult, setOcrResult] = useState<CardOCRResult | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const scan = useCallback(async (f: File) => {
    setFile(f);
    setStatus({ state: "running" });
    setFirstEmptyField(null);
    setOcrResult(null);

    try {
      const res = await withTimeout(
        analyzeBusinessCard(f),
        30_000,
        "OCR解析がタイムアウトしました（ネットワークをご確認ください）"
      );

      const newForm: FormState = {
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
        exchanged_at: todayISO(),
        thumbnail_base64: res.thumbnail_base64,
      };

      setForm(newForm);
      setOcrResult(res);
      setFirstEmptyField(findFirstEmptyField(newForm));
      setStatus({ state: "ok" });
    } catch (e) {
      const msg =
        e instanceof TimeoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "OCR解析に失敗しました";
      setForm({ ...EMPTY_FORM, exchanged_at: todayISO() });
      setOcrResult(null);
      setStatus({ state: "ng", message: msg });
    }
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setStatus({ state: "idle" });
    setForm({ ...EMPTY_FORM, exchanged_at: todayISO() });
    setFirstEmptyField(null);
    setOcrResult(null);
  }, []);

  const isLoading = status.state === "running";
  const showForm = Boolean(file) && !isLoading;

  return {
    file,
    status,
    form,
    setForm,
    previewUrl,
    isLoading,
    showForm,
    firstEmptyField,
    ocrResult,
    scan,
    reset,
  };
}
