"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, Loader2, Search as SearchIcon, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { SaveReportCard } from "@/app/prices/report-card";
import type { SaveRegionResult } from "@/app/prices/actions";
import { savePsGameRegionAndReport } from "./actions";

interface SearchResult {
  productId: string;
  name: string;
  imageUrl: string | null;
  platforms: string[];
  basePrice: string | null;
  discountedPrice: string | null;
}

interface GiftCardSummary {
  id: string;
  provider: string;
  productName: string;
  value: number;
  valueCurrency: string;
  quantity: number;
  lineCost: number;
}

interface RegionalPrice {
  countryCode: string;
  label: string;
  available: boolean;
  isFree: boolean;
  currency: string | null;
  original: number | null;
  final: number | null;
  discountPercent: number;
  discountText: string | null;
  convertedOriginal: number | null;
  convertedFinal: number | null;
  giftCardCost?: number | null;
  giftCardValue?: number | null;
  giftCardCards?: GiftCardSummary[];
  hasGiftCards?: boolean;
}

interface RegionalPriceReport {
  conceptId: string;
  name: string | null;
  imageUrl: string | null;
  storeUrl: string;
  comparisonCurrency: string;
  prices: RegionalPrice[];
  cheapest: RegionalPrice | null;
  editionRatio?: number;
}

