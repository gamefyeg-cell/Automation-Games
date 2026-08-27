/**
 * The Gamefy profit engine.
 *
 * Steam tells you what a game costs to buy. Your gift-card inventory
 * tells you what it costs *you* to fund that purchase. This module turns
 * "Steam price + available gift cards + pricing rules" into a concrete
 * cost and a selling price — it never mutates the database itself, so it
 * can be unit tested and reused from the sync worker, an API route, or
 * the admin dashboard.
 */

export interface GiftCardOption {
  id: string;
  /** Face value, in the same currency as the Steam price being matched. */
  value: number;
  /** What you pay the supplier for one unit of this card (purchase_price + fees). */
  totalCost: number;
}

export interface GiftCardCombination {
  /** Total face value covered — always >= the requested target value. */
  totalValue: number;
  /** Total cost to acquire that face value. */
  totalCost: number;
  /** How many of each gift card option are used. */
  cards: { id: string; quantity: number }[];
}

/**
 * Finds the cheapest combination of gift cards whose combined face value
 * is at least `targetValue`, assuming unlimited stock of each card
 * (unbounded knapsack / coin-change-style DP).
 *
 * Values are converted to integer "cents" internally to avoid floating
 * point drift, then searched up to `targetValue + max(card value)` since
 * overshooting by less than one extra card is never worse than
 * overshooting by more.
 */
export function findCheapestGiftCardCombination(
  targetValue: number,
  options: GiftCardOption[],
): GiftCardCombination | null {
  const usable = options.filter((o) => o.value > 0 && o.totalCost >= 0);
  if (usable.length === 0 || targetValue <= 0) return null;

  const CENTS = 100;
  const target = Math.ceil(targetValue * CENTS);
  const maxCardCents = Math.max(...usable.map((o) => Math.round(o.value * CENTS)));
  // Search a little past the target: the optimal solution never needs to
  // land more than one card's value beyond it.
  const upperBound = target + maxCardCents;

  const bestCost = new Array<number>(upperBound + 1).fill(Infinity);
  const choice = new Array<number>(upperBound + 1).fill(-1);
  bestCost[0] = 0;

  for (let amount = 1; amount <= upperBound; amount++) {
    for (let i = 0; i < usable.length; i++) {
      const cardCents = Math.round(usable[i].value * CENTS);
      if (cardCents <= 0 || cardCents > amount) continue;
      const prev = amount - cardCents;
      if (bestCost[prev] === Infinity) continue;
      const cost = bestCost[prev] + usable[i].totalCost;
      if (cost < bestCost[amount]) {
        bestCost[amount] = cost;
        choice[amount] = i;
      }
    }
  }

  // Cheapest reachable amount at or above the target.
  let bestAmount = -1;
  let bestAmountCost = Infinity;
  for (let amount = target; amount <= upperBound; amount++) {
    if (bestCost[amount] < bestAmountCost) {
      bestAmountCost = bestCost[amount];
      bestAmount = amount;
    }
  }
  if (bestAmount === -1) return null;

  const counts = new Map<string, number>();
  let remaining = bestAmount;
  while (remaining > 0) {
    const i = choice[remaining];
    if (i === -1) break; // unreachable amount, shouldn't happen given bestAmount check
    const card = usable[i];
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
    remaining -= Math.round(card.value * CENTS);
  }

  const cards = [...counts.entries()].map(([id, quantity]) => ({ id, quantity }));
  const totalValue =
    cards.reduce((sum, c) => {
      const card = usable.find((o) => o.id === c.id)!;
      return sum + card.value * c.quantity;
    }, 0) ?? 0;

  return { totalValue, totalCost: bestAmountCost, cards };
}

export interface PricingSettings {
  minimumProfit: number;
  targetProfitPercentage: number; // e.g. 20 for 20%
  paymentFeePercentage: number; // e.g. 3 for 3%
  websiteFeePercentage: number; // e.g. 0
}

export interface ProductPricingResult {
  /** What it costs Gamefy to fulfil this order (cheapest gift-card combo). */
  cost: number;
  /** Combination of gift cards used to reach that cost. */
  combination: GiftCardCombination;
  /** Final price shown to the customer. */
  sellingPrice: number;
  profit: number;
  profitMarginPercent: number;
  /** False when even the target-margin price still falls under minimumProfit. */
  meetsMinimumProfit: boolean;
}

/**
 * Computes a selling price and margin for a Steam price, given the
 * cheapest available gift-card funding and the current pricing rules.
 *
 * Selling price = cost, marked up so that after payment/website fees the
 * *net* profit still hits both the target percentage and the minimum
 * absolute profit — whichever requires the higher price.
 */
export function calculateProductPricing(
  steamPrice: number,
  giftCards: GiftCardOption[],
  settings: PricingSettings,
): ProductPricingResult | null {
  const combination = findCheapestGiftCardCombination(steamPrice, giftCards);
  if (!combination) return null;

  const cost = combination.totalCost;
  const feeRate = (settings.paymentFeePercentage + settings.websiteFeePercentage) / 100;

  // Price so that target-percentage profit survives fee deduction:
  //   sellingPrice - sellingPrice * feeRate - cost = cost * targetProfitPercentage / 100
  const targetProfitAmount = cost * (settings.targetProfitPercentage / 100);
  const priceForTargetMargin = (cost + targetProfitAmount) / (1 - feeRate);

  // Price so that the minimum absolute profit survives fee deduction:
  //   sellingPrice - sellingPrice * feeRate - cost = minimumProfit
  const priceForMinimumProfit = (cost + settings.minimumProfit) / (1 - feeRate);

  const sellingPrice = Math.max(priceForTargetMargin, priceForMinimumProfit);
  const netRevenue = sellingPrice * (1 - feeRate);
  const profit = netRevenue - cost;
  const profitMarginPercent = sellingPrice === 0 ? 0 : (profit / sellingPrice) * 100;

  return {
    cost,
    combination,
    sellingPrice: round2(sellingPrice),
    profit: round2(profit),
    profitMarginPercent: round2(profitMarginPercent),
    meetsMinimumProfit: profit >= settings.minimumProfit - 0.01,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
