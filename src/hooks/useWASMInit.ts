// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useEffect, useState } from "react";

/**
 * OCR Status: Azure AI Document Intelligence only (Tesseract.js removed)
 *
 * Note: Azure OCR is server-side only (Server Actions), no client-side WASM needed.
 * This hook is kept for backward compatibility with existing UI code.
 */
export type WASMStatus =
  | { state: "idle" }
  | { state: "initializing"; library: "azure" }
  | { state: "ready"; tesseract: boolean; opencv: boolean }
  | { state: "error"; message: string };

/**
 * Stub hook for OCR initialization (Azure AI Document Intelligence).
 *
 * Azure OCR runs on the server-side via Server Actions, so no client-side
 * WASM initialization is required. This hook immediately returns "ready" state.
 *
 * Usage:
 * ```tsx
 * const { status, isReady } = useWASMInit();
 * const isLoading = status.state === "initializing";
 * ```
 *
 * @deprecated Azure OCR (server-side) replaces client-side Tesseract.js
 */
export function useWASMInit() {
  const [status, setStatus] = useState<WASMStatus>({ state: "ready", tesseract: false, opencv: false });

  useEffect(() => {
    // Azure OCR is server-side only, no initialization needed on client
    // Status is immediately "ready"
    setStatus({ state: "ready", tesseract: false, opencv: false });
  }, []);

  const isReady = status.state === "ready";
  const isTesseractReady = false; // Tesseract removed (Azure OCR used instead)
  const isOpenCVReady = typeof window !== "undefined" && !!window.cv; // OpenCV may be available

  return {
    status,
    isReady,
    isTesseractReady,
    isOpenCVReady,
  };
}
