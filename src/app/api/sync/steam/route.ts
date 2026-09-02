import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSteamGames } from "@/lib/steam/sync";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";

export const maxDuration = 300; // seconds — Anakin jobs can take up to ~2 min each

interface SyncRequestBody {
  /** Steam app IDs to sync. Omit to sync every `games.active = true` row already in the DB. */
  steamAppIds?: number[];
  /** Country codes to scrape each game in. Defaults to STEAM_SYNC_COUNTRIES or ["us"]. */
  countries?: string[];
}

/**
 * POST /api/sync/steam
 *
 * Trusted entry point for the Steam sync worker — call it from Supabase Cron,
 * a manual admin action, or any scheduler that can send the shared secret.
 * Guarded by STEAM_SYNC_SECRET rather than a user session, since schedulers
 * don't carry a Supabase auth cookie.
 *
 *   curl -X POST https://your-app/api/sync/steam \
 *     -H "x-sync-secret: $STEAM_SYNC_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"steamAppIds":[1091500],"countries":["us","eg","gb"]}'
 */
export async function POST(request: Request) {
  const secret = process.env.STEAM_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STEAM_SYNC_SECRET is not configured." }, { status: 500 });
  }
  if (request.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as SyncRequestBody;

  const countries =
    body.countries ??
    process.env.STEAM_SYNC_COUNTRIES?.split(",").map((c) => c.trim()).filter(Boolean) ??
    ["us"];

  let steamAppIds = body.steamAppIds;
  if (!steamAppIds?.length) {
    const supabase = createAdminClient();
    const { data, error } = await withPlatformFallback(
      supabase.from("games").select("steam_app_id").eq("platform", "steam").eq("active", true),
      () => supabase.from("games").select("steam_app_id").eq("active", true),
      "steam",
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    steamAppIds = (data ?? [])
      .map((g) => g.steam_app_id)
      .filter((id): id is number => id !== null);
  }

  if (steamAppIds.length === 0) {
    return NextResponse.json({ message: "No games to sync.", results: [] });
  }

  const results = await syncSteamGames(steamAppIds, countries);
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    synced: results.length,
    succeeded: results.length - failed.length,
    failed: failed.length,
    results,
  });
}
