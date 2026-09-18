"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { Platform } from "@/lib/supabase/database.types";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/time";
import { syncAllGames } from "./actions";

export function SyncAllGamesButton({
  platform,
  lastSyncedAt,
  totalCount,
}: {
  platform: Platform;
  lastSyncedAt: string | null;
  totalCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [relativeTime, setRelativeTime] = useState<string>(() =>
    formatRelativeTime(lastSyncedAt),
  );

  useEffect(() => {
    setRelativeTime(formatRelativeTime(lastSyncedAt));
    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(lastSyncedAt));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  function handleSyncAll() {
    setStatus(null);
    startTransition(async () => {
      const result = await syncAllGames(platform);
      setStatus(result);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <span
          className="flex items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400"
          title={lastSyncedAt ? formatDateTime(lastSyncedAt) : "No sync recorded yet"}
        >
          <Clock className="h-3.5 w-3.5 text-zinc-500" />
          <span>Last synced:</span>
          <span className="font-medium text-zinc-200">{relativeTime}</span>
        </span>

        <button
          type="button"
          onClick={handleSyncAll}
          disabled={pending}
          className={buttonClass("secondary", "sm")}
          title={`Sync all ${totalCount} tracked games on ${platform === "playstation" ? "PlayStation" : "Steam"}`}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
          )}
          <span>{pending ? "Syncing..." : "Sync All Games"}</span>
        </button>
      </div>

      {status && (
        <span
          className={`flex items-center gap-1.5 text-xs ${
            status.ok ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {status.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{status.message}</span>
        </span>
      )}
    </div>
  );
}
