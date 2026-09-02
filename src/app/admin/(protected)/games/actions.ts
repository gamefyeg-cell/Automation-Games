"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildRegionReport, type RegionReportResult } from "@/lib/pricing/report";
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
  });
}
