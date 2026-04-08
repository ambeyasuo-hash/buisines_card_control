// (c) 2026 ambe / Business_Card_Folder
// Tesseract.js Worker — Singleton pattern to prevent memory leaks.
// A single Worker instance is reused for all OCR calls within the session.
// The Worker is terminated only when explicitly called (e.g. on page unload).

import { createWorker, type Worker } from "tesseract.js";

/** Module-level singleton state */
let worker: Worker | null = null;
let initPromise: Promise<Worker> | null = null;

/**
 * Returns the shared OCR Worker, initialising it lazily on first call.
 * Subsequent calls return the already-initialised Worker immediately.
 * Safe to call concurrently — only one Worker is ever created.
 */
export async function getOCRWorker(): Promise<Worker> {
  if (worker) return worker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const w = await createWorker(["jpn", "eng"], 1, {
      // Suppress verbose Tesseract progress output
      logger: () => {},
      errorHandler: () => {},
    });
    worker = w;
    return w;
  })();

  return initPromise;
}

/**
 * Terminate the Worker and clear all module-level references.
 * Call this when OCR is no longer needed (e.g. scan feature unmounted
 * or user navigates away from the application entirely).
 */
export async function terminateOCRWorker(): Promise<void> {
  if (worker) {
    const w = worker;
    worker = null;
    initPromise = null;
    await w.terminate();
  }
}
