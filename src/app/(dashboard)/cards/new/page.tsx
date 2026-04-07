// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";
import { prefetchGeolocation } from "@/lib/geolocation";
import { analyzeBusinessCard } from "@/lib/gemini";
import { TimeoutError, withTimeout } from "@/lib/async";

export default function NewCardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok"; data: any }
    | { state: "ng"; message: string }
  >({ state: "idle" });

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
  }, []);

  const inputId = "scan-camera-input";

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
          </div>
        ) : null}

        {status.state === "ok" ? (
          <section className="rounded-lg border bg-card p-4">
            <div className="font-semibold mb-2">抽出結果</div>
            <pre className="max-h-[420px] overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
              {JSON.stringify(status.data, null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}

