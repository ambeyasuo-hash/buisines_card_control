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
 * Preprocess a business card image for optimal OCR accuracy.
 *
 * Applies grayscale conversion and contrast enhancement via Canvas API.
 * Gracefully degrades to the original File if any processing step fails.
 *
 * OpenCV.js hook: when `window.cv` is loaded, extend this function with
 * adaptive thresholding and deskew (Hough-line-based rotation correction)
 * before returning the canvas-enhanced file.
 */
export async function preprocessCardImage(file: File): Promise<File> {
  try {
    return await canvasEnhance(file);
  } catch {
    // Fallback: return original if canvas operations fail
    return file;
  }
}
