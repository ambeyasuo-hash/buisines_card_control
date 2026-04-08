// WASM libraries type definitions for window globals

declare global {
  interface Window {
    /**
     * Tesseract.js library from CDN or npm.
     * Available after CDN script loads or npm import.
     */
    Tesseract?: {
      createWorker: (
        languages: string[],
        ocrEngineMode: number,
        options?: any
      ) => Promise<any>;
    };

    /**
     * OpenCV.js library from CDN.
     * Available after CDN script loads; used for advanced image preprocessing.
     */
    cv?: any;
  }
}

export {};
