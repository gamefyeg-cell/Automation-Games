/**
 * Catalog browsing on top of the persisted `categoryGridRetrieve`
 * operation — the same call `PlaystationStoreApi\Request\RequestProductList`
 * makes. Given a category (a fixed UUID PlayStation assigns each shelf),
 * a region, a sort and a page, it returns a normalized slice of the store
 * grid: cover art, base vs. discounted price, and a link straight to the
 * product page.
 */

import { psnGraphql } from "./client";

// Category UUIDs, from `PlaystationStoreApi\Enum\CategoryEnum`. These are
// stable — PlayStation keys its store shelves by these ids, not by name.
export const PSN_CATEGORIES: { id: string; label: string }[] = [
  { id: "4cbf39e2-5749-4970-ba81-93a489e4570c", label: "PS5 Games" },
  { id: "44d8bb20-653e-431e-8ad0-c0a365f68d2f", label: "PS4 Games" },
  { id: "803cee19-e5a1-4d59-a463-0b6b2701bf7c", label: "Deals" },
  { id: "16b8d09a-d0e3-44e3-96cb-a3b2a21b6d69", label: "Offers" },
  { id: "d9930400-c5c7-4a06-a28d-cc74888426dc", label: "Free to Play" },
  { id: "74d4e266-5c64-4c61-a7e3-1b6e78f643e6", label: "EA Games" },
  { id: "62c2a3b6-41cf-4808-ba48-1e5581eeea35", label: "PS VR2" },
  { id: "038b4df3-bb4c-48f8-8290-3feb35f0f0fd", label: "PS Plus" },
];

export const PSN_DEFAULT_CATEGORY = PSN_CATEGORIES[0].id;

// Sort keys accepted by `sortBy.name`, from `CatalogSortingEnum`.
export const PSN_SORTS: { name: string; label: string; isAscending: boolean }[] = [
  { name: "productReleaseDate", label: "Newest", isAscending: false },
  { name: "sales30", label: "Best selling", isAscending: false },
  { name: "downloads30", label: "Most downloaded", isAscending: false },
  { name: "webBasePrice", label: "Price: low to high", isAscending: true },
  { name: "productName", label: "Name: A to Z", isAscending: true },
];

export const PSN_DEFAULT_SORT = PSN_SORTS[0].name;

export const PSN_PAGE_SIZE = 24;
export const PSN_MAX_PAGE_SIZE = 48;

// PlayStation has no whitelisted free-text search query (the store computes
// that persisted-query hash in the browser and won't accept ours). So
// "search" pulls the *whole* selected category — sorted A–Z, in 1000-row
// pages fetched concurrently (`categoryGridRetrieve`'s max) — and
// substring-matches locally. The first search in a category/region takes
// ~10–15s to pull ~10k rows; every search after that is a Map lookup for
// 10 minutes (see chunkCache). SCAN_HARD_CAP just bounds a pathological
// category so we never fire hundreds of requests.
export const PSN_SCAN_CHUNK = 1000;
export const PSN_SCAN_HARD_CAP = 20000;
export const PSN_SEARCH_LIMIT = 60;
const CHUNK_TTL_MS = 10 * 60_000;

export interface PsnProduct {
  id: string;
  name: string;
  platforms: string[];
  classification: string | null;
  imageUrl: string | null;
  basePrice: string | null;
  discountedPrice: string | null;
  discountText: string | null;
  isFree: boolean;
  isOnSale: boolean;
  storeUrl: string;
}

export interface PsnCatalogPage {
  region: string;
  categoryId: string;
  sort: string;
  products: PsnProduct[];
  totalCount: number;
  offset: number;
  size: number;
  isLast: boolean;
  /** ISO timestamp this slice was assembled server-side. */
  fetchedAt: string;
}

