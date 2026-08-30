"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { publishOpportunity, type PublishInput } from "@/app/admin/(protected)/products/actions";

/** "Publish" button for a computed opportunity — see products/actions.ts. */
export function PublishButton(props: PublishInput) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function handleClick() {
    setStatus(null);
    startTransition(async () => {
      const result = await publishOpportunity(props);
      setStatus(result);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button onClick={handleClick} disabled={pending} className={buttonClass("secondary", "sm")}>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        Publish
      </button>
      {status && (
        <span
          className={`flex items-center gap-1 text-xs ${status.ok ? "text-emerald-400" : "text-red-400"}`}
        >
          {status.ok && <CheckCircle2 className="h-3.5 w-3.5" />}
          {status.message}
        </span>
      )}
    </span>
  );
}
