/**
 * Foreign exchange rates, used to normalize regional Steam prices into one
 * comparison currency before ranking them — comparing raw numbers across
 * currencies (₺1,000 vs $39.99) is meaningless on its own.
 *
 * Uses open.er-api.com: free, no API key, updated daily. Good enough for
 * ranking regions; not a source of truth for accounting.
 */

const FX_BASE_URL = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RatesCache | null = null;

/** Rates are all "how many of this currency per 1 unit of `base`". */
export async function getExchangeRates(base = "USD"): Promise<Record<string, number>> {
  if (cache && cache.base === base && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const res = await fetch(`${FX_BASE_URL}/${base}`);
  if (!res.ok) {
    throw new Error(`Exchange rate fetch failed (${res.status}).`);
  }

  const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
  if (body.result !== "success" || !body.rates) {
    throw new Error("Exchange rate provider returned an unexpected response.");
  }

  cache = { base, rates: body.rates, fetchedAt: Date.now() };
  return body.rates;
}

/**
 * Converts `amount` from one currency to another using a rates table
 * fetched with `base` as the reference currency (i.e. rates[base] === 1).
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>,
  base: string,
): number {
  if (from === to) return round2(amount);

  const fromRate = from === base ? 1 : rates[from];
  const toRate = to === base ? 1 : rates[to];
  if (!fromRate || !toRate) {
    throw new Error(`Missing exchange rate for ${from} or ${to}.`);
  }

  const amountInBase = amount / fromRate;
  return round2(amountInBase * toRate);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
