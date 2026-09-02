import { NextResponse } from "next/server";
import { getConceptRegionalPrices, resolvePsConceptId } from "@/lib/psn/pricing";

/**
 * GET /api/ps/price?productId=<store product id>&currency=EGP
 *
 * Step 2: resolve the picked product to its region-independent concept id,
 * then fetch its PlayStation Store price in every comparison region and
 * rank them. Public, read-only — saving a region (which writes to the DB)
 * is the separate "Choose this region" server action on /ps/prices.
 *
 * `&refresh=1` bypasses the short server cache.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();
  const conceptIdParam = searchParams.get("conceptId")?.trim();
  const currency = (searchParams.get("currency")?.trim() || "EGP").toUpperCase();
  const name = searchParams.get("name");
  const imageUrl = searchParams.get("imageUrl");
  const noStore = searchParams.get("refresh") === "1";

  if (!productId && !conceptIdParam) {
    return NextResponse.json({ error: "Missing ?productId= or ?conceptId=" }, { status: 400 });
  }

  try {
    const conceptId = conceptIdParam ?? (await resolvePsConceptId(productId!));
    if (!conceptId) {
      return NextResponse.json(
        { error: "PlayStation has no concept for that product." },
        { status: 404 },
      );
    }

    const report = await getConceptRegionalPrices({
      conceptId,
      name,
      imageUrl,
      comparisonCurrency: currency,
      noStore,
    });
    return NextResponse.json(report, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
