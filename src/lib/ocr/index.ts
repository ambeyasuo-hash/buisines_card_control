// (c) 2026 ambe / Business_Card_Folder
// Public API for the OCR subsystem.
// All image analysis runs locally in the browser via Tesseract.js.
// No image data is transmitted to any external service.

import type { CardOCRResult } from "@/types";
import { getOCRWorker } from "./engine";
import { parseBusinessCardText } from "./parser";

export { terminateOCRWorker } from "./engine";

// ─── helpers ───────────────────────────────────────────────────────────────

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(blob);
  });
}

async function createThumbnailDataUrl(
  imageFile: File,
  targetWidth = 100
): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(imageFile);
    const scale = targetWidth / bitmap.width;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/webp", 0.6)
    );
    if (!blob) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

// ─── public API ────────────────────────────────────────────────────────────

/**
 * Analyse a business card image entirely within the browser.
 * Extracts structured fields via Tesseract.js + regex parser.
 * The Worker singleton is reused across calls to avoid memory leaks.
 *
 * @throws if called outside a browser context
 */
export async function analyzeBusinessCard(imageFile: File): Promise<CardOCRResult> {
  if (typeof window === "undefined") {
    throw new Error("analyzeBusinessCard はクライアントサイドでのみ実行できます");
  }

  const worker = await getOCRWorker();
  const [result, thumbnail] = await Promise.all([
    worker.recognize(imageFile),
    createThumbnailDataUrl(imageFile, 100),
  ]);

  const parsed = parseBusinessCardText(result.data.text);

  return {
    name: parsed.name ?? null,
    name_kana: null,
    company: parsed.company ?? null,
    department: null,
    title: parsed.title ?? null,
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    mobile: parsed.mobile ?? null,
    address: parsed.address ?? null,
    website: parsed.website ?? null,
    notes: null,
    thumbnail_base64: thumbnail ?? undefined,
  };
}
