import { createAdminClient } from "@/lib/supabase/admin";
import { getAppDetails, steamStoreUrl } from "@/lib/steam/appdetails";
import { mapWithConcurrency } from "@/lib/utils/concurrency";
import { slugify } from "@/lib/utils/slug";

export interface SyncResult {
  steamAppId: number;
  countryCode: string;
  ok: boolean;
  gameName?: string;
  gameId?: string;
  gameRegionId?: string;
  imageUrl?: string | null;
  originalPrice?: number;
  currentPrice?: number;
  discountPercent?: number;
  currency?: string;
  error?: string;
}

/**
 * Fetches one Steam app's price for one region straight from Steam's own
 * appdetails endpoint (free, no key, no proxying needed — see
 * src/lib/steam/appdetails.ts), then upserts the result into `games` +
 * `game_regions` and appends a `game_price_history` snapshot. Uses the
 * service-role client — this is server-only, trusted code (see
 * src/app/api/sync/steam/route.ts for the auth-gated entry point).
 */
export async function syncSteamGameRegion(
  steamAppId: number,
  countryCode: string,
): Promise<SyncResult> {
  const country = countryCode.toLowerCase();
  try {
    const details = await getAppDetails(steamAppId, country);

    if (!details.available) {
      throw new Error(`Steam has no listing for app ${steamAppId} in ${country.toUpperCase()}.`);
    }
    if (details.isFree) {
      throw new Error(`App ${steamAppId} is free-to-play — nothing to price.`);
    }
    if (details.currentPrice === null || !details.currency) {
      throw new Error(
        `Steam returned no price data for app ${steamAppId} in ${country.toUpperCase()}.`,
      );
    }

    const supabase = createAdminClient();

    const { data: game, error: gameError } = await supabase
      .from("games")
      .upsert(
        {
          platform: "steam",
          steam_app_id: steamAppId,
          name: details.name!,
          slug: slugify(details.name!),
          developer: details.developer,
          publisher: details.publisher,
          genres: details.genres,
          image_url: details.imageUrl,
          steam_url: steamStoreUrl(steamAppId),
        },
        { onConflict: "steam_app_id" },
      )
      .select("id")
      .single();

    if (gameError || !game) {
      throw new Error(gameError?.message ?? "Failed to upsert game.");
    }

    const originalPrice = details.originalPrice ?? details.currentPrice;

    const { data: region, error: regionError } = await supabase
      .from("game_regions")
      .upsert(
        {
          platform: "steam",
          game_id: game.id,
          country_code: country.toUpperCase(),
          currency: details.currency,
          original_price: originalPrice,
          current_price: details.currentPrice,
          discount_percent: details.discountPercent,
          sale_active: details.discountPercent > 0,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "game_id,country_code" },
      )
      .select("id")
      .single();

    if (regionError || !region) {
      throw new Error(regionError?.message ?? "Failed to upsert game region.");
    }

    const { error: historyError } = await supabase.from("game_price_history").insert({
      platform: "steam",
      game_id: game.id,
      country_code: country.toUpperCase(),
      currency: details.currency,
      original_price: originalPrice,
      current_price: details.currentPrice,
      discount_percent: details.discountPercent,
    });

    if (historyError) throw new Error(historyError.message);

    return {
      steamAppId,
      countryCode: country,
      ok: true,
      gameName: details.name ?? undefined,
      gameId: game.id,
      gameRegionId: region.id,
      imageUrl: details.imageUrl,
      originalPrice,
      currentPrice: details.currentPrice,
      discountPercent: details.discountPercent,
      currency: details.currency,
    };
  } catch (err) {
    return {
      steamAppId,
      countryCode: country,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syncSteamGames(
  steamAppIds: number[],
  countryCodes: string[],
  concurrency = 5,
): Promise<SyncResult[]> {
  const pairs = steamAppIds.flatMap((appId) =>
    countryCodes.map((country) => ({ appId, country })),
  );

  return mapWithConcurrency(pairs, concurrency, ({ appId, country }) =>
    syncSteamGameRegion(appId, country),
  );
}
