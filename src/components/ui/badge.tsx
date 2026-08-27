import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-zinc-800 text-zinc-300",
  success: "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20",
  danger: "bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20",
  accent: "bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