export interface PsnSearchResult {
  mode: "search";
  term: string;
  region: string;
  categoryId: string;
  products: PsnProduct[];
  /** Total substring matches found (may exceed `products.length`, which is capped). */
  matchCount: number;
  /** How many titles were actually scanned. */
  scannedCount: number;
  /** Size of the whole category, so the UI can say "scanned N of M". */
  categoryTotal: number;
  fetchedAt: string;
}

interface RawMedia {
  role?: string;
  type?: string;
  url?: string;
}

interface RawProduct {
  id: string;
  name?: string;
  platforms?: string[];
  localizedStoreDisplayClassification?: string | null;
  media?: RawMedia[];
  price?: {
    basePrice?: string | null;
    discountedPrice?: string | null;
    discountText?: string | null;
    isFree?: boolean;
  } | null;
}

interface CategoryGridResponse {
  categoryGridRetrieve?: {
    products?: RawProduct[] | null;
    pageInfo?: {
      offset?: number;
      size?: number;
      totalCount?: number;
      isLast?: boolean;
    } | null;
  } | null;
}

// Cover art comes in ~10 flavors per product; prefer the ones that read
// well as a portrait-ish grid tile, fall back to whatever image exists.
const IMAGE_ROLE_PREFERENCE = [
  "GAMEHUB_COVER_ART",
  "MASTER",
  "EDITION_KEY_ART",
  "PORTRAIT_BANNER",
  "FOUR_BY_THREE_BANNER",
  "BACKGROUND",
];

function pickImage(media: RawMedia[] | undefined): string | null {
  if (!media?.length) return null;
  const images = media.filter((m) => m.type === "IMAGE" && m.url);
  if (!images.length) return null;
  for (const role of IMAGE_ROLE_PREFERENCE) {
    const hit = images.find((m) => m.role === role);
    if (hit?.url) return hit.url;
  }
  return images[0].url ?? null;
}

function normalizeProduct(raw: RawProduct, region: string): PsnProduct {
  const price = raw.price ?? {};
  const basePrice = price.basePrice ?? null;
  const discountedPrice = price.discountedPrice ?? null;
  const isOnSale =
    !!basePrice && !!discountedPrice && basePrice !== discountedPrice && !price.isFree;

  return {
    id: raw.id,
    name: raw.name ?? "Untitled",
    platforms: raw.platforms ?? [],
    classification: raw.localizedStoreDisplayClassification ?? null,
    imageUrl: pickImage(raw.media),
    basePrice,
    discountedPrice,
    discountText: price.discountText ?? null,
    isFree: !!price.isFree,
    isOnSale,
    storeUrl: `https://store.playstation.com/${region}/product/${raw.id}`,
  };
}

interface GridChunk {
  products: RawProduct[];
  offset: number;
  size: number;
  totalCount: number;
  isLast: boolean;
}

async function fetchGridChunk(opts: {
  categoryId: string;
  region: string;
  size: number;
  offset: number;
  sortName: string;
  isAscending: boolean;
  noStore: boolean;
  revalidate?: number;
}): Promise<GridChunk> {
  const { categoryId, region, size, offset, sortName, isAscending, noStore, revalidate } = opts;

  const data = await psnGraphql<CategoryGridResponse>(
    "categoryGridRetrieve",
    {
      id: categoryId,
      pageArgs: { size, offset },
      sortBy: { name: sortName, isAscending },
      filterBy: [],
      facetOptions: [],
    },
    region,
    { noStore, revalidate },
  );

  const grid = data.categoryGridRetrieve;
  if (!grid) {
    throw new Error(`PlayStation Store returned an empty grid for category ${categoryId}.`);
  }

  const products = grid.products ?? [];
  const pageInfo = grid.pageInfo ?? {};
  return {
    products,
    offset: pageInfo.offset ?? offset,
    size: pageInfo.size ?? size,
    totalCount: pageInfo.totalCount ?? products.length,
    isLast: pageInfo.isLast ?? products.length < size,
  };
}

