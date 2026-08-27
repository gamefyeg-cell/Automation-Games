import { cn } from "@/lib/utils/cn";

export const inputClass = cn(
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100",
  "placeholder:text-zinc-500 outline-none transition-colors",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30",
);

export const labelClass = "block text-xs font-medium text-zinc-400";
