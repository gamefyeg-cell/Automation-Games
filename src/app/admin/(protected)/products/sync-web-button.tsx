"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Globe, Loader2, RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import type { Platform } from "@/lib/supabase/database.types";
import {
  pushProductToGamefyWeb,
  pushAllPublishedToGamefyWeb,
} from "@/app/admin/(protected)/products/actions";

export function SyncWebButton({ productId, title }: { productId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSync() {
    setStatus(null);
    startTransition(async () => {
      const result = await pushProductToGamefyWeb(productId);
      setStatus(result);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleSync}
        disabled={pending}
        title={`Sync "${title}" to gamefy-two.vercel.app`}
        className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-indigo-500/50 hover:bg-zinc-800 hover:text-indigo-200 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
        ) : (
          <Globe className="h-3 w-3 text-indigo-400" />
        )}
        Push to Web
      </button>

      {status && (
        <span
          className={`flex items-center gap-1 text-[11px] ${
            status.ok ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {status.ok && <CheckCircle2 className="h-3 w-3" />}
          {status.message}
        </span>
      )}
    </span>
  );
}

export function SyncAllWebButton({ platform }: { platform?: Platform }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSyncAll() {
    if (
      !window.confirm(
        "Sync all published products to your live Gamefy website (https://gamefy-two.vercel.app)?",
      )
    ) {
      return;
    }

    setStatus(null);
    startTransition(async () => {
      const result = await pushAllPublishedToGamefyWeb(platform);
      setStatus(result);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleSyncAll}
        disabled={pending}
        className={buttonClass("secondary", "sm")}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
        )}
        Sync All to Gamefy Web
      </button>

      {status && (
        <span
          className={`flex items-center gap-1 text-xs ${
            status.ok ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {status.ok && <CheckCircle2 className="h-3.5 w-3.5" />}
          {status.message}
        </span>
      )}
    </div>
  );
}
