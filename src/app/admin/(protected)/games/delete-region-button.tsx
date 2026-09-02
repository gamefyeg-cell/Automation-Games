"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Platform } from "@/lib/supabase/database.types";
import { deleteGameRegion } from "./actions";

export function DeleteRegionButton({
  id,
  label,
  platform = "steam",
}: {
  id: string;
  label: string;
  platform?: Platform;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm(`Remove ${label}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteGameRegion(id, platform);
      if (!result.ok) setError(result.message ?? "Failed to delete.");
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={pending}
        aria-label={`Delete ${label}`}
        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
