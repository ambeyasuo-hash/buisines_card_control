// (c) 2026 ambe / Business_Card_Folder
// Image preprocessing pipeline for business card photos.
//
// Architecture:
//   Layer 1 (always): Canvas-based grayscale + contrast enhancement
//   Layer 2 (future):  OpenCV.js deskew / perspective correction
//                      Hook point: replace canvasEnhance() return with an
//                      OpenCV Mat pipeline when window.cv is available.
//
// All processing is client-side — no pixel data leaves the browser.

/**
 * Grayscale + contrast stretch via Canvas API.
 * Returns a preprocessed PNG File ready for Tesseract.
 */
async function canvasEnhance(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    // ITU-R BT.601 luminosity coefficients
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast stretch: 1.4× factor, clamped to [0, 255]
    const stretched = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
    data[i] = data[i + 1] = data[i + 2] = stretched;
    // alpha unchanged
  }
  ctx.putImageData(imgData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + "_processed.png", {
    type: "image/png",
  });
}

/**
 * OpenCV.js enhancement hook — placeholder for Phase 2 implementation.
 * When `window.cv` is available, apply advanced image preprocessing:
 * - Adaptive thresholding
 * - Perspective correction
 * - Deskew (Hough-line-based rotation detection)
 * - Denoising
 *
 * Returns the original file if OpenCV is not available or processing fails.
 */
async function opencvEnhance(file: File): Promise<File> {
  if (typeof window === "undefined" || !window.cv) {
    return file;
  }

  try {
    // Hook point: detailed OpenCV pipeline will be implemented in Phase 2
    // For now, return the file unchanged — canvas preprocessing is sufficient
    // TODO: Implement perspective transform, adaptive threshold, deskew
    return file;
  } catch {
    // Graceful degradation if OpenCV processing fails
    return file;
  }
}

/**
 * Preprocess a business card image for optimal OCR accuracy.
 *
 * Applies layered preprocessing:
 * 1. Canvas API: Grayscale conversion and contrast enhancement (always)
 * 2. OpenCV.js: Advanced corrections if `window.cv` is available (future)
 *
 * Gracefully degrades to the original File if any processing step fails.
 */
export async function preprocessCardImage(file: File): Promise<File> {
  try {
    // Layer 1: Canvas-based preprocessing (always applied)
    let processed = await canvasEnhance(file);

    // Layer 2: OpenCV.js enhancements if available
    // (currently a hook point; implementation pending)
    if (typeof window !== "undefined" && window.cv) {
      processed = await opencvEnhance(processed);
    }

    return processed;
  } catch {
    // Fallback: return original if any processing step fails
    return file;
  }
}
