/**
 * The PlayStation counterpart to src/lib/steam/regional-prices.ts: given
 * one game, fetch its Store price in every region worth checking, convert
 * them into a single comparison currency, and pick the cheapest — the
 * exact input the gift-card pricing engine (src/lib/pricing/engine.ts)
 * expects.
 *
 * PlayStation ties a game's regional SKUs together with a region-independent
 * *concept id* (e.g. 10006560). `metGetPricingDataByConceptId` + the
 * `x-psn-store-locale-override` header then returns that concept's price in
 * whichever region you ask for.
 */

import { psnGraphql } from "@/lib/psstore/client";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { convertAmount, getExchangeRates } from "@/lib/currency/fx";
import { PSN_PRICE_REGIONS, psnPriceDivisor, type PsnRegion } from "@/lib/psn/regions";

interface ConceptPriceResponse {
  conceptRetrieve?: {
    id?: string;
    defaultProduct?: {
      price?: {
        basePrice?: string | null;
        basePriceValue?: number | null;
        discountedPrice?: string | null;
        discountedValue?: number | null;
        currencyCode?: string | null;
        discountText?: string | null;
        isFree?: boolean;
      } | null;
    } | null;
  } | null;
}

interface ProductByIdResponse {
  productRetrieve?: {
    id?: string;
    name?: string;
    concept?: { id?: string } | null;
    media?: { role?: string; type?: string; url?: string }[];
  } | null;
}

export interface PsnRegionalPrice {
  countryCode: string;
  locale: string;
  label: string;
  available: boolean;
  isFree: boolean;
  currency: string | null;
  original: number | null;
  final: number | null;
  discountPercent: number;
  discountText: string | null;
  /** original / final converted into the report's comparisonCurrency. Null when not comparable. */
  convertedOriginal: number | null;
  convertedFinal: number | null;
}

export interface PsnRegionalPriceReport {
  conceptId: string;
  name: string | null;
  imageUrl: string | null;
  storeUrl: string;
  comparisonCurrency: string;
  prices: PsnRegionalPrice[];
  /** Lowest convertedFinal among available, non-free regions. */
  cheapest: PsnRegionalPrice | null;
}

/**
 * Resolves a Store product id (e.g. "EP3969-PPSA11386_00-007FIRSTLIGHT000")
 * to its concept id. Returns null if PlayStation has no such product.
 */
export async function resolvePsConceptId(productId: string): Promise<string | null> {
  const data = await psnGraphql<ProductByIdResponse>(
    "metGetProductById",
    { productId },
    "en-us",
    { revalidate: 3600 },
  );
  return data.productRetrieve?.concept?.id ?? null;
}

async function priceForRegion(
  conceptId: string,
  region: PsnRegion,
  comparisonCurrency: string,
  rates: Record<string, number>,
  fxBase: string,
  noStore: boolean,
): Promise<PsnRegionalPrice> {
  const base: PsnRegionalPrice = {
    countryCode: region.countryCode,
    locale: region.locale,
    label: region.label,
    available: false,
    isFree: false,
    currency: null,
    original: null,
    final: null,
    discountPercent: 0,
    discountText: null,
    convertedOriginal: null,
    convertedFinal: null,
  };

  let price: NonNullable<
    NonNullable<ConceptPriceResponse["conceptRetrieve"]>["defaultProduct"]
  >["price"];
  try {
    const data = await psnGraphql<ConceptPriceResponse>(
      "metGetPricingDataByConceptId",
      { conceptId },
      region.locale,
      { noStore, revalidate: 300 },
    );
    price = data.conceptRetrieve?.defaultProduct?.price ?? null;
  } catch {
    return base; // region unavailable / transient — leave it as "not available"
  }

  if (!price || price.basePriceValue == null || !price.currencyCode) return base;

  const currency = price.currencyCode;
  const divisor = psnPriceDivisor(price.basePrice, price.basePriceValue);
  const original = price.basePriceValue / divisor;
  const final = (price.discountedValue ?? price.basePriceValue) / divisor;
  const isFree = !!price.isFree || final === 0;
  const discountPercent =
    original > 0 && final < original ? Math.round((1 - final / original) * 100) : 0;

  const comparable = !isFree && original > 0;
  return {
    ...base,
    available: true,
    isFree,
    currency,
    original,
    final,
    discountPercent,
    discountText: price.discountText ?? null,
    convertedOriginal: comparable
      ? convertAmount(original, currency, comparisonCurrency, rates, fxBase)
      : null,
    convertedFinal: comparable
      ? convertAmount(final, currency, comparisonCurrency, rates, fxBase)
      : null,
  };
}

export async function getConceptRegionalPrices(opts: {
  conceptId: string;
  name?: string | null;
  imageUrl?: string | null;
  comparisonCurrency?: string;
  regions?: PsnRegion[];
  noStore?: boolean;
}): Promise<PsnRegionalPriceReport> {
  const {
    conceptId,
    name = null,
    imageUrl = null,
    comparisonCurrency = "EGP",
    regions = PSN_PRICE_REGIONS,
    noStore = false,
  } = opts;

  const fxBase = "USD";
  const rates = await getExchangeRates(fxBase);

  const prices = await mapWithConcurrency(regions, 5, (region) =>
    priceForRegion(conceptId, region, comparisonCurrency, rates, fxBase, noStore),
  );

  const cheapest =
    prices
      .filter((p): p is PsnRegionalPrice & { convertedFinal: number } => p.convertedFinal !== null)
      .sort((a, b) => a.convertedFinal - b.convertedFinal)[0] ?? null;

  return {
    conceptId,
    name,
    imageUrl,
    storeUrl: `https://store.playstation.com/en-us/concept/${conceptId}`,
    comparisonCurrency,
    prices,
    cheapest,
  };
}