export async function fetchPsnCatalog(opts: {
  categoryId: string;
  region: string;
  size?: number;
  offset?: number;
  sortName?: string;
  isAscending?: boolean;
  noStore?: boolean;
}): Promise<PsnCatalogPage> {
  const {
    categoryId,
    region,
    size = PSN_PAGE_SIZE,
    offset = 0,
    sortName = PSN_DEFAULT_SORT,
    isAscending = false,
    noStore = false,
  } = opts;

  const chunk = await fetchGridChunk({
    categoryId,
    region,
    size,
    offset,
    sortName,
    isAscending,
    noStore,
  });

  return {
    region,
    categoryId,
    sort: sortName,
    products: chunk.products.map((p) => normalizeProduct(p, region)),
    totalCount: chunk.totalCount,
    offset: chunk.offset,
    size: chunk.size,
    isLast: chunk.isLast,
    fetchedAt: new Date().toISOString(),
  };
}

/** startsWith > word-start > substring; ties broken by shorter (closer) name. */
function scoreMatch(name: string, term: string): number | null {
  const n = name.toLowerCase();
  const i = n.indexOf(term);
  if (i === -1) return null;
  if (i === 0) return 0 + n.length / 1000;
  if (/\s|:|-/.test(n[i - 1] ?? "")) return 1 + n.length / 1000;
  return 2 + n.length / 1000;
}

interface ScanChunk {
  products: RawProduct[];
  totalCount: number;
  expires: number;
}

// The A–Z scan pages are identical for every search term in a given
// category + region — so memoize them here rather than leaning on Next's
// fetch cache (which doesn't kick in for these route-handler calls). Only
// the first search in a category/region pays the network cost; the rest
// are a Map lookup for 10 minutes.
const chunkCache = new Map<string, ScanChunk>();

async function getScanChunk(
  categoryId: string,
  region: string,
  offset: number,
  noStore: boolean,
): Promise<ScanChunk> {
  const key = `${categoryId}|${region}|${offset}`;
  const hit = chunkCache.get(key);
  if (!noStore && hit && hit.expires > Date.now()) return hit;

  const chunk = await fetchGridChunk({
    categoryId,
    region,
    size: PSN_SCAN_CHUNK,
    offset,
    sortName: "productName",
    isAscending: true,
    noStore,
    revalidate: CHUNK_TTL_MS / 1000,
  });
  const entry: ScanChunk = {
    products: chunk.products,
    totalCount: chunk.totalCount,
    expires: Date.now() + CHUNK_TTL_MS,
  };
  chunkCache.set(key, entry);
  if (chunkCache.size > 80) chunkCache.delete(chunkCache.keys().next().value!);
  return entry;
}

export async function searchPsnCatalog(opts: {
  term: string;
  categoryId: string;
  region: string;
  noStore?: boolean;
}): Promise<PsnSearchResult> {
  const term = opts.term.trim().toLowerCase();
  const { categoryId, region, noStore = false } = opts;

  const first = await getScanChunk(categoryId, region, 0, noStore);

  const scanTarget = Math.min(first.totalCount, PSN_SCAN_HARD_CAP);
  const restOffsets: number[] = [];
  for (let o = PSN_SCAN_CHUNK; o < scanTarget; o += PSN_SCAN_CHUNK) restOffsets.push(o);

  const rest = await Promise.all(
    restOffsets.map((offset) => getScanChunk(categoryId, region, offset, noStore)),
  );

  const raw = [first, ...rest].flatMap((c) => c.products);

  const ranked = raw
    .map((p) => ({ p, score: scoreMatch(p.name ?? "", term) }))
    .filter((x): x is { p: RawProduct; score: number } => x.score !== null)
    .sort((a, b) => a.score - b.score);

  return {
    mode: "search",
    term: opts.term.trim(),
    region,
    categoryId,
    products: ranked.slice(0, PSN_SEARCH_LIMIT).map((x) => normalizeProduct(x.p, region)),
    matchCount: ranked.length,
    scannedCount: raw.length,
    categoryTotal: first.totalCount,
    fetchedAt: new Date().toISOString(),
  };
}
