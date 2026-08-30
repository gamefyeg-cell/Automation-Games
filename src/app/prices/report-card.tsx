import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { RegionReportDetail } from "@/components/region-report-detail";
import type { SaveRegionResult } from "./actions";

export function SaveReportCard({ saveResult }: { saveResult: SaveRegionResult }) {
  return (
    <div
      className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
        saveResult.ok
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          : "border-amber-500/20 bg-amber-500/10 text-amber-400"
      }`}
    >
      <div className="flex items-center gap-2">
        {saveResult.ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
        {saveResult.message}
        {!saveResult.ok && saveResult.message.includes("/admin") && (
          <Link href="/admin/login" className="underline">
            Log in
          </Link>
        )}
      </div>

      {saveResult.report && (
        <div className="mt-4">
          <RegionReportDetail report={saveResult.report} />
        </div>
      )}
    </div>
  );
}
