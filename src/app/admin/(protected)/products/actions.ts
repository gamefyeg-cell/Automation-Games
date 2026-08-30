"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PublishInput {
  gameId: string;
  gameRegionId: string;
  title: string;
  imageUrl: string | null;
  sellingPrice: number;
  cost: number;
  currency: string;
}

export interface PublishResult {
  ok: boolean;
  message: string;
}

/**
 * Turns a computed opportunity (from the Opportunities board or a /prices
 * save report) into a live `products` row — the actual missing link
 * between "the engine says this is profitable" and "it's on the
 * storefront". Upserts on (game_id, game_region_id) — see the
 * `products_game_region_unique` migration — so re-publishing the same
 * opportunity after a Steam price change updates the existing listing
 * instead of creating a duplicate.
 *
 * `old_price` is only set to the *previous* Gamefy selling price, and
 * only when it's genuinely higher than the new one — a real markdown
 * from what Gamefy itself charged before, never a fabricated "was" price.
 */
export async function publishOpportunity(input: PublishInput): Promise<PublishResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("products")
    .select("selling_price")
    .eq("game_id", input.gameId)
    .eq("game_region_id", input.gameRegionId)
    .maybeSingle();

  const oldPrice =
    existing && existing.selling_price > input.sellingPrice ? existing.selling_price : null;

  const { error } = await supabase.from("products").upsert(
    {
      game_id: input.gameId,
      game_region_id: input.gameRegionId,
      title: input.title,
      image_url: input.imageUrl,
      selling_price: input.sellingPrice,
      old_price: oldPrice,
      cost: input.cost,
      currency: input.currency,
      published: true,
    },
    { onConflict: "game_id,game_region_id" },
  );

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/");

  return { ok: true, message: existing ? "Updated the live listing." : "Published to storefront." };
}

export async function setProductPublished(
  productId: string,
  published: boolean,
): Promise<PublishResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").update({ published }).eq("id", productId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true, message: published ? "Published." : "Unpublished." };
}
