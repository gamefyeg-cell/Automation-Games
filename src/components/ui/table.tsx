import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-zinc-900/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </thead>
  );
}

export function Th({ children, align }: { children: ReactNode; align?: "right" }) {
  return (
    <th className={cn("px-4 py-3 whitespace-nowrap", align === "right" && "text-right")}>
      {children}
    </th>
  );
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-t border-zinc-800/80 transition-colors hover:bg-zinc-900/40",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align,
  muted,
  colSpan,
}: {
  children: ReactNode;
  align?: "right";
  muted?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-4 py-3 whitespace-nowrap",
        align === "right" && "text-right tabular-nums",
        muted && "text-zinc-500",
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-zinc-500">
        {children}
      </td>
    </tr>
  );
}
