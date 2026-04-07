// (c) 2026 ambe / Business_Card_Folder

"use client";

import { useEffect } from "react";
import { prefetchGeolocation } from "@/lib/geolocation";

// OCR UI 実装の前段: ファイル選択/カメラ起動のタイミングで位置情報取得を先行開始する
export default function OCRCamera() {
  useEffect(() => {
    // 画面表示時点で先行して開始（許可ダイアログを早めに出して保存時に間に合わせる）
    void prefetchGeolocation();
  }, []);

  return null;
}