// Public, read-only — this reads PlayStation's own public Store prices.
// Choosing a region (which writes to the database) needs the admin
// password, exactly like Steam Prices — see ./actions.ts.
export default function PsPricesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [report, setReport] = useState<RegionalPriceReport | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savingCountry, setSavingCountry] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveRegionResult | null>(null);
  // Per-game override for the minimum profit; blank = use Pricing Settings.
  const [profitTarget, setProfitTarget] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setReport(null);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/ps/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed.");
      setResults(body.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  }

  async function handlePick(r: SearchResult) {
    setLoadingPrices(true);
    setError(null);
    setReport(null);
    setSaveResult(null);
    setProfitTarget("");
    try {
      const selectedPrice = r.discountedPrice || r.basePrice || "";
      const params = new URLSearchParams({
        productId: r.productId,
        currency: "EGP",
        name: r.name,
      });
      if (r.imageUrl) params.set("imageUrl", r.imageUrl);
      if (selectedPrice) params.set("selectedPrice", selectedPrice);
      const res = await fetch(`/api/ps/price?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Price lookup failed.");
      setReport(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPrices(false);
    }
  }

  async function handleChooseRegion(countryCode: string) {
    if (!report) return;

    let override: number | undefined;
    if (profitTarget.trim() !== "") {
      override = Number(profitTarget);
      if (!Number.isFinite(override) || override < 0) {
        setSaveResult({ ok: false, message: "Enter a valid profit amount (or leave it blank)." });
        return;
      }
    }

    setSavingCountry(countryCode);
    setSaveResult(null);
    try {
      const result = await savePsGameRegionAndReport(
        { conceptId: report.conceptId, name: report.name ?? "Unknown game", imageUrl: report.imageUrl },
        countryCode,
        override,
        report.editionRatio,
      );
      setSaveResult(result);
    } finally {
      setSavingCountry(null);
    }
  }

  const sortedPrices = report?.prices
    .slice()
    .sort((a, b) => {
      const aCost = a.available && !a.isFree ? (a.giftCardCost ?? null) : null;
      const bCost = b.available && !b.isFree ? (b.giftCardCost ?? null) : null;

      // 1. Both have gift card calculations: rank by lowest gift card cost
      if (aCost !== null && bCost !== null) {
        return aCost - bCost;
      }
      // 2. Region with active gift cards comes before region without
      if (aCost !== null) return -1;
      if (bCost !== null) return 1;

      // 3. Fall back to converted store price
      const aFinal = a.available && !a.isFree ? (a.convertedFinal ?? null) : null;
      const bFinal = b.available && !b.isFree ? (b.convertedFinal ?? null) : null;
      if (aFinal !== null && bFinal !== null) {
        return aFinal - bFinal;
      }
      if (aFinal !== null) return -1;
      if (bFinal !== null) return 1;

      return a.label.localeCompare(b.label);
    });

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <PageHeader
        title="PlayStation Prices"
        description="Search a game, pick the right one, compare every region's PlayStation Store price, choose one, save it."
      />

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. God of War"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button type="submit" disabled={searching} className={buttonClass("primary", "md")}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      {searching && (
        <p className="mt-3 text-xs text-zinc-500">
          Scanning the PS5 &amp; PS4 catalogs — the first search in a while takes ~15s, then it&apos;s
          fast for 10 minutes.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {results && !report && (
        <Card className="mt-6">
          <ul className="divide-y divide-zinc-800">
            {results.map((r) => (
              <li key={r.productId}>
                <button
                  onClick={() => handlePick(r)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
                >
                  {r.imageUrl ? (
                    <Image
                      src={r.imageUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded bg-zinc-800" />
                  )}
                  <span className="text-sm text-zinc-200">{r.name}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-2">
                    {r.platforms.map((p) => (
                      <Badge key={p} tone="neutral">
                        {p}
                      </Badge>
                    ))}
                    {r.discountedPrice && (
                      <span className="text-xs text-zinc-500">{r.discountedPrice}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-zinc-500">No matches.</li>
            )}
          </ul>
        </Card>
      )}

      {loadingPrices && (
        <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking every region — this takes a few seconds…
        </div>
      )}

      {report && (
        <div className="mt-6">
          <button
            onClick={() => {
              setReport(null);
              setSaveResult(null);
            }}
            className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to results
          </button>

          <h2 className="text-lg font-medium text-zinc-100">{report.name}</h2>

          {report.cheapest && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              <TrendingDown className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Cheapest: <strong className="font-semibold">{report.cheapest.label}</strong> —{" "}
              {report.cheapest.giftCardCost !== null && report.cheapest.giftCardCost !== undefined ? (
                <>
                  <span className="tabular-nums font-semibold">
                    {report.cheapest.giftCardCost} {report.comparisonCurrency}
                  </span>{" "}
                  <span className="text-emerald-400/80">
                    in gift cards (Store: {report.cheapest.final} {report.cheapest.currency})
                  </span>
                </>
              ) : (
                <>
                  <span className="tabular-nums">
                    {report.cheapest.convertedFinal} {report.comparisonCurrency}
                  </span>{" "}
                  <span className="text-emerald-400/70">
                    ({report.cheapest.final} {report.cheapest.currency})
                  </span>
                </>
              )}
            </div>
          )}

          {saveResult && <SaveReportCard saveResult={saveResult} />}

          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <label className="block">
              <span className={labelClass}>
                Profit you want on this game ({report.comparisonCurrency})
              </span>
              <input
                value={profitTarget}
                onChange={(e) => setProfitTarget(e.target.value)}
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="uses your default"
                className={`${inputClass} mt-1 w-52`}
              />
            </label>
            <p className="max-w-md text-xs text-zinc-500">
              Applied when you press <span className="text-zinc-300">Choose</span>. The sell price
              is set so profit is at least this — still never below your usual margin %. Leave blank
              to use Pricing Settings.
            </p>
          </div>

          <div className="mt-4">
            <Table>
              <Thead>
                <tr>
                  <Th>Region</Th>
                  <Th align="right">Before discount</Th>
                  <Th align="right">Now</Th>
                  <Th align="right">Discount</Th>
                  <Th align="right">Store in {report.comparisonCurrency}</Th>
                  <Th align="right">Gift Cards ({report.comparisonCurrency})</Th>
                  <Th align="right">Choose</Th>
                </tr>
              </Thead>
              <tbody>
                {sortedPrices?.map((p) => (
                  <Tr key={p.countryCode}>
                    <Td>
                      {p.label} <span className="text-zinc-600">({p.countryCode})</span>
                    </Td>
                    <Td align="right" muted>
                      {p.available ? (p.isFree ? "—" : `${p.original} ${p.currency}`) : "—"}
                    </Td>
                    <Td align="right">
                      {p.available ? (
                        p.isFree ? (
                          <Badge tone="accent">Free / PS Plus</Badge>
                        ) : (
                          `${p.final} ${p.currency}`
                        )
                      ) : (
                        <Badge tone="neutral">Unavailable</Badge>
                      )}
                    </Td>
                    <Td align="right">
                      {p.discountPercent > 0 ? (
                        <Badge tone="success">-{p.discountPercent}%</Badge>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </Td>
                    <Td align="right" muted>
                      {p.convertedFinal !== null ? p.convertedFinal : "—"}
                    </Td>
                    <Td align="right">
                      {p.giftCardCost !== null && p.giftCardCost !== undefined ? (
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-emerald-400">
                            {p.giftCardCost} {report.comparisonCurrency}
                          </span>
                          {p.giftCardCards && p.giftCardCards.length > 0 && (
                            <span className="text-[11px] text-zinc-400">
                              {p.giftCardCards
                                .map((c) => `${c.quantity}× ${c.value} ${c.valueCurrency}`)
                                .join(" + ")}
                            </span>
                          )}
                        </div>
                      ) : p.available && !p.isFree ? (
                        <span className="text-xs text-zinc-500">No matching cards</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td align="right">
                      {p.available && !p.isFree && (
                        <button
                          onClick={() => handleChooseRegion(p.countryCode)}
                          disabled={savingCountry !== null}
                          className={buttonClass("secondary", "sm", "disabled:opacity-50")}
                        >
                          {savingCountry === p.countryCode ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Choose"
                          )}
                        </button>
                      )}
                    </Td>
                  </Tr>
                ))}
                {sortedPrices?.length === 0 && <EmptyRow colSpan={7}>No regions checked.</EmptyRow>}
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {!results && !report && !loadingPrices && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          Search for a game above to get started.
        </p>
      )}
    </div>
  );
}
