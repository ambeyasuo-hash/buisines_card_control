// (c) 2026 ambe / Business_Card_Folder

"use client";

import { cn } from "@/lib/utils";

interface ScanOverlayProps {
  visible: boolean;
  label?: string;
}

/**
 * 名刺スキャン中に画像上に重ねるオーバーレイ。
 * - 四隅にカメラフォーカス風のブラケットを表示
 * - 青いスキャンビームが上下にアニメーション
 * - ビームには上方向にグラデーション尾流を付与し、「走査」の実感を演出
 */
export function ScanOverlay({ visible, label = "AIが名刺を解析中..." }: ScanOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!visible}
    >
      {/* 背景ディム */}
      <div className="absolute inset-0 bg-slate-950/60" />

      {/* 四隅ブラケット */}
      <BracketCorners />

      {/* スキャンビーム（アニメーション） */}
      <div className="absolute inset-x-0 top-0 bottom-0 overflow-hidden">
        {/* ビーム本体 */}
        <div className="absolute left-0 right-0 animate-scan-beam" style={{ height: "60px" }}>
          {/* グラデーション尾流（上方向へフェード） */}
          <div
            className="absolute inset-x-0 bottom-[3px] h-[56px]"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(59,130,246,0.08) 60%, rgba(59,130,246,0.18))",
            }}
          />
          {/* 走査ライン */}
          <div
            className="absolute inset-x-0 bottom-0 h-[3px]"
            style={{
              background:
                "linear-gradient(to right, transparent 0%, rgba(59,130,246,0.6) 15%, #3b82f6 40%, #93c5fd 50%, #3b82f6 60%, rgba(59,130,246,0.6) 85%, transparent 100%)",
              boxShadow: "0 0 12px 4px rgba(59,130,246,0.55), 0 0 3px 1px rgba(147,197,253,0.9)",
            }}
          />
        </div>
      </div>

      {/* ラベル */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center p-4 pb-3">
        <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 backdrop-blur">
          <span
            className="h-2 w-2 rounded-full bg-blue-400 animate-pulse"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-white/90">{label}</span>
        </div>
      </div>
    </div>
  );
}

/** 四隅のフォーカスブラケット */
function BracketCorners() {
  const corners = [
    { position: "top-2 left-2", h: "border-t-2 border-l-2 rounded-tl-sm" },
    { position: "top-2 right-2", h: "border-t-2 border-r-2 rounded-tr-sm" },
    { position: "bottom-2 left-2", h: "border-b-2 border-l-2 rounded-bl-sm" },
    { position: "bottom-2 right-2", h: "border-b-2 border-r-2 rounded-br-sm" },
  ];

  return (
    <>
      {corners.map(({ position, h }) => (
        <div
          key={position}
          className={cn("absolute h-7 w-7 border-blue-400/80 animate-bracket-pulse", position, h)}
        />
      ))}
    </>
  );
}
