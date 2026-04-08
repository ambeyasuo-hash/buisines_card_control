// (c) 2026 ambe / Business_Card_Folder

import { cn } from "@/lib/utils";

interface ToastProps {
  message: string | null;
  /** Override bottom positioning — default is "bottom-6" */
  className?: string;
}

export function Toast({ message, className }: ToastProps) {
  if (!message) return null;
  return (
    <div className={cn(
      "fixed left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/20 bg-slate-900 px-4 py-2 text-sm text-white shadow-lg",
      className ?? "bottom-6"
    )}>
      {message}
    </div>
  );
}
