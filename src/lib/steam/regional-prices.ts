import { getAppDetails } from "@/lib/steam/appdetails";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { convertAmount, getExchangeRates } from "@/lib/currency/fx";

/**
 * A reasonable default spread of regions worth checking — mixes the big
 * Western markets with the currency zones that are usually cheapest
 * (Turkey, Ukraine, India, Argentina-style markdowns).
 */
export const DEFAULT_STEAM_REGIONS = [
  "us",
  "gb",
  "de",
  "fr",
  "es",
  "it",
  "ca",
  "au",
  "jp",
  "cn",
  "br",
  "mx",
  "tr",
  "ua",
  "pl",
  "in",
  "eg",
];

export interface RegionalPrice {
  country: string;
  available: boolean;
  isFree: boolean;
  currency: string | null;
  original: number | null;
  final: number | null;
  discountPercent: number;
  /** original/final converted into the report's comparisonCurrency. Null when not comparable (unavailable/free). */
  convertedOriginal: number | null;
  convertedFinal: number | null;
}

export interface RegionalPriceReport {
  steamAppId: number;
  name: string | null;
  imageUrl: string | null;
  comparisonCurrency: string;
  prices: RegionalPrice[];
  /** The lowest convertedFinal among available, non-free regions. Null if none were comparable. */
  cheapest: RegionalPrice | null;
}

/**
 * The core "one game -> cheapest region" flow: fetches this app's Steam
 * price in every requested country, converts them all into
 * `comparisonCurrency`, and picks the cheapest. Feed `cheapest` straight
 * into the gift-card pricing engine (src/lib/pricing/engine.ts).
 */
export async function getRegionalPrices(
  steamAppId: number,
  countries: string[] = DEFAULT_STEAM_REGIONS,
  comparisonCurrency = "EGP",
): Promise<RegionalPriceReport> {
  const fxBase = "USD";
  const [details, rates] = await Promise.all([
    mapWithConcurrency(countries, 5, (cc) => getAppDetails(steamAppId, cc)),
    getExchangeRates(fxBase),
  ]);

  let name: string | null = null;
  let imageUrl: string | null = null;

  const prices: RegionalPrice[] = details.map((d) => {
    if (!name && d.name) name = d.name;
    if (!imageUrl && d.imageUrl) imageUrl = d.imageUrl;

    const comparable = d.available && !d.isFree && d.currency && d.currentPrice !== null;
    const convertedFinal = comparable
      ? convertAmount(d.currentPrice!, d.currency!, comparisonCurrency, rates, fxBase)
      : null;
    const convertedOriginal =
      comparable && d.originalPrice !== null
        ? convertAmount(d.originalPrice, d.currency!, comparisonCurrency, rates, fxBase)
        : null;

    return {
      country: d.countryCode.toUpperCase(),
      available: d.available,
      isFree: d.isFree,
      currency: d.currency,
      original: d.originalPrice,
      final: d.currentPrice,
      discountPercent: d.discountPercent,
      convertedOriginal,
      convertedFinal,
    };
  });

  const cheapest =
    prices
      .filter((p): p is RegionalPrice & { convertedFinal: number } => p.convertedFinal !== null)
      .sort((a, b) => a.convertedFinal - b.convertedFinal)[0] ?? null;

  return { steamAppId, name, imageUrl, comparisonCurrency, prices, cheapest };
}
