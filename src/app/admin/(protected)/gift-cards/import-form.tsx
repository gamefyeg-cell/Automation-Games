"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { importGiftCardsCsv, type ImportState } from "./actions";

const EXAMPLE = `provider,product_name,value,value_currency,purchase_price,fees,purchase_currency
G2A,Steam Wallet Code,10,USD,470,12,EGP
G2A,Steam Wallet Code,20,USD,920,15,EGP`;

export function GiftCardImportForm() {
  const [state, formAction, pending] = useActionState<ImportState | null, FormData>(
    importGiftCardsCsv,
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (textareaRef.current) textareaRef.current.value = String(reader.result ?? "");
    };
    reader.readAsText(file);
  }

  return (
    <Card className="mt-3">
      <CardBody>
        <form action={formAction} className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">Import gift cards</p>
            <p className="mt-1 text-xs text-zinc-500">
              Paste CSV/TSV (an Excel copy-paste works) or upload a file. Header row required.
              Required columns: <code className="text-zinc-400">provider</code>,{" "}
              <code className="text-zinc-400">product_name</code>,{" "}
              <code className="text-zinc-400">value</code>,{" "}
              <code className="text-zinc-400">purchase_price</code>. Optional:{" "}
              <code className="text-zinc-400">value_currency</code> (default USD),{" "}
              <code className="text-zinc-400">region</code>,{" "}
              <code className="text-zinc-400">fees</code> (default 0),{" "}
              <code className="text-zinc-400">purchase_currency</code> (default EGP),{" "}
              <code className="text-zinc-400">active</code> (default true).
            </p>
          </div>

          <label className={buttonClass("secondary", "sm", "cursor-pointer w-fit")}>
            <Upload className="h-3.5 w-3.5" />
            Choose file
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleFile} className="hidden" />
          </label>

          <textarea
            ref={textareaRef}
            name="csv"
            rows={8}
            placeholder={EXAMPLE}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          />

          <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
            {pending ? "Importing…" : "Import"}
          </button>

          {state && (
            <p className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>
              {state.message}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
