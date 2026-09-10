"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tr, Td } from "@/components/ui/table";
import { RegionReportDetail } from "@/components/region-report-detail";
import type { RegionReportResult } from "@/lib/pricing/report";
import type { Platform } from "@/lib/supabase/database.types";
import type { PriceChange } from "./price-change";
import { getGameRegionReport } from "./actions";
import { DeleteRegionButton } from "./delete-region-button";

function relative(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${Math.round(days)}d ago`;
  return `${Math.round(days / 7)}w ago`;
}

function ChangeCell({ change }: { change: PriceChange | null }) {
  if (!change || change.kind === "none") return <span className="text-zinc-600">—</span>;
  if (change.kind === "first-sync") {
    return <span className="text-xs text-zinc-600">first sync</span>;
  }

  const map: Record<Exclude<PriceChange["kind"], "none" | "first-sync">, [BadgeTone, string]> = {
    "discount-ended": ["warning", `Discount ended (was -${change.fromDiscount}%)`],
    "discount-new": ["success", `New discount -${change.toDiscount}%`],
    "discount-deepened": ["success", `Deeper -${change.fromDiscount}% → -${change.toDiscount}%`],
    "discount-reduced": ["warning", `Smaller -${change.fromDiscount}% → -${change.toDiscount}%`],
    "price-drop": ["success", `Price ${change.fromPrice} → ${change.toPrice}`],
    "price-rise": ["neutral", `Price ${change.fromPrice} → ${change.toPrice}`],
  };
  const [tone, text] = map[change.kind];

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>{text}</Badge>
      {change.since && <span className="text-[11px] text-zinc-600">was {relative(change.since)}</span>}
    </span>
  );
}

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
export function GameRegionRow({
  region,
  platform = "steam",
  change = null,
}: {
  region: GameRegionRowData;
  platform?: Platform;
  change?: PriceChange | null;
}) {
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
      const fetched = await getGameRegionReport(region.id, platform);
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
        <Td>
          <ChangeCell change={change} />
        </Td>
        <Td align="right">
          {/* Row's onClick would also fire on this click; stop it from toggling the row too. */}
          <span onClick={(e) => e.stopPropagation()}>
            <DeleteRegionButton id={region.id} label={label} platform={platform} />
          </span>
        </Td>
      </Tr>

      {expanded && (
        <tr className="border-t border-zinc-800/80 bg-zinc-950/40">
          <td colSpan={8} className="p-4">
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
