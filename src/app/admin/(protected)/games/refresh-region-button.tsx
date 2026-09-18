"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import type { Platform } from "@/lib/supabase/database.types";
import { syncSingleGameRegion } from "./actions";

export function RefreshRegionButton({
  id,
  label,
  platform = "steam",
}: {
  id: string;
  label: string;
  platform?: Platform;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      const result = await syncSingleGameRegion(id, platform);
      if (!result.ok) {
        setError(result.message ?? "Failed to sync.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-label={`Sync ${label}`}
        title={pending ? `Syncing ${label}...` : `Sync ${label} now`}
        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-indigo-500/10 hover:text-indigo-400 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </button>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </span>
  );
}
