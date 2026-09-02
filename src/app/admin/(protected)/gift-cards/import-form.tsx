"use client";

import { useActionState, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Platform } from "@/lib/supabase/database.types";
import { importGiftCardsCsv, type ImportState } from "./actions";

const EXAMPLE = `Product,Value,Country,Provider,Price,Fees
Steam GC,1$,EGYPT,G2A,92.29,12
Steam GC,50 UAH,UKRAINE,G2A,89.25,12`;

const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".xlsb", ".ods"];

export function GiftCardImportForm({ platform = "steam" }: { platform?: Platform }) {
  const [state, formAction, pending] = useActionState<ImportState | null, FormData>(
    importGiftCardsCsv,
    null,
  );
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * .csv/.tsv/.txt are plain text — read directly. A real .xlsx/.xls is a
   * binary (zip) format; reading it as text produces garbage, which used
   * to surface as a confusing parse error. SheetJS reads the actual
   * workbook and we convert its first sheet to CSV, so the same
   * server-side parser (actions.ts) handles both paths identically.
   */
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
            <p className="text-sm font-semibold text-zinc-100">Import gift cards</p>
            <p className="mt-1 text-xs text-zinc-500">
              Drop a CSV or Excel (.xlsx) file, or paste CSV/TSV directly — your own column names
              are fine (<code className="text-zinc-400">Product</code>,{" "}
              <code className="text-zinc-400">Country</code>,{" "}
              <code className="text-zinc-400">Price</code>, etc. are all recognized), and extra
              columns like a suggested margin or a supplier link are just ignored. Needs a{" "}
              <code className="text-zinc-400">Provider</code>, a{" "}
              <code className="text-zinc-400">Value</code> (a currency symbol or code in the same
              cell is fine, e.g. <code className="text-zinc-400">1$</code> or{" "}
              <code className="text-zinc-400">50 UAH</code>), and a{" "}
              <code className="text-zinc-400">Price</code>. Everything else — product name,
              country/region, fees, active — is optional.
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
              Drag a CSV or Excel file here, or{" "}
              <label className="cursor-pointer text-indigo-400 hover:text-indigo-300">
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
