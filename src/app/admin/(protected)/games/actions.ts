"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/auth/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";
import { buildRegionReport, type RegionReportResult } from "@/lib/pricing/report";
import { syncSteamGameRegion } from "@/lib/steam/sync";
import { syncPsGameRegion } from "@/lib/psn/sync";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import type { Platform } from "@/lib/supabase/database.types";

export async function deleteGameRegion(
  regionId: string,
  platform: Platform = "steam",
): Promise<{ ok: boolean; message?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("game_regions").delete().eq("id", regionId);

  if (error) return { ok: false, message: error.message };

  const base = platform === "playstation" ? "/ps" : "/admin";
  revalidatePath(`${base}/games`);
  revalidatePath(base);
  return { ok: true };
}

/**
 * The report for a game region that's already saved — no re-sync, just
 * reads the price already stored and runs it through the pricing engine.
 * Powers the click-to-expand row on /admin/games.
 */
export async function getGameRegionReport(
  gameRegionId: string,
  platform: Platform = "steam",
  minProfitOverride?: number,
): Promise<RegionReportResult> {
  const supabase = createAdminClient();
  const { data: region, error } = await supabase
    .from("game_regions")
    .select(
      "id, game_id, country_code, currency, original_price, current_price, discount_percent, games(name, image_url)",
    )
    .eq("id", gameRegionId)
    .single();

  if (error || !region) {
    return { ok: false, message: error?.message ?? "That region no longer exists." };
  }

  const game = Array.isArray(region.games) ? region.games[0] : region.games;

  return buildRegionReport({
    platform,
    gameId: region.game_id,
    gameRegionId: region.id,
    imageUrl: game?.image_url ?? null,
    gameName: game?.name ?? "Unknown game",
    countryCode: region.country_code,
    originalPrice: region.original_price,
    currentPrice: region.current_price,
    discountPercent: region.discount_percent,
    currency: region.currency,
    minProfitOverride,
  });
}

export interface SyncAllGamesResult {
  ok: boolean;
  synced: number;
  succeeded: number;
  failed: number;
  message: string;
}

/**
 * Syncs all saved game regions for the chosen platform (Steam or PlayStation)
 * to refresh prices, discount status, and history snapshots.
 */
