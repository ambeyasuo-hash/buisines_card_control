// (c) 2026 ambe / Business_Card_Folder

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const variantCls: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white font-bold hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40",
  secondary:
    "bg-white text-slate-950 font-bold hover:bg-slate-100 active:bg-slate-200 disabled:opacity-40",
  ghost:
    "bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 active:bg-white/15 disabled:opacity-40",
  danger:
    "bg-red-600 text-white font-bold hover:bg-red-500 active:bg-red-700 disabled:opacity-40",
};

const sizeCls: Record<Size, string> = {
  sm: "h-9 px-4 text-xs rounded-full gap-1.5",
  md: "h-11 px-5 text-sm rounded-full gap-2",
  lg: "h-14 px-6 text-base rounded-full gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    icon,
    children,
    className,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center transition-colors select-none",
        variantCls[variant],
        sizeCls[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
});
