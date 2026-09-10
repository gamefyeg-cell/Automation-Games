/**
 * "What changed since the previous sync" for a saved game region.
 *
 * `game_price_history` gets one row appended every time a region is synced
 * (see src/lib/steam/sync.ts / src/lib/psn/sync.ts). Comparing the two
 * most recent rows for a (game, country) tells you whether a discount
 * just appeared, deepened, shrank, or — the one that's easy to miss —
 * quietly ended.
 */

export interface HistorySnapshot {
  game_id: string;
  country_code: string;
  current_price: number;
  original_price: number;
  discount_percent: number;
  recorded_at: string;
}

export type PriceChangeKind =
  | "first-sync"
  | "none"
  | "discount-new"
  | "discount-ended"
  | "discount-deepened"
  | "discount-reduced"
  | "price-drop"
  | "price-rise";

export interface PriceChange {
  kind: PriceChangeKind;
  fromDiscount: number;
  toDiscount: number;
  fromPrice: number;
  toPrice: number;
  /** recorded_at of the previous snapshot — how old the "before" state is. */
  since: string | null;
}

/** Groups snapshots by game+country and keeps the two most recent, newest first. */
export function groupHistory(rows: HistorySnapshot[]): Map<string, HistorySnapshot[]> {
  const byKey = new Map<string, HistorySnapshot[]>();
  for (const row of rows) {
    const key = `${row.game_id}|${row.country_code}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
    list.splice(2);
  }
  return byKey;
}

export function diffSnapshots(
  latest: HistorySnapshot | undefined,
  previous: HistorySnapshot | undefined,
): PriceChange | null {
  if (!latest) return null;
  if (!previous) {
    return {
      kind: "first-sync",
      fromDiscount: 0,
      toDiscount: latest.discount_percent,
      fromPrice: latest.current_price,
      toPrice: latest.current_price,
      since: null,
    };
  }

  const from = previous.discount_percent;
  const to = latest.discount_percent;
  const base: Omit<PriceChange, "kind"> = {
    fromDiscount: from,
    toDiscount: to,
    fromPrice: previous.current_price,
    toPrice: latest.current_price,
    since: previous.recorded_at,
  };

  if (from === 0 && to > 0) return { ...base, kind: "discount-new" };
  if (from > 0 && to === 0) return { ...base, kind: "discount-ended" };
  if (from > 0 && to > from) return { ...base, kind: "discount-deepened" };
  if (from > 0 && to < from) return { ...base, kind: "discount-reduced" };

  if (latest.current_price < previous.current_price) return { ...base, kind: "price-drop" };
  if (latest.current_price > previous.current_price) return { ...base, kind: "price-rise" };

  return { ...base, kind: "none" };
}
