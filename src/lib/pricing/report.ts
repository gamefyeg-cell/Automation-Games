import { createAdminClient } from "@/lib/supabase/admin";
import { giftCardMatchesRegion } from "@/lib/steam/regions";
import { calculateProductPricing, type GiftCardOption } from "@/lib/pricing/engine";

export interface RegionReportCardLine {
  provider: string;
  productName: string;
  quantity: number;
  unitValue: number;
  valueCurrency: string;
  unitPurchasePrice: number;
  unitFees: number;
  unitTotalCost: number;
  lineValue: number;
  lineCost: number;
  purchaseCurrency: string;
}

/** The full cost/profit calculation against one specific Steam price. */
export interface PriceScenario {
  steamPrice: number;
  cards: RegionReportCardLine[];
  totalValueCovered: number;
  cost: number;
  feeAmount: number;
  sellingPrice: number;
  profit: number;
  profitMarginPercent: number;
  meetsMinimumProfit: boolean;
}

export interface RegionReport {
  gameId: string;
  gameRegionId: string;
  imageUrl: string | null;
  gameName: string;
  countryCode: string;
  currency: string;
  discountPercent: number;
  savedAmount: number;

  productCurrency: string;
  paymentFeePercentage: number;
  websiteFeePercentage: number;
  targetProfitPercentage: number;
  minimumProfit: number;

  /** Calculated against the full/original Steam price — null if no gift-card combo covers it. */
  beforeDiscount: PriceScenario | null;
  /** Calculated against the current (possibly discounted) Steam price — null if no combo covers it. */
  afterDiscount: PriceScenario | null;
}

export interface RegionReportResult {
  ok: boolean;
  message: string;
  report?: RegionReport;
}

export interface RegionReportInput {
  gameId: string;
  gameRegionId: string;
  imageUrl: string | null;
  gameName: string;
  countryCode: string;
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  currency: string;
}

/**
 * Builds the full itemized cost/profit report for one already-known
 * (game, region) combo — shared by the /prices "Choose this region" flow
 * (right after a fresh sync) and /admin/games (reading an already-saved
 * region on demand, no re-sync needed).
 *
 * Runs the pricing engine twice: once against the full/original Steam
 * price and once against the current (possibly discounted) price, since
 * gift cards required for a €50 game aren't the same combo as for the
 * same game at €25 during a sale — each needs its own calculation, not
 * just a different display of the same numbers.
 */
export async function buildRegionReport(input: RegionReportInput): Promise<RegionReportResult> {
  const supabase = createAdminClient();
  const [{ data: giftCards }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("gift_cards")
      .select(
        "id, provider, product_name, value, value_currency, purchase_price, fees, total_cost, purchase_currency, region",
      )
      .eq("active", true),
    supabase.from("pricing_settings").select("*").single(),
  ]);

  if (!settingsRow) {
    return { ok: false, message: "No pricing_settings row found, so no report." };
  }
  if (!giftCards?.length) {
    return { ok: false, message: "Add active gift cards to see a payment report." };
  }

  // Only a gift card that actually funds this region's wallet, denominated
  // in this region's actual currency, can pay for this region's price —
  // see src/lib/steam/regions.ts.
  const matchingCards = giftCards.filter(
    (c) =>
      giftCardMatchesRegion(input.countryCode, c.region) &&
      c.value_currency.toUpperCase() === input.currency.toUpperCase(),
  );
  if (!matchingCards.length) {
    return { ok: false, message: "None of your active gift cards are usable in this region." };
  }

  const settings = {
    minimumProfit: settingsRow.minimum_profit,
    targetProfitPercentage: settingsRow.target_profit_percentage,
    paymentFeePercentage: settingsRow.payment_fee_percentage,
    websiteFeePercentage: settingsRow.website_fee_percentage,
  };

  const buildScenario = (steamPrice: number): PriceScenario | null => {
    const cardOptions: GiftCardOption[] = matchingCards.map((c) => ({
      id: c.id,
      value: c.value,
      totalCost: c.total_cost,
    }));

    const result = calculateProductPricing(steamPrice, cardOptions, settings);
    if (!result) return null;

    const cardsById = new Map(matchingCards.map((c) => [c.id, c]));
    const cards: RegionReportCardLine[] = result.combination.cards.map((c) => {
      const card = cardsById.get(c.id)!;
      return {
        provider: card.provider,
        productName: card.product_name,
        quantity: c.quantity,
        unitValue: card.value,
        valueCurrency: card.value_currency,
        unitPurchasePrice: card.purchase_price,
        unitFees: card.fees,
        unitTotalCost: card.total_cost,
        lineValue: round2(card.value * c.quantity),
        lineCost: round2(card.total_cost * c.quantity),
        purchaseCurrency: card.purchase_currency,
      };
    });

    const feeRate = (settings.paymentFeePercentage + settings.websiteFeePercentage) / 100;

    return {
      steamPrice,
      cards,
      totalValueCovered: round2(cards.reduce((sum, c) => sum + c.lineValue, 0)),
      cost: result.cost,
      feeAmount: round2(result.sellingPrice * feeRate),
      sellingPrice: result.sellingPrice,
      profit: result.profit,
      profitMarginPercent: result.profitMarginPercent,
      meetsMinimumProfit: result.meetsMinimumProfit,
    };
  };

  const afterDiscount = buildScenario(input.currentPrice);
  const beforeDiscount = buildScenario(input.originalPrice);

  if (!afterDiscount && !beforeDiscount) {
    return {
      ok: false,
      message: "No combination of your active gift cards covers this price.",
    };
  }

  return {
    ok: true,
    message: "",
    report: {
      gameId: input.gameId,
      gameRegionId: input.gameRegionId,
      imageUrl: input.imageUrl,
      gameName: input.gameName,
      countryCode: input.countryCode.toUpperCase(),
      currency: input.currency,
      discountPercent: input.discountPercent,
      savedAmount: round2(input.originalPrice - input.currentPrice),

      productCurrency: settingsRow.default_currency,
      paymentFeePercentage: settings.paymentFeePercentage,
      websiteFeePercentage: settings.websiteFeePercentage,
      targetProfitPercentage: settings.targetProfitPercentage,
      minimumProfit: settings.minimumProfit,

      beforeDiscount,
      afterDiscount,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
