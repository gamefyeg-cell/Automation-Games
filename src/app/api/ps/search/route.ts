import { NextResponse } from "next/server";
import { searchPsnCatalog, PSN_CATEGORIES } from "@/lib/psstore/catalog";

const PS5_GAMES = PSN_CATEGORIES[0].id;
const PS4_GAMES = PSN_CATEGORIES[1].id;

/**
 * GET /api/ps/search?q=god+of+war
 *
 * Step 1 of "pick a game -> find its cheapest PlayStation region". Public,
 * read-only. PlayStation exposes no usable free-text search query, so this
 * scans the PS5 + PS4 game catalogs A–Z and substring-matches (the same
 * mechanism as /api/psstore?search=). The first call in a while takes
 * ~15-20s per catalog; after that it's cached for 10 minutes.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Type at least 2 characters." }, { status: 400 });
  }

  try {
    const [ps5, ps4] = await Promise.all([
      searchPsnCatalog({ term: q, categoryId: PS5_GAMES, region: "en-us" }),
      searchPsnCatalog({ term: q, categoryId: PS4_GAMES, region: "en-us" }),
    ]);

    // Merge, de-dupe by product id, keep PS5 ordering first.
    const seen = new Set<string>();
    const results = [...ps5.products, ...ps4.products]
      .filter((p) => (seen.has(p.id) ? false : seen.add(p.id)))
      .slice(0, 40)
      .map((p) => ({
        productId: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        platforms: p.platforms,
        basePrice: p.basePrice,
        discountedPrice: p.discountedPrice,
      }));

    return NextResponse.json(
      { results, matchCount: ps5.matchCount + ps4.matchCount },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
