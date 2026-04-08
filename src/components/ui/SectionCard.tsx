// (c) 2026 ambe / Business_Card_Folder

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  /** Element placed in the header right-side (e.g. action button) */
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, headerRight, children, className }: SectionCardProps) {
  const hasHeader = title || headerRight;
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-white/[0.03] p-4", className)}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 mb-4">
          {title && <h3 className="font-bold text-slate-50">{title}</h3>}
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
