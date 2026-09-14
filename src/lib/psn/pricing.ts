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
import { createAdminClient } from "@/lib/supabase/admin";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";
import { giftCardMatchesRegion } from "@/lib/steam/regions";
import { findCheapestGiftCardCombination, type GiftCardOption } from "@/lib/pricing/engine";

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

export interface PsnGiftCardSummary {
  id: string;
  provider: string;
  productName: string;
  value: number;
  valueCurrency: string;
  quantity: number;
  lineCost: number;
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
  /** Lowest total cost in comparisonCurrency (e.g. EGP) to fund this price via active gift cards. Null if no combination covers it. */
  giftCardCost: number | null;
  giftCardValue: number | null;
  giftCardCards: PsnGiftCardSummary[];
  hasGiftCards: boolean;
}

export interface PsnRegionalPriceReport {
  conceptId: string;
  name: string | null;
  imageUrl: string | null;
  storeUrl: string;
  comparisonCurrency: string;
  prices: PsnRegionalPrice[];
  /** Lowest giftCardCost (or lowest convertedFinal if no gift cards) among available, non-free regions. */
  cheapest: PsnRegionalPrice | null;
  editionRatio?: number;
}

export function parsePriceNumber(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.includes(",") && !cleaned.includes(".")) {
    const num = Number(cleaned.replace(",", "."));
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  const num = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
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
    giftCardCost: null,
    giftCardValue: null,
    giftCardCards: [],
    hasGiftCards: false,
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
  selectedPriceRaw?: string | null;
}): Promise<PsnRegionalPriceReport> {
  const {
    conceptId,
    name = null,
    imageUrl = null,
    comparisonCurrency = "EGP",
    regions = PSN_PRICE_REGIONS,
    noStore = false,
    selectedPriceRaw = null,
  } = opts;

  const fxBase = "USD";
  const rates = await getExchangeRates(fxBase);

  const prices = await mapWithConcurrency(regions, 5, (region) =>
    priceForRegion(conceptId, region, comparisonCurrency, rates, fxBase, noStore),
  );

  const selectedPrice = parsePriceNumber(selectedPriceRaw);
  const usPriceObj = prices.find(
    (p) => p.countryCode === "US" && p.available && p.final !== null && p.final > 0,
  );

  let editionRatio = 1.0;
  if (selectedPrice && usPriceObj && usPriceObj.final && usPriceObj.final > 0) {
    editionRatio = selectedPrice / usPriceObj.final;
  }

  if (editionRatio !== 1.0 && Number.isFinite(editionRatio) && editionRatio > 0) {
    for (const p of prices) {
      if (p.available && p.original !== null && p.final !== null) {
        p.original = Math.round(p.original * editionRatio * 100) / 100;
        p.final = Math.round(p.final * editionRatio * 100) / 100;
        if (p.convertedOriginal !== null) {
          p.convertedOriginal = Math.round(p.convertedOriginal * editionRatio * 100) / 100;
        }
        if (p.convertedFinal !== null) {
          p.convertedFinal = Math.round(p.convertedFinal * editionRatio * 100) / 100;
        }
      }
    }
  }

  // Calculate gift card combination for each region
  try {
    const supabase = createAdminClient();
    const CARD_COLS =
      "id, provider, product_name, value, value_currency, purchase_price, fees, total_cost, purchase_currency, region";
    const { data: giftCards } = await withPlatformFallback(
      supabase
        .from("gift_cards")
        .select(CARD_COLS)
        .eq("platform", "playstation")
        .eq("active", true),
      () => supabase.from("gift_cards").select(CARD_COLS).eq("active", true),
      "playstation",
    );

    if (giftCards && giftCards.length > 0) {
      for (const p of prices) {
        if (!p.available || p.isFree || p.final === null || p.final <= 0 || !p.currency) {
          continue;
        }

        const matchingCards = giftCards.filter(
          (c) =>
            giftCardMatchesRegion(p.countryCode, c.region) &&
            c.value_currency.toUpperCase() === p.currency!.toUpperCase(),
        );

        if (matchingCards.length === 0) continue;

        const cardOptions: GiftCardOption[] = matchingCards.map((c) => ({
          id: c.id,
          value: c.value,
          totalCost: c.total_cost,
        }));

        const combo = findCheapestGiftCardCombination(p.final, cardOptions);
        if (combo) {
          const cardsById = new Map(matchingCards.map((c) => [c.id, c]));
          p.giftCardCost = combo.totalCost;
          p.giftCardValue = combo.totalValue;
          p.hasGiftCards = true;
          p.giftCardCards = combo.cards.map((c) => {
            const card = cardsById.get(c.id);
            return {
              id: c.id,
              provider: card?.provider ?? "Gift Card",
              productName: card?.product_name ?? card?.provider ?? "PSN Card",
              value: card?.value ?? 0,
              valueCurrency: card?.value_currency ?? p.currency ?? "",
              quantity: c.quantity,
              lineCost: Math.round((card?.total_cost ?? 0) * c.quantity * 100) / 100,
            };
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to calculate gift card combinations for PS prices:", err);
  }

  // Pick cheapest: first check regions with valid gift card cost, fallback to convertedFinal
  const withGiftCards = prices
    .filter(
      (p): p is PsnRegionalPrice & { giftCardCost: number } =>
        p.available && !p.isFree && p.giftCardCost !== null && p.giftCardCost > 0,
    )
    .sort((a, b) => a.giftCardCost - b.giftCardCost);

  const cheapest =
    withGiftCards[0] ??
    prices
      .filter((p): p is PsnRegionalPrice & { convertedFinal: number } => p.convertedFinal !== null)
      .sort((a, b) => a.convertedFinal - b.convertedFinal)[0] ??
    null;

  return {
    conceptId,
    name,
    imageUrl,
    storeUrl: `https://store.playstation.com/en-us/concept/${conceptId}`,
    comparisonCurrency,
    prices,
    cheapest,
    editionRatio,
  };
}

