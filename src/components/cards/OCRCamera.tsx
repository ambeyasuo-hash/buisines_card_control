// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { prefetchGeolocation } from "@/lib/geolocation";
import { analyzeBusinessCard } from "@/lib/ocr";
import { withTimeout, TimeoutError } from "@/lib/async";

export default function OCRCamera() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok"; data: any }
    | { state: "ng"; message: string }
  >({ state: "idle" });

  useEffect(() => {
    // 画面表示時点で先行して開始（許可ダイアログを早めに出して保存時に間に合わせる）
    void prefetchGeolocation();
  }, []);

  const canRun = Boolean(file) && status.state !== "running";

  const run = useCallback(
    async (f: File) => {
      setStatus({ state: "running" });
      try {
        const res = await withTimeout(
          analyzeBusinessCard(f),
          30_000,
          "OCR解析がタイムアウトしました（ネットワークをご確認ください）"
        );
        setStatus({ state: "ok", data: res });
      } catch (e) {
        const msg =
          e instanceof TimeoutError
            ? e.message
            : e instanceof Error
              ? e.message
              : "OCR解析に失敗しました";
        setStatus({ state: "ng", message: msg });
      }
    },
    [setStatus]
  );

  const thumb = useMemo(() => {
    if (status.state !== "ok") return null;
    const t = status.data?.thumbnail_base64;
    return typeof t === "string" ? t : null;
  }, [status]);

  const inputId = "ocr-camera-input";

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="font-semibold mb-2">写真を撮ってOCR</div>

        {/* モバイル優先: 大きなボタンでカメラ起動（capture=environment） */}
        <div className="grid place-items-center py-3">
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
            if (f) {
              void prefetchGeolocation();
              void run(f);
            }
          }}
        />

        <div className="mt-2 text-xs text-muted-foreground">
          ※ PCの場合はファイル選択になります（対応ブラウザのみカメラが起動します）。
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            disabled={!canRun}
            onClick={() => file && run(file)}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {status.state === "running" ? "解析中..." : "再試行"}
          </button>
          <div className="text-sm text-muted-foreground">
            {status.state === "running" ? "ネットワーク切断時は30秒で停止します" : ""}
          </div>
        </div>
      </section>

      {status.state === "ng" ? (
        <div className="rounded-md border bg-card p-4 text-sm text-destructive">
          {status.message}
        </div>
      ) : null}

      {status.state === "ok" ? (
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">抽出結果</div>
              <div className="text-sm text-muted-foreground">
                サムネは横幅100px・品質0.6で圧縮したもののみです。
              </div>
            </div>
            {thumb ? (
              <img
                src={thumb}
                alt=""
                className="h-12 w-12 rounded-sm object-cover border"
              />
            ) : null}
          </div>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
            {JSON.stringify(status.data, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
