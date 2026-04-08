// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useEffect, useState } from "react";
import { getOCRWorker } from "@/lib/ocr/engine";

/**
 * WASM initialization status discriminated union.
 * Tracks the state of Tesseract.js and OpenCV.js loading.
 */
export type WASMStatus =
  | { state: "idle" }
  | { state: "initializing"; library: "tesseract" | "opencv" }
  | { state: "ready"; tesseract: boolean; opencv: boolean }
  | { state: "error"; message: string };

/**
 * Global hook for WASM library initialization.
 *
 * - Detects `window.Tesseract` (from CDN or npm)
 * - Detects `window.cv` (OpenCV.js from CDN)
 * - Triggers lazy initialization of Tesseract Worker on first access
 * - Provides discriminated union status for transparent UI feedback
 *
 * Usage:
 * ```tsx
 * const { status, isReady } = useWASMInit();
 * const isLoading = status.state === "initializing";
 * ```
 */
export function useWASMInit() {
  const [status, setStatus] = useState<WASMStatus>({ state: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        // Check if OpenCV is already available from CDN
        const openCVReady = typeof window !== "undefined" && !!window.cv;

        // Trigger Tesseract Worker initialization
        setStatus({ state: "initializing", library: "tesseract" });
        await getOCRWorker();

        if (!cancelled) {
          setStatus({
            state: "ready",
            tesseract: true,
            opencv: openCVReady,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to initialize WASM";
          setStatus({ state: "error", message });
        }
      }
    }

    // Start initialization on mount
    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const isReady = status.state === "ready";
  const isTesseractReady =
    status.state === "ready" ? status.tesseract : false;
  const isOpenCVReady = status.state === "ready" ? status.opencv : false;

  return {
    status,
    isReady,
    isTesseractReady,
    isOpenCVReady,
  };
}
