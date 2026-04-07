// (c) 2026 ambe / Business_Card_Folder

"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

export type ToastData = {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
};

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mount → フェードイン
    const t1 = setTimeout(() => setVisible(true), 16);
    // 2.5秒後にフェードアウト
    const t2 = setTimeout(() => setVisible(false), 2500);
    // フェードアウト後に削除
    const t3 = setTimeout(() => onDismiss(toast.id), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [toast.id, onDismiss]);

  const icon =
    toast.type === "success" ? (
      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
    ) : toast.type === "error" ? (
      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
    ) : null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur px-4 py-3 text-sm text-white shadow-xl transition-all duration-300",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      )}
    >
      {icon}
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-slate-400 hover:text-white"
        aria-label="閉じる"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none w-[90vw] max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className="w-full pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────
// Hook: useToast
// ──────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  function push(message: string, type: ToastData["type"] = "info") {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, push, dismiss };
}
