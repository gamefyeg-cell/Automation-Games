"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { setProductPublished } from "./actions";

export function PublishedToggle({ id, published }: { id: string; published: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await setProductPublished(id, !published);
    });
  }

  return (
    <button onClick={handleClick} disabled={pending} className="disabled:opacity-50">
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      ) : published ? (
        <Badge tone="success">Published</Badge>
      ) : (
        <Badge tone="neutral">Draft</Badge>
      )}
    </button>
  );
}
