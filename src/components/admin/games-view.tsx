import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { GameRegionRow } from "@/app/admin/(protected)/games/game-region-row";
import { SyncAllGamesButton } from "@/app/admin/(protected)/games/sync-all-games-button";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/time";
import {
  diffSnapshots,
  groupHistory,
  type HistorySnapshot,
} from "@/app/admin/(protected)/games/price-change";

const COPY: Record<Platform, { title: string; description: string }> = {
  steam: {
    title: "Steam Games",
    description:
      "Populated by POST /api/sync/steam or by choosing a region on Steam Prices. The Change column compares the last two syncs — so schedule the sync if you want it to stay current. Click a row for the full cost/profit report.",
  },
  playstation: {
    title: "PlayStation Games",
    description:
      "Populated by choosing a region on PlayStation Prices. The Change column compares the last two times each region was priced. Click a row for the full cost/profit report.",
  },
};

export async function GamesView({ platform }: { platform: Platform }) {
  const supabase = createAdminClient();

  const COLS =
    "id, game_id, country_code, currency, original_price, current_price, discount_percent, sale_active, last_updated, games(name)";
  const { data: regions } = await withPlatformFallback(
    supabase
      .from("game_regions")
      .select(COLS)
      .eq("platform", platform)
      .order("last_updated", { ascending: false }),
    () => supabase.from("game_regions").select(COLS).order("last_updated", { ascending: false }),
    platform,
  );

  // The two most recent price-history snapshots per (game, region) — that's
  // what the Change column diffs. Pull a generous recent window and group
  // in memory rather than issuing one query per row.
  const gameIds = [...new Set((regions ?? []).map((r) => r.game_id))];
  const HIST_COLS =
    "game_id, country_code, current_price, original_price, discount_percent, recorded_at";
  const { data: history } = gameIds.length
    ? await withPlatformFallback(
        supabase
          .from("game_price_history")
          .select(HIST_COLS)
          .eq("platform", platform)
          .in("game_id", gameIds)
          .order("recorded_at", { ascending: false })
          .limit(2000),
        () =>
          supabase
            .from("game_price_history")
            .select(HIST_COLS)
            .in("game_id", gameIds)
            .order("recorded_at", { ascending: false })
            .limit(2000),
        platform,
      )
    : { data: [] as HistorySnapshot[] };

  const grouped = groupHistory((history ?? []) as HistorySnapshot[]);

  const rows = (regions ?? []).map((r) => {
    const game = Array.isArray(r.games) ? r.games[0] : r.games;
    const snaps = grouped.get(`${r.game_id}|${r.country_code}`) ?? [];
    return {
      key: r.id,
      change: diffSnapshots(snaps[0], snaps[1]),
      data: {
        id: r.id,
        gameName: game?.name ?? "Unknown game",
        countryCode: r.country_code,
        currency: r.currency,
        originalPrice: r.original_price,
        currentPrice: r.current_price,
        discountPercent: r.discount_percent,
        saleActive: r.sale_active,
        lastUpdated: r.last_updated,
      },
    };
  });

  const ended = rows.filter((r) => r.change?.kind === "discount-ended").length;
  const started = rows.filter((r) => r.change?.kind === "discount-new").length;
  const moved = rows.filter(
    (r) => r.change?.kind === "discount-deepened" || r.change?.kind === "discount-reduced",
  ).length;

  const lastSyncedAt = (regions ?? []).reduce<string | null>((latest, r) => {
    if (!r.last_updated) return latest;
    if (!latest) return r.last_updated;
    return new Date(r.last_updated) > new Date(latest) ? r.last_updated : latest;
  }, (history as HistorySnapshot[])?.[0]?.recorded_at ?? null);

  const copy = COPY[platform];

  return (
    <div>
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <SyncAllGamesButton
            platform={platform}
            lastSyncedAt={lastSyncedAt}
            totalCount={rows.length}
          />
        }
      />

      {(ended > 0 || started > 0 || moved > 0) && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-zinc-400">Since the previous sync:</span>
            {ended > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                {ended} discount{ended === 1 ? "" : "s"} ended
              </span>
            )}
            {started > 0 && (
              <span className="flex items-center gap-1 text-emerald-400">
                <TrendingDown className="h-3.5 w-3.5" />
                {started} new discount{started === 1 ? "" : "s"}
              </span>
            )}
            {moved > 0 && (
              <span className="flex items-center gap-1 text-zinc-400">
                <TrendingUp className="h-3.5 w-3.5" />
                {moved} discount{moved === 1 ? "" : "s"} changed
              </span>
            )}
          </div>
          {lastSyncedAt && (
            <span
              className="text-xs text-zinc-500"
              title={formatDateTime(lastSyncedAt)}
            >
              Last sync: {formatRelativeTime(lastSyncedAt)}
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && ended === 0 && started === 0 && moved === 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-4 py-2.5 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            All tracked prices and discounts are up to date.
          </span>
          {lastSyncedAt && (
            <span className="text-zinc-500" title={formatDateTime(lastSyncedAt)}>
              Last synced: {formatRelativeTime(lastSyncedAt)}
            </span>
          )}
        </div>
      )}

      <Table>
        <Thead>
          <tr>
            <Th>Game</Th>
            <Th>Region</Th>
            <Th align="right">Original</Th>
            <Th align="right">Current</Th>
            <Th align="right">Discount</Th>
            <Th align="right">Sale</Th>
            <Th>Change vs last sync</Th>
            <Th align="right">Actions</Th>
          </tr>
        </Thead>
        <tbody>
          {rows.map((r) => (
            <GameRegionRow key={r.key} platform={platform} region={r.data} change={r.change} />
          ))}
          {rows.length === 0 && <EmptyRow colSpan={8}>No games synced yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
