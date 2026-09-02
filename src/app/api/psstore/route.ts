import { NextResponse } from "next/server";
import { PSN_DEFAULT_REGION, isKnownRegion } from "@/lib/psstore/client";
import {
  fetchPsnCatalog,
  searchPsnCatalog,
  PSN_CATEGORIES,
  PSN_DEFAULT_CATEGORY,
  PSN_DEFAULT_SORT,
  PSN_MAX_PAGE_SIZE,
  PSN_PAGE_SIZE,
  PSN_SORTS,
} from "@/lib/psstore/catalog";

/**
 * GET /api/psstore?category=<uuid>&region=en-us&sort=productReleaseDate&offset=0&size=24
 * GET /api/psstore?category=<uuid>&region=en-us&search=god+of+war
 *
 * Public, no login — this only reads PlayStation's own public storefront
 * grid. The browser can't call web.np.playstation.com directly (CORS), so
 * this route is the proxy the /psstore page talks to.
 *
 * `&search=` switches to search mode: PlayStation exposes no usable
 * free-text query, so this scans the chosen category A–Z and
 * substring-matches server-side. `&refresh=1` bypasses the cache.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const category = searchParams.get("category") ?? PSN_DEFAULT_CATEGORY;
  if (!PSN_CATEGORIES.some((c) => c.id === category)) {
    return NextResponse.json({ error: `Unknown category "${category}".` }, { status: 400 });
  }

  const region = searchParams.get("region") ?? PSN_DEFAULT_REGION;
  if (!isKnownRegion(region)) {
    return NextResponse.json({ error: `Unknown region "${region}".` }, { status: 400 });
  }

  const noStore = searchParams.get("refresh") === "1";
  const search = searchParams.get("search")?.trim();

  if (search) {
    if (search.length < 2) {
      return NextResponse.json(
        { error: "Type at least 2 characters to search." },
        { status: 400 },
      );
    }
    try {
      const result = await searchPsnCatalog({ term: search, categoryId: category, region, noStore });
      return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
  }

  const sortName = searchParams.get("sort") ?? PSN_DEFAULT_SORT;
  const sort = PSN_SORTS.find((s) => s.name === sortName);
  if (!sort) {
    return NextResponse.json({ error: `Unknown sort "${sortName}".` }, { status: 400 });
  }

  const size = clampInt(searchParams.get("size"), PSN_PAGE_SIZE, 1, PSN_MAX_PAGE_SIZE);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 100_000);

  try {
    const page = await fetchPsnCatalog({
      categoryId: category,
      region,
      size,
      offset,
      sortName: sort.name,
      isAscending: sort.isAscending,
      noStore,
    });
    return NextResponse.json(page, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}
