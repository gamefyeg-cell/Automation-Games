"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tr, Td } from "@/components/ui/table";
import { RegionReportDetail } from "@/components/region-report-detail";
import type { RegionReportResult } from "@/lib/pricing/report";
import { getGameRegionReport } from "./actions";
import { DeleteRegionButton } from "./delete-region-button";

export interface GameRegionRowData {
  id: string;
  gameName: string;
  countryCode: string;
  currency: string;
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  saleActive: boolean;
}

/**
 * Click a row to expand the same itemized cost/profit report /prices
 * shows right after "Choose" — but without re-syncing, since the price
 * is already saved. Fetched once per row and cached in state.
 */
export function GameRegionRow({ region }: { region: GameRegionRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegionReportResult | null>(null);

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!result) {
      setLoading(true);
      const fetched = await getGameRegionReport(region.id);
      setResult(fetched);
      setLoading(false);
    }
  }

  const label = `${region.gameName} (${region.countryCode})`;

  return (
    <>
      <Tr onClick={handleToggle}>
        <Td>
          <span className="flex items-center gap-1.5 font-medium text-zinc-100">
            <ChevronDown
              className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {region.gameName}
          </span>
        </Td>
        <Td muted>
          {region.countryCode} ({region.currency})
        </Td>
        <Td align="right" muted>
          {region.originalPrice}
        </Td>
        <Td align="right">{region.currentPrice}</Td>
        <Td align="right">
          {region.discountPercent > 0 ? (
            <Badge tone="success">-{region.discountPercent}%</Badge>
          ) : (
            <span className="text-zinc-600">—</span>
          )}
        </Td>
        <Td align="right">
          {region.saleActive ? <Badge tone="success">Active</Badge> : <span className="text-zinc-600">—</span>}
        </Td>
        <Td align="right">
          {/* Row's onClick would also fire on this click; stop it from toggling the row too. */}
          <span onClick={(e) => e.stopPropagation()}>
            <DeleteRegionButton id={region.id} label={label} />
          </span>
        </Td>
      </Tr>

      {expanded && (
        <tr className="border-t border-zinc-800/80 bg-zinc-950/40">
          <td colSpan={7} className="p-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading report…
              </div>
            )}
            {!loading && result && !result.ok && (
              <p className="text-sm text-amber-400">{result.message}</p>
            )}
            {!loading && result?.report && <RegionReportDetail report={result.report} />}
          </td>
        </tr>
      )}
    </>
  );
}
