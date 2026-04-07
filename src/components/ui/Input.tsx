// (c) 2026 ambe / Business_Card_Folder

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** 右端に表示するアイコン or バッジ */
  trailing?: React.ReactNode;
  /** OCR 結果が空だった場合にハイライトする */
  uncertain?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, trailing, uncertain, className, id, ...rest },
  ref
) {
  const inputId = id ?? label;
  return (
    <div className="grid gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            "text-xs font-semibold",
            uncertain ? "text-amber-400" : "text-slate-300"
          )}
        >
          {label}
          {uncertain && (
            <span className="ml-1.5 text-[10px] font-normal text-amber-400/80">
              要確認
            </span>
          )}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-xl border bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors",
            uncertain
              ? "border-amber-500/40 focus:border-amber-400/70"
              : error
                ? "border-red-500/40 focus:border-red-400/70"
                : "border-white/10 focus:border-white/25",
            trailing ? "pr-10" : undefined,
            className
          )}
          {...rest}
        />
        {trailing ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {trailing}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
