"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/input";
import { PSN_REGIONS, PSN_DEFAULT_REGION } from "@/lib/psstore/client";
import {
  PSN_CATEGORIES,
  PSN_DEFAULT_CATEGORY,
  PSN_DEFAULT_SORT,
  PSN_PAGE_SIZE,
  PSN_SORTS,
  type PsnCatalogPage,
  type PsnProduct,
  type PsnSearchResult,
} from "@/lib/psstore/catalog";

type Result = PsnCatalogPage | PsnSearchResult;

function isSearchResult(r: Result | null): r is PsnSearchResult {
  return !!r && "mode" in r && r.mode === "search";
}

// Everything on this page is served by GET /api/psstore, which proxies
// PlayStation's public storefront GraphQL. No login, no database — it's
// the read-only counterpart to /prices for the PlayStation Store.
//
// PlayStation has no free-text search query we can call, so "search" is
// server-side: /api/psstore?search= scans the selected category A–Z and
// substring-matches. That's why search runs *within* a category + region.
export default function PsStorePage() {
  const [category, setCategory] = useState(PSN_DEFAULT_CATEGORY);
  const [region, setRegion] = useState(PSN_DEFAULT_REGION);
  const [sort, setSort] = useState(PSN_DEFAULT_SORT);
  const [offset, setOffset] = useState(0);
  // Bumped by Refresh — while > 0 the fetch skips the server cache
  // (&refresh=1); any filter or search change resets it to 0.
  const [refreshNonce, setRefreshNonce] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState(""); // "" = browse mode

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searching = activeSearch.length > 0;

  // One effect drives both modes. Aborted on cleanup so a slow response
  // for stale filters can't land after a newer one.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({ category, region });
        if (activeSearch) {
          params.set("search", activeSearch);
        } else {
          params.set("sort", sort);
          params.set("offset", String(offset));
          params.set("size", String(PSN_PAGE_SIZE));
        }
        if (refreshNonce > 0) {
          params.set("refresh", "1");
          params.set("_", String(refreshNonce));
        }
        const res = await fetch(`/api/psstore?${params}`, { signal: controller.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load from the PlayStation Store.");
        setResult(body as Result);
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setResult(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [category, region, sort, offset, refreshNonce, activeSearch]);

  function onFilterChange<T>(setter: (v: T) => void) {
    return (value: T) => {
      setLoading(true);
      setError(null);
      setOffset(0);
      setRefreshNonce(0);
      setter(value);
    };
  }

  function goToOffset(next: number) {
    setLoading(true);
    setError(null);
    setOffset(next);
  }

  function refresh() {
    setLoading(true);
    setError(null);
    setRefreshNonce((n) => n + 1);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = searchInput.trim();
    if (term.length < 2 || term === activeSearch) return;
    setLoading(true);
    setError(null);
    setOffset(0);
    setRefreshNonce(0);
    setActiveSearch(term);
  }

  function clearSearch() {
    if (!activeSearch && !searchInput) return;
    setLoading(true);
    setError(null);
    setSearchInput("");
    setActiveSearch("");
  }

  const browse = !isSearchResult(result) ? result : null;
  const search = isSearchResult(result) ? result : null;
  const from = browse ? browse.offset + 1 : 0;
  const to = browse ? browse.offset + browse.products.length : 0;
  const categoryLabel = PSN_CATEGORIES.find((c) => c.id === category)?.label ?? "category";

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <PageHeader
        title="PlayStation Store"
        description="Search or browse PlayStation's storefront by region, straight from its public catalog API."
      />

      <form onSubmit={submitSearch} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            strokeWidth={1.75}
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${categoryLabel} by title — e.g. God of War`}
            className={`${inputClass} pl-9`}
          />
          {(searchInput || activeSearch) && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || searchInput.trim().length < 2}
          className={buttonClass("primary", "md")}
        >
          {loading && searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Category{searching ? " (search scope)" : ""}</span>
          <select
            value={category}
            onChange={(e) => onFilterChange(setCategory)(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {PSN_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Region</span>
          <select
            value={region}
            onChange={(e) => onFilterChange(setRegion)(e.target.value)}
            className={`${inputClass} mt-1`}
          >
            {PSN_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelClass}>Sort</span>
          <select
            value={sort}
            disabled={searching}
            onChange={(e) => onFilterChange(setSort)(e.target.value)}
            className={`${inputClass} mt-1 disabled:opacity-40`}
          >
            {PSN_SORTS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex min-h-8 items-center gap-3 text-xs text-zinc-500">
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {loading && searching && (
          <span>Scanning the whole {categoryLabel} catalog — the first search takes ~10s, then it&apos;s instant for 10 min.</span>
        )}
        {search && !loading && (
          <span className="tabular-nums">
            {search.matchCount.toLocaleString()} match{search.matchCount === 1 ? "" : "es"} for{" "}
            <span className="text-zinc-300">“{search.term}”</span> in {categoryLabel}
            {search.matchCount > search.products.length && ` (showing first ${search.products.length})`}
          </span>
        )}
        {browse && !loading && (
          <span className="tabular-nums">
            Showing {from}–{to} of {browse.totalCount.toLocaleString()}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          className={buttonClass("secondary", "sm", "ml-auto")}
          title="Bypass the cache and pull fresh from PlayStation"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {result && !loading && (
        <p className="mt-1 text-[11px] text-zinc-600">
          {search
            ? `Searched ${search.scannedCount.toLocaleString()}${
                search.scannedCount < search.categoryTotal
                  ? ` of ${search.categoryTotal.toLocaleString()}`
                  : ""
              } ${categoryLabel} titles in ${regionLabel(region)}. Not seeing it? Try another category.`
            : `Prices in ${regionLabel(region)}; loaded ${new Date(
                result.fetchedAt,
              ).toLocaleTimeString()}${refreshNonce > 0 ? " (live)" : " — cached up to 30s"}.`}
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {result && result.products.length === 0 && !loading && (
        <p className="mt-10 text-center text-sm text-zinc-500">
          {search
            ? `No ${categoryLabel} title matching “${search.term}”. Try a different category or spelling.`
            : `Nothing in this shelf for ${regionLabel(region)}.`}
        </p>
      )}

      <ul className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {result?.products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      {browse && (browse.offset > 0 || !browse.isLast) && (
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => goToOffset(Math.max(0, offset - PSN_PAGE_SIZE))}
            disabled={loading || browse.offset === 0}
            className={buttonClass("secondary", "sm")}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            onClick={() => goToOffset(offset + PSN_PAGE_SIZE)}
            disabled={loading || browse.isLast}
            className={buttonClass("secondary", "sm")}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function regionLabel(code: string): string {
  return PSN_REGIONS.find((r) => r.code === code)?.label ?? code;
}

function ProductCard({ product }: { product: PsnProduct }) {
  return (
    <a href={product.storeUrl} target="_blank" rel="noreferrer" className="group block">
      <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-zinc-700">
        <div className="relative aspect-[3/4] bg-zinc-800">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
              No image
            </div>
          )}
          {product.isOnSale && (
            <span className="absolute left-2 top-2">
              <Badge tone="success">{product.discountText?.trim() || "On sale"}</Badge>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h2 className="line-clamp-2 text-sm font-medium text-zinc-100">{product.name}</h2>

          <div className="mt-1 flex flex-wrap gap-1">
            {product.platforms.map((p) => (
              <Badge key={p} tone="neutral">
                {p}
              </Badge>
            ))}
            {product.classification && (
              <Badge tone="neutral">{product.classification}</Badge>
            )}
          </div>

          <div className="mt-auto pt-2 tabular-nums">
            {product.isFree ? (
              <Badge tone="accent">Free</Badge>
            ) : product.discountedPrice ? (
              <div className="flex items-baseline gap-2">
                {product.isOnSale && product.basePrice && (
                  <span className="text-xs text-zinc-500 line-through">{product.basePrice}</span>
                )}
                <span className="text-sm font-semibold text-zinc-50">
                  {product.discountedPrice}
                </span>
              </div>
            ) : (
              <span className="text-xs text-zinc-500">Price unavailable</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500 transition-colors group-hover:text-indigo-400">
          View on PlayStation Store
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </Card>
    </a>
  );
}
