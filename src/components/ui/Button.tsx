// (c) 2026 ambe / Business_Card_Folder

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: ReactNode;
  type?: "button" | "submit" | "reset";
  className?: string;
  title?: string;
  /** For <a> usage — renders as anchor tag */
  href?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 border-transparent",
  secondary:
    "bg-white/5 text-slate-50 border-white/15 hover:bg-white/10",
  danger:
    "bg-red-500/5 text-red-400 border-red-500/30 hover:bg-red-500/10",
  ghost:
    "bg-transparent text-slate-50 border-white/10 hover:bg-white/5",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-11 px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  disabled,
  loading,
  onClick,
  children,
  type = "button",
  className,
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-medium transition disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {loading ? "処理中..." : children}
    </button>
  );
}
