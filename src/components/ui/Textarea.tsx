// (c) 2026 ambe / Business_Card_Folder

import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...rest },
  ref
) {
  const textareaId = id ?? label;
  return (
    <div className="grid gap-1.5">
      {label ? (
        <label htmlFor={textareaId} className="text-xs font-semibold text-slate-300">
          {label}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={textareaId}
        className={cn(
          "min-h-24 w-full rounded-xl border bg-white/5 p-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors resize-none",
          error ? "border-red-500/40 focus:border-red-400/70" : "border-white/10 focus:border-white/25",
          className
        )}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