export async function syncAllGames(
  platform: Platform = "steam",
): Promise<SyncAllGamesResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminCookie(token)) {
    return {
      ok: false,
      synced: 0,
      succeeded: 0,
      failed: 0,
      message: "Log in to /admin first — syncing games requires an admin session.",
    };
  }

  const supabase = createAdminClient();

  if (platform === "playstation") {
    const { data: regions, error } = await withPlatformFallback(
      supabase
        .from("game_regions")
        .select("country_code, games(ps_concept_id, name, image_url)")
        .eq("platform", "playstation"),
      () =>
        supabase
          .from("game_regions")
          .select("country_code, games(ps_concept_id, name, image_url)"),
      "playstation",
    );

    if (error) {
      return { ok: false, synced: 0, succeeded: 0, failed: 0, message: error.message ?? "Failed to fetch PlayStation game regions." };
    }

    const items: { conceptId: string; name: string; imageUrl: string | null; country: string }[] = [];
    const seen = new Set<string>();

    for (const r of regions ?? []) {
      const game = Array.isArray(r.games) ? r.games[0] : r.games;
      if (game?.ps_concept_id && r.country_code) {
        const key = `${game.ps_concept_id}:${r.country_code.toUpperCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            conceptId: game.ps_concept_id,
            name: game.name ?? "PlayStation Game",
            imageUrl: game.image_url ?? null,
            country: r.country_code,
          });
        }
      }
    }

    if (items.length === 0) {
      return {
        ok: true,
        synced: 0,
        succeeded: 0,
        failed: 0,
        message: "No PlayStation games found to sync. Add games from PlayStation Prices first.",
      };
    }

    const results = await mapWithConcurrency(items, 3, (item) =>
      syncPsGameRegion(
        { conceptId: item.conceptId, name: item.name, imageUrl: item.imageUrl },
        item.country,
      ),
    );

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    revalidatePath("/ps/games");
    revalidatePath("/ps");

    const message =
      failed > 0
        ? `Synced ${succeeded}/${results.length} PlayStation regions (${failed} failed).`
        : `Successfully synced all ${succeeded} PlayStation game region${succeeded === 1 ? "" : "s"}!`;

    return { ok: true, synced: results.length, succeeded, failed, message };
  }

  // Steam platform
  const { data: regions, error } = await withPlatformFallback(
    supabase
      .from("game_regions")
      .select("country_code, games(id, steam_app_id, name)")
      .eq("platform", "steam"),
    () =>
      supabase
        .from("game_regions")
        .select("country_code, games(id, steam_app_id, name)"),
    "steam",
  );

  if (error) {
    return { ok: false, synced: 0, succeeded: 0, failed: 0, message: error.message ?? "Failed to fetch Steam game regions." };
  }

  const pairs: { appId: number; country: string }[] = [];
  const seen = new Set<string>();

  for (const r of regions ?? []) {
    const game = Array.isArray(r.games) ? r.games[0] : r.games;
    if (game?.steam_app_id && r.country_code) {
      const key = `${game.steam_app_id}:${r.country_code.toUpperCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ appId: game.steam_app_id, country: r.country_code });
      }
    }
  }

  // Also query active steam games in case any don't have regions yet
  const { data: activeGames } = await withPlatformFallback(
    supabase
      .from("games")
      .select("steam_app_id")
      .eq("platform", "steam")
      .eq("active", true),
    () => supabase.from("games").select("steam_app_id").eq("active", true),
    "steam",
  );

  const defaultCountries =
    process.env.STEAM_SYNC_COUNTRIES?.split(",").map((c) => c.trim()).filter(Boolean) ?? ["us"];

  for (const g of activeGames ?? []) {
    if (g.steam_app_id) {
      for (const c of defaultCountries) {
        const key = `${g.steam_app_id}:${c.toUpperCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ appId: g.steam_app_id, country: c });
        }
      }
    }
  }

  if (pairs.length === 0) {
    return {
      ok: true,
      synced: 0,
      succeeded: 0,
      failed: 0,
      message: "No Steam games found to sync. Add games from Steam Prices first.",
    };
  }

  const results = await mapWithConcurrency(pairs, 5, ({ appId, country }) =>
    syncSteamGameRegion(appId, country),
  );

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  revalidatePath("/admin/games");
  revalidatePath("/admin");

  const message =
    failed > 0
      ? `Synced ${succeeded}/${results.length} Steam regions (${failed} failed).`
      : `Successfully synced all ${succeeded} Steam game region${succeeded === 1 ? "" : "s"}!`;

  return { ok: true, synced: results.length, succeeded, failed, message };
}

/**
 * Syncs a single game region on demand.
 */
export async function syncSingleGameRegion(
  regionId: string,
  platform: Platform = "steam",
): Promise<{ ok: boolean; message?: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminCookie(token)) {
    return { ok: false, message: "Log in to /admin first." };
  }

  const supabase = createAdminClient();
  const { data: region, error } = await supabase
    .from("game_regions")
    .select("country_code, games(name, steam_app_id, ps_concept_id, image_url)")
    .eq("id", regionId)
    .maybeSingle();

  if (error || !region) {
    return { ok: false, message: error?.message ?? "Region not found." };
  }

  const game = Array.isArray(region.games) ? region.games[0] : region.games;
  if (!game) {
    return { ok: false, message: "Game details not found." };
  }

  if (platform === "playstation") {
    if (!game.ps_concept_id) {
      return { ok: false, message: "PlayStation concept ID not found for this game." };
    }
    const res = await syncPsGameRegion(
      {
        conceptId: game.ps_concept_id,
        name: game.name,
        imageUrl: game.image_url ?? null,
      },
      region.country_code,
    );
    if (!res.ok) return { ok: false, message: res.error ?? "Failed to sync PlayStation region." };
  } else {
    if (!game.steam_app_id) {
      return { ok: false, message: "Steam App ID not found for this game." };
    }
    const res = await syncSteamGameRegion(game.steam_app_id, region.country_code);
    if (!res.ok) return { ok: false, message: res.error ?? "Failed to sync Steam region." };
  }

  const base = platform === "playstation" ? "/ps" : "/admin";
  revalidatePath(`${base}/games`);
  revalidatePath(base);
  return { ok: true, message: `Synced ${game.name} (${region.country_code})` };
}
