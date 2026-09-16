"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";
import {
  syncProductToGamefyStore,
  testGamefyStoreConnection,
} from "@/lib/gamefy-store/client";

export interface PublishInput {
  /** Which storefront this listing belongs to. Defaults to "steam". */
  platform?: Platform;
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
 * save report) into a live `products` row and automatically syncs it
 * directly to the live Gamefy Web Store (https://gamefy-two.vercel.app).
 */
export async function publishOpportunity(input: PublishInput): Promise<PublishResult> {
  const platform: Platform = input.platform ?? "steam";
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("products")
    .select("selling_price")
    .eq("game_id", input.gameId)
    .eq("game_region_id", input.gameRegionId)
    .maybeSingle();

  const oldPrice =
    existing && existing.selling_price > input.sellingPrice ? existing.selling_price : null;

  // Retrieve extra game metadata (publisher, description) and regional discount status
  const [{ data: gameData }, { data: regionData }] = await Promise.all([
    supabase
      .from("games")
      .select("publisher, description, image_url")
      .eq("id", input.gameId)
      .maybeSingle(),
    supabase
      .from("game_regions")
      .select("discount_percent, sale_active, original_price, current_price")
      .eq("id", input.gameRegionId)
      .maybeSingle(),
  ]);

  const { error } = await supabase.from("products").upsert(
    {
      platform,
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

  // Sync to live Gamefy Web Store automatically with discount lifecycle
  let webMessage = "";
  if (process.env.GAMEFY_STORE_API_KEY) {
    const discountPercent =
      regionData?.discount_percent && regionData.discount_percent > 0
        ? regionData.discount_percent
        : oldPrice && oldPrice > input.sellingPrice
        ? Math.round(((oldPrice - input.sellingPrice) / oldPrice) * 100)
        : 0;

    const webRes = await syncProductToGamefyStore({
      title: input.title,
      imageUrl: input.imageUrl || gameData?.image_url || null,
      sellingPrice: input.sellingPrice,
      oldPrice: oldPrice,
      cost: input.cost,
      currency: input.currency,
      platform,
      publisher: gameData?.publisher,
      description: gameData?.description,
      discountPercent,
      saleActive: regionData?.sale_active ?? Boolean(oldPrice),
    });

    if (webRes.ok) {
      webMessage = ` & ${webRes.message}`;
    } else {
      webMessage = ` (Web sync note: ${webRes.message})`;
    }
  }

  const base = platform === "playstation" ? "/ps" : "/admin";
  revalidatePath(`${base}/products`);
  revalidatePath(base);
  revalidatePath("/store");

  return {
    ok: true,
    message: existing
      ? `Updated live listing${webMessage}`
      : `Published to storefront${webMessage}`,
  };
}

export async function setProductPublished(
  productId: string,
  published: boolean,
): Promise<PublishResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("products").update({ published }).eq("id", productId);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/products");
  revalidatePath("/ps/products");
  revalidatePath("/store");
  return { ok: true, message: published ? "Published." : "Unpublished." };
}

/**
 * Pushes a single existing product from the database directly to the live Gamefy Web Store.
 */
export async function pushProductToGamefyWeb(productId: string): Promise<PublishResult> {
  const supabase = createAdminClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, games(publisher, description, image_url), game_regions(discount_percent, sale_active)")
    .eq("id", productId)
    .single();

  if (!product) return { ok: false, message: "Product not found." };

  const game = product.games as { publisher?: string; description?: string; image_url?: string } | null;
  const region = product.game_regions as { discount_percent?: number; sale_active?: boolean } | null;

  const discountPercent =
    region?.discount_percent && region.discount_percent > 0
      ? region.discount_percent
      : product.old_price && product.old_price > product.selling_price
      ? Math.round(((product.old_price - product.selling_price) / product.old_price) * 100)
      : 0;

  const result = await syncProductToGamefyStore({
    title: product.title,
    imageUrl: product.image_url || game?.image_url || null,
    sellingPrice: product.selling_price,
    oldPrice: product.old_price,
    cost: product.cost,
    currency: product.currency,
    platform: product.platform,
    publisher: game?.publisher,
    description: game?.description,
    discountPercent,
    saleActive: region?.sale_active ?? Boolean(product.old_price),
  });

  return { ok: result.ok, message: result.message };
}

/**
 * Pushes all published products in bulk to the live Gamefy Web Store.
 */
export async function pushAllPublishedToGamefyWeb(platform?: Platform): Promise<PublishResult> {
  const supabase = createAdminClient();
  let query = supabase
    .from("products")
    .select("*, games(publisher, description, image_url), game_regions(discount_percent, sale_active)")
    .eq("published", true);

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data: products } = await query;
  if (!products || products.length === 0) {
    return { ok: false, message: "No published products found to sync." };
  }

  let successCount = 0;
  let failCount = 0;

  for (const product of products) {
    const game = product.games as { publisher?: string; description?: string; image_url?: string } | null;
    const region = product.game_regions as { discount_percent?: number; sale_active?: boolean } | null;

    const discountPercent =
      region?.discount_percent && region.discount_percent > 0
        ? region.discount_percent
        : product.old_price && product.old_price > product.selling_price
        ? Math.round(((product.old_price - product.selling_price) / product.old_price) * 100)
        : 0;

    const res = await syncProductToGamefyStore({
      title: product.title,
      imageUrl: product.image_url || game?.image_url || null,
      sellingPrice: product.selling_price,
      oldPrice: product.old_price,
      cost: product.cost,
      currency: product.currency,
      platform: product.platform,
      publisher: game?.publisher,
      description: game?.description,
      discountPercent,
      saleActive: region?.sale_active ?? Boolean(product.old_price),
    });
    if (res.ok) successCount++;
    else failCount++;
  }

  return {
    ok: successCount > 0,
    message: `Synced ${successCount} product${successCount === 1 ? "" : "s"} to Gamefy Web${failCount > 0 ? ` (${failCount} failed)` : ""}.`,
  };
}

/**
 * Tests connection to the live Gamefy Web Store.
 */
export async function testGamefyStoreAction(): Promise<{ ok: boolean; message: string }> {
  const result = await testGamefyStoreConnection();
  return { ok: result.ok, message: result.message };
}
