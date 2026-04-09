// (c) 2026 ambe / Business_Card_Folder
// DEPRECATED: Client-side OCR subsystem
//
// This module has been deprecated in favor of server-side Azure AI Document Intelligence.
// All business card analysis now runs server-side via analyzeAndSaveBusinessCard() in src/lib/azure-ocr.ts
// which provides zero-knowledge guarantee with image deletion within 24h.
//
// Legacy browser-based Tesseract.js implementation has been removed.

import type { CardOCRResult } from "@/types";

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
 * DEPRECATED: analyzeBusinessCard
 *
 * This function is no longer supported. Use analyzeAndSaveBusinessCard() from src/lib/azure-ocr.ts instead.
 *
 * @deprecated Use analyzeAndSaveBusinessCard() for zero-knowledge Azure OCR with Supabase storage
 * @throws Always throws error indicating deprecation
 */
export async function analyzeBusinessCard(imageFile: File): Promise<CardOCRResult> {
  throw new Error(
    "analyzeBusinessCard は廃止されました。src/lib/azure-ocr.ts の analyzeAndSaveBusinessCard() を使用してください。"
  );
}
