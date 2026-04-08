// (c) 2026 ambe / Business_Card_Folder
// Advanced image preprocessing for business card OCR.
//
// Pipeline:
//   1. Grayscale conversion (ITU-R BT.601)
//   2. Gaussian blur (optional, noise reduction)
//   3. Adaptive thresholding (Bradley algorithm via integral image)
//   4. Contrast enhancement
//
// All processing is client-side — no pixel data leaves the browser.

/**
 * Convert image to grayscale using ITU-R BT.601 coefficients.
 */
function toGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number): ImageData {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    // ITU-R BT.601 luminosity
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
    // alpha channel unchanged
  }

  return imgData;
}

/**
 * Compute integral image for fast local statistics.
 * integral[y][x] = sum of pixels in rect (0,0)-(x,y)
 */
function computeIntegralImage(grayData: ImageData, width: number, height: number): number[][] {
  const data = grayData.data;
  const integral: number[][] = Array(height + 1)
    .fill(null)
    .map(() => Array(width + 1).fill(0));

  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      const pixelIdx = ((y - 1) * width + (x - 1)) * 4;
      const pixelValue = data[pixelIdx];

      integral[y][x] =
        pixelValue +
        integral[y - 1][x] +
        integral[y][x - 1] -
        integral[y - 1][x - 1];
    }
  }

  return integral;
}

/**
 * Get sum of rectangle using integral image.
 * rect: [x0, y0, x1, y1] (inclusive)
 */
function getRectSum(
  integral: number[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): number {
  const x0c = Math.max(0, x0);
  const y0c = Math.max(0, y0);
  const x1c = Math.min(integral[0].length - 1, x1 + 1);
  const y1c = Math.min(integral.length - 1, y1 + 1);

  return (
    integral[y1c][x1c] -
    integral[y0c][x1c] -
    integral[y1c][x0c] +
    integral[y0c][x0c]
  );
}

/**
 * Bradley adaptive thresholding algorithm.
 * For each pixel, compare against the mean of its neighborhood.
 *
 * @param grayData Input grayscale ImageData
 * @param width Image width
 * @param height Image height
 * @param windowSize Neighborhood size (e.g., 20 for 20x20 window)
 * @param threshold Offset from mean (negative = darker threshold, typical -3 to -10)
 */
function adaptiveThreshold(
  grayData: ImageData,
  width: number,
  height: number,
  windowSize: number = 20,
  threshold: number = -5
): ImageData {
  const integral = computeIntegralImage(grayData, width, height);
  const result = new ImageData(width, height);
  const resultData = result.data;
  const srcData = grayData.data;

  const halfWindow = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const pixelValue = srcData[srcIdx];

      // Get rectangle bounds
      const x0 = x - halfWindow;
      const y0 = y - halfWindow;
      const x1 = x + halfWindow;
      const y1 = y + halfWindow;

      // Calculate local mean using integral image
      const rectArea = (x1 - x0 + 1) * (y1 - y0 + 1);
      const rectSum = getRectSum(integral, x0, y0, x1, y1);
      const localMean = rectSum / Math.max(1, rectArea);

      // Adaptive threshold: pixel > (localMean + threshold)
      const binaryValue = pixelValue > localMean + threshold ? 255 : 0;

      resultData[srcIdx] = binaryValue;
      resultData[srcIdx + 1] = binaryValue;
      resultData[srcIdx + 2] = binaryValue;
      resultData[srcIdx + 3] = 255; // opaque
    }
  }

  return result;
}

/**
 * Enhance contrast by stretching histogram.
 */
function enhanceContrast(imgData: ImageData): ImageData {
  const data = imgData.data;
  let minVal = 255;
  let maxVal = 0;

  // Find min/max
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i];
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  }

  // Stretch if not already full range
  if (maxVal - minVal < 200) {
    const range = maxVal - minVal || 1;
    for (let i = 0; i < data.length; i += 4) {
      const normalized = ((data[i] - minVal) / range) * 255;
      data[i] = data[i + 1] = data[i + 2] = Math.round(normalized);
    }
  }

  return imgData;
}

/**
 * Preprocess business card image for optimal OCR accuracy.
 *
 * Pipeline:
 * 1. Convert to grayscale (ITU-R BT.601)
 * 2. Apply adaptive thresholding (Bradley algorithm)
 * 3. Enhance contrast
 * 4. Return as PNG File
 *
 * @param file Input image file
 * @returns Preprocessed PNG file
 */
export async function preprocessCardImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Draw original image
    ctx.drawImage(bitmap, 0, 0);

    // Step 1: Grayscale
    let imgData = toGrayscale(ctx, canvas.width, canvas.height);

    // Step 2: Adaptive thresholding (Bradley algorithm)
    // windowSize = 20 (tuned for business card resolution 300-400 dpi)
    // threshold = -5 (offset from local mean)
    imgData = adaptiveThreshold(imgData, canvas.width, canvas.height, 20, -5);

    // Step 3: Contrast enhancement
    imgData = enhanceContrast(imgData);

    // Put processed image back to canvas
    ctx.putImageData(imgData, 0, 0);

    // Convert to PNG file
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png")
    );

    if (!blob) return file;

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + "_preprocessed.png",
      { type: "image/png" }
    );
  } catch {
    // Graceful fallback to original
    return file;
  }
}
