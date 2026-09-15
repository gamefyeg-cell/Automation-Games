"use client";

import { useActionState, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Platform } from "@/lib/supabase/database.types";
import { importSellableGiftCardsCsv, type ImportState } from "./actions";

const EXAMPLE = `Region\tCard\tYour Cost\tRecommended Price\tProfit
US\t$10 Steam Gift Card\t450\t520\t70
US\t$20 Steam Gift Card\t900\t1030\t130
Turkey\t100 TL Steam Card\t130\t160\t30
Europe\t€10 Steam Card\t490\t560\t70`;

const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".xlsb", ".ods"];

export function SellableGiftCardImportForm({ platform = "steam" }: { platform?: Platform }) {
  const [state, formAction, pending] = useActionState<ImportState | null, FormData>(
    importSellableGiftCardsCsv,
    null,
  );
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function processFile(file: File) {
    setFileError(null);
    setFileName(file.name);
    const isExcel = EXCEL_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    try {
      let csv: string;
      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("That spreadsheet has no sheets.");
        csv = XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
      } else {
        csv = await file.text();
      }
      if (textareaRef.current) textareaRef.current.value = csv;
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Couldn't read that file.");
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <Card className="mt-3">
      <CardBody>
        <form
          action={formAction}
          className="space-y-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
        >
          <input type="hidden" name="platform" value={platform} />
          <div>
            <p className="text-sm font-semibold text-zinc-100">Import gift cards for sale</p>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Drop an Excel (.xlsx/.xls) file or paste tab/comma-separated rows from your sheet.
              Expects columns: <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">Region</code>,{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">Card</code>,{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">Your Cost</code>,{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">Recommended Price</code>, and optionally{" "}
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-zinc-300">Profit</code>.
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
              dragActive ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-700",
            )}
          >
            <FileSpreadsheet className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />
            <p className="text-sm text-zinc-400">
              Drag your Excel (.xlsx) file here, or{" "}
              <label className="cursor-pointer font-medium text-indigo-400 hover:text-indigo-300">
                browse
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsb,.ods"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </p>
            {fileName && !fileError && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Upload className="h-3 w-3" />
                Loaded {fileName}
              </p>
            )}
            {fileError && <p className="text-xs text-red-400">{fileError}</p>}
          </div>

          <textarea
            ref={textareaRef}
            name="csv"
            rows={6}
            placeholder={EXAMPLE}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          />

          <div className="flex items-center justify-between">
            <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
              {pending ? "Importing…" : "Import cards"}
            </button>
            {state && (
              <p className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>
                {state.message}
              </p>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
