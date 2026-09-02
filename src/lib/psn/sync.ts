/**
 * The PlayStation counterpart to src/lib/steam/sync.ts. Fetches one game's
 * Store price for one region straight from PlayStation's concept-pricing
 * query, then upserts it into `games` + `game_regions` (both tagged
 * platform = 'playstation') and appends a `game_price_history` snapshot.
 *
 * Unlike Steam's appdetails, PlayStation's pricing query carries no
 * name/image, so the caller passes the metadata it already has from the
 * catalog/search result.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { psnGraphql } from "@/lib/psstore/client";
import { psnRegionByCountry, psnPriceDivisor } from "@/lib/psn/regions";
import { slugify } from "@/lib/utils/slug";

export interface PsnSyncResult {
  conceptId: string;
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

interface ConceptPriceResponse {
  conceptRetrieve?: {
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

export async function syncPsGameRegion(
  input: { conceptId: string; name: string; imageUrl: string | null },
  countryCode: string,
): Promise<PsnSyncResult> {
  const cc = countryCode.trim().toUpperCase();
  const region = psnRegionByCountry(cc);

  try {
    if (!region) {
      throw new Error(`No PlayStation Store region configured for "${cc}".`);
    }

    const data = await psnGraphql<ConceptPriceResponse>(
      "metGetPricingDataByConceptId",
      { conceptId: input.conceptId },
      region.locale,
      { noStore: true },
    );
    const price = data.conceptRetrieve?.defaultProduct?.price;

    if (!price || price.basePriceValue == null || !price.currencyCode) {
      throw new Error(`PlayStation has no price for this game in ${cc}.`);
    }
    if (price.isFree) {
      throw new Error("This game is free / included with PlayStation Plus — nothing to price.");
    }

    const currency = price.currencyCode;
    const divisor = psnPriceDivisor(price.basePrice, price.basePriceValue);
    const originalPrice = price.basePriceValue / divisor;
    const currentPrice = (price.discountedValue ?? price.basePriceValue) / divisor;
    const discountPercent =
      originalPrice > 0 && currentPrice < originalPrice
        ? Math.round((1 - currentPrice / originalPrice) * 100)
        : 0;

    const supabase = createAdminClient();

    const { data: game, error: gameError } = await supabase
      .from("games")
      .upsert(
        {
          platform: "playstation",
          ps_concept_id: input.conceptId,
          name: input.name,
          slug: slugify(input.name) || `concept-${input.conceptId}`,
          image_url: input.imageUrl,
          steam_url: `https://store.playstation.com/en-us/concept/${input.conceptId}`,
        },
        { onConflict: "ps_concept_id" },
      )
      .select("id")
      .single();

    if (gameError || !game) {
      throw new Error(gameError?.message ?? "Failed to upsert game.");
    }

    const { data: gameRegion, error: regionError } = await supabase
      .from("game_regions")
      .upsert(
        {
          platform: "playstation",
          game_id: game.id,
          country_code: cc,
          currency,
          original_price: originalPrice,
          current_price: currentPrice,
          discount_percent: discountPercent,
          sale_active: discountPercent > 0,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "game_id,country_code" },
      )
      .select("id")
      .single();

    if (regionError || !gameRegion) {
      throw new Error(regionError?.message ?? "Failed to upsert game region.");
    }

    const { error: historyError } = await supabase.from("game_price_history").insert({
      platform: "playstation",
      game_id: game.id,
      country_code: cc,
      currency,
      original_price: originalPrice,
      current_price: currentPrice,
      discount_percent: discountPercent,
    });
    if (historyError) throw new Error(historyError.message);

    return {
      conceptId: input.conceptId,
      countryCode: cc,
      ok: true,
      gameName: input.name,
      gameId: game.id,
      gameRegionId: gameRegion.id,
      imageUrl: input.imageUrl,
      originalPrice,
      currentPrice,
      discountPercent,
      currency,
    };
  } catch (err) {
    return {
      conceptId: input.conceptId,
      countryCode: cc,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
