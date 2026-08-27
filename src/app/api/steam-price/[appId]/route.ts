import { NextResponse } from "next/server";
import { DEFAULT_STEAM_REGIONS, getRegionalPrices } from "@/lib/steam/regional-prices";

export const maxDuration = 60;

/**
 * GET /api/steam-price/{appId}?countries=us,gb,de&currency=EGP
 *
 * Public, no login required — this only reads Steam's own public prices
 * and free FX rates, nothing account-specific or costly.
 *
 * The "one game -> cheapest region" flow: fetches this app's Steam price
 * in every requested country (default: DEFAULT_STEAM_REGIONS), converts
 * them all into one comparison currency, and returns the cheapest —
 * ready to hand to the gift-card pricing engine.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const { appId: appIdParam } = await params;
  const appId = Number(appIdParam);
  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json({ error: "Invalid Steam app id." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const countriesParam = searchParams.get("countries");
  const countries = countriesParam
    ? countriesParam
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
    : DEFAULT_STEAM_REGIONS;
  const currency = (searchParams.get("currency") ?? "EGP").toUpperCase();

  try {
    const report = await getRegionalPrices(appId, countries, currency);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
