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
  editionRatio: number = 1.0,
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
    let originalPrice = price.basePriceValue / divisor;
    let currentPrice = (price.discountedValue ?? price.basePriceValue) / divisor;

    if (editionRatio && editionRatio > 0 && editionRatio !== 1.0) {
      originalPrice = Math.round(originalPrice * editionRatio * 100) / 100;
      currentPrice = Math.round(currentPrice * editionRatio * 100) / 100;
    }

    const discountPercent =
      originalPrice > 0 && currentPrice < originalPrice
        ? Math.round((1 - currentPrice / originalPrice) * 100)
        : 0;

    const supabase = createAdminClient();

    // 1. Fetch or insert game (avoids PostgREST ON CONFLICT restriction on partial index)
    let gameId: string | undefined;

    const { data: existingGame } = await supabase
      .from("games")
      .select("id")
      .eq("ps_concept_id", input.conceptId)
      .maybeSingle();

    if (existingGame) {
      gameId = existingGame.id;
      const { error: updateGameError } = await supabase
        .from("games")
        .update({
          name: input.name,
          image_url: input.imageUrl,
          steam_url: `https://store.playstation.com/en-us/concept/${input.conceptId}`,
        })
        .eq("id", gameId);

      if (updateGameError) {
        throw new Error(updateGameError.message);
      }
    } else {
      const baseSlug = slugify(input.name) || `concept-${input.conceptId}`;
      const { data: newGame, error: insertGameError } = await supabase
        .from("games")
        .insert({
          platform: "playstation",
          ps_concept_id: input.conceptId,
          name: input.name,
          slug: baseSlug,
          image_url: input.imageUrl,
          steam_url: `https://store.playstation.com/en-us/concept/${input.conceptId}`,
        })
        .select("id")
        .single();

      if (insertGameError) {
        if (insertGameError.code === "23505" && insertGameError.message.includes("slug")) {
          const { data: retryGame, error: retryError } = await supabase
            .from("games")
            .insert({
              platform: "playstation",
              ps_concept_id: input.conceptId,
              name: input.name,
              slug: `${baseSlug}-${input.conceptId}`,
              image_url: input.imageUrl,
              steam_url: `https://store.playstation.com/en-us/concept/${input.conceptId}`,
            })
            .select("id")
            .single();

          if (retryError || !retryGame) {
            throw new Error(retryError?.message ?? "Failed to insert game.");
          }
          gameId = retryGame.id;
        } else {
          throw new Error(insertGameError.message);
        }
      } else if (newGame) {
        gameId = newGame.id;
      }
    }

    if (!gameId) {
      throw new Error("Failed to find or create PlayStation game.");
    }

    // 2. Fetch or insert game region
    let gameRegionId: string | undefined;

    const { data: existingRegion } = await supabase
      .from("game_regions")
      .select("id")
      .eq("game_id", gameId)
      .eq("country_code", cc)
      .maybeSingle();

    if (existingRegion) {
      gameRegionId = existingRegion.id;
      const { error: updateRegionError } = await supabase
        .from("game_regions")
        .update({
          platform: "playstation",
          currency,
          original_price: originalPrice,
          current_price: currentPrice,
          discount_percent: discountPercent,
          sale_active: discountPercent > 0,
          last_updated: new Date().toISOString(),
        })
        .eq("id", gameRegionId);

      if (updateRegionError) {
        throw new Error(updateRegionError.message);
      }
    } else {
      const { data: newRegion, error: insertRegionError } = await supabase
        .from("game_regions")
        .insert({
          platform: "playstation",
          game_id: gameId,
          country_code: cc,
          currency,
          original_price: originalPrice,
          current_price: currentPrice,
          discount_percent: discountPercent,
          sale_active: discountPercent > 0,
          last_updated: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertRegionError || !newRegion) {
        throw new Error(insertRegionError?.message ?? "Failed to insert game region.");
      }
      gameRegionId = newRegion.id;
    }

    const { error: historyError } = await supabase.from("game_price_history").insert({
      platform: "playstation",
      game_id: gameId,
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
      gameId,
      gameRegionId,
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
