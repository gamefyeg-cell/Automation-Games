/**
 * Client for the live Gamefy Web Store API (https://gamefy-two.vercel.app)
 * Authenticated via x-api-key header.
 *
 * Matches the exact Gamefy API schema:
 *   POST   /api/v1/products          → requires categoryId, type (GAME), coverUrl, variants[]
 *   PATCH  /api/v1/products/[id]     → update product fields
 *   GET    /api/v1/products          → list products (returns { success, data: [...] })
 *   POST   /api/v1/discounts         → requires name, value, type (PERCENT/FLAT), scope
 *   PATCH  /api/v1/discounts/[id]    → update discount
 *   DELETE /api/v1/discounts/[id]    → delete discount
 */

export interface GamefyProductPayload {
  title: string;
  publisher?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  platform?: "steam" | "playstation" | string;
  sellingPrice?: number;
  oldPrice?: number | null;
  cost?: number | null;
  currency?: string;
  discountPercent?: number;
  saleActive?: boolean;
}

export interface GamefyProduct {
  id: string;
  title?: string;
  slug?: string;
  coverUrl?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  type?: string;
  active?: boolean;
  variants?: GamefyVariant[];
  [key: string]: unknown;
}

export interface GamefyVariant {
  id: string;
  sku: string;
  price: number;
  currency: string;
  platform?: string | null;
  saleMode?: string;
  deliveryMethod?: string;
  stockMode?: string;
  stockQty?: number | null;
  active?: boolean;
  [key: string]: unknown;
}

export interface GamefyDiscount {
  id: string;
  name: string;
  code?: string | null;
  type: "PERCENT" | "FLAT";
  value: number;
  scope: string;
  scopeId?: string | null;
  active: boolean;
  endsAt?: string | null;
  [key: string]: unknown;
}

// ─── The "Games" category ID in the live Gamefy store ─────────────────────
// Discovered from: GET /api/v1/products → data[0].category
const GAMES_CATEGORY_ID = "cmt32f6390003xa3n3i29bmcx";

function getStoreConfig() {
  const baseUrl = (process.env.GAMEFY_STORE_URL || "https://gamefy-two.vercel.app").replace(/\/+$/, "");
  const apiKey = (process.env.GAMEFY_STORE_API_KEY || "").trim();
  return { baseUrl, apiKey };
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "x-api-key": apiKey,
  };
}

/**
 * Maps our platform string to the Gamefy platform enum value.
 */
function mapPlatform(platform?: string | null): string | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p === "steam" || p === "pc") return "PC";
  if (p === "playstation" || p === "ps" || p === "ps5" || p === "ps4") return "PlayStation";
  return platform;
}

/**
 * Fetches the entire product catalog from the live Gamefy store.
 * Response shape: { success: true, data: GamefyProduct[] }
 */
export async function getGamefyCatalog(): Promise<GamefyProduct[]> {
  const { baseUrl, apiKey } = getStoreConfig();
  if (!apiKey) return [];

  try {
    const res = await fetch(`${baseUrl}/api/v1/products?limit=100`, {
      headers: buildHeaders(apiKey),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    if (!json) return [];
    // Shape: { success: true, data: [...] }
    if (Array.isArray(json.data)) return json.data as GamefyProduct[];
    if (Array.isArray(json)) return json as GamefyProduct[];
    return [];
  } catch {
    return [];
  }
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finds a product on Gamefy Web by title (fuzzy + normalized matching).
 */
export async function findGamefyProductByTitle(title: string): Promise<GamefyProduct | null> {
  const catalog = await getGamefyCatalog();
  if (catalog.length === 0) return null;

  const needle = title.trim().toLowerCase();
  const cleanNeedle = normalizeTitle(title);

  // 1. Exact match
  const exact = catalog.find((p) => {
    const t = String(p.title || "").trim().toLowerCase();
    return t === needle;
  });
  if (exact) return exact;

  // 2. Normalized match (handles ™, ®, punctuation, spacing differences)
  const normMatch = catalog.find((p) => {
    const t = normalizeTitle(String(p.title || ""));
    return t === cleanNeedle;
  });
  if (normMatch) return normMatch;

  // 3. Contains match (one includes the other)
  const partial = catalog.find((p) => {
    const t = normalizeTitle(String(p.title || ""));
    return (
      (cleanNeedle.length > 3 && t.includes(cleanNeedle)) ||
      (t.length > 3 && cleanNeedle.includes(t))
    );
  });

  return partial ?? null;
}

/**
 * Fetches all discounts from Gamefy Web.
 * Response shape: { success: true, data: GamefyDiscount[] }
 */
export async function getGamefyDiscounts(): Promise<GamefyDiscount[]> {
  const { baseUrl, apiKey } = getStoreConfig();
  if (!apiKey) return [];

  try {
    const res = await fetch(`${baseUrl}/api/v1/discounts`, {
      headers: buildHeaders(apiKey),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    if (!json) return [];
    if (Array.isArray(json.data)) return json.data as GamefyDiscount[];
    if (Array.isArray(json)) return json as GamefyDiscount[];
    return [];
  } catch {
    return [];
  }
}

/**
 * Creates or updates a percentage discount on Gamefy Web for a specific product.
 * Uses scope=PRODUCT so it's tied to the product's ID.
 */
export async function createOrUpdateDiscountForProduct(
  productId: string,
  productTitle: string,
  discountPercent: number,
): Promise<{ ok: boolean; message?: string }> {
  const { baseUrl, apiKey } = getStoreConfig();
  if (!apiKey || discountPercent <= 0) return { ok: false, message: "No discount to apply" };

  const headers = buildHeaders(apiKey);

  // Check if a discount for this product already exists
  const discounts = await getGamefyDiscounts();
  const existing = discounts.find(
    (d) =>
      d.scopeId === productId ||
      d.name.toLowerCase().includes(productTitle.toLowerCase()),
  );

  const discountBody = {
    name: `${productTitle} — ${discountPercent}% Sale`,
    type: "PERCENT",
    value: discountPercent,
    scope: "PRODUCT",
    scopeId: productId,
    active: true,
  };

  if (existing?.id) {
    // Update existing discount
    const patchRes = await fetch(`${baseUrl}/api/v1/discounts/${existing.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ value: discountPercent, active: true }),
    });
    if (patchRes.ok) {
      return { ok: true, message: `Updated ${discountPercent}% discount on Gamefy Web` };
    }
  }

  // Create new discount
  const createRes = await fetch(`${baseUrl}/api/v1/discounts`, {
    method: "POST",
    headers,
    body: JSON.stringify(discountBody),
  });

  if (createRes.ok) {
    return { ok: true, message: `Created ${discountPercent}% discount on Gamefy Web` };
  }

  const err = await createRes.text().catch(() => "");
  return { ok: false, message: `Discount error: ${err.slice(0, 120)}` };
}

/**
 * Deletes any active discount linked to a product when its sale ends.
 */
export async function deleteDiscountForProduct(
  productId: string,
  productTitle: string,
): Promise<{ ok: boolean; message?: string }> {
  const { baseUrl, apiKey } = getStoreConfig();
  if (!apiKey) return { ok: false };

  const discounts = await getGamefyDiscounts();
  const matching = discounts.filter(
    (d) =>
      d.scopeId === productId ||
      d.name.toLowerCase().includes(productTitle.toLowerCase()),
  );

  if (matching.length === 0) {
    return { ok: true, message: "No active discounts to remove" };
  }

  let deletedCount = 0;
  for (const d of matching) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/discounts/${d.id}`, {
        method: "DELETE",
        headers: buildHeaders(apiKey),
      });
      if (res.ok) deletedCount++;
    } catch {
      continue;
    }
  }

  return {
    ok: deletedCount > 0,
    message: `Removed ${deletedCount} expired discount(s) on Gamefy Web`,
  };
}

/**
 * Comprehensive connection & endpoint tester for Settings page.
 */
export async function testGamefyStoreConnection(): Promise<{
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  const { baseUrl, apiKey } = getStoreConfig();
  if (!apiKey) {
    return { ok: false, message: "GAMEFY_STORE_API_KEY is not configured." };
  }

  const results: string[] = [];
  let catalogCount = 0;
  let sampleProduct: GamefyProduct | null = null;

  // 1. GET /api/v1/products
  try {
    const res = await fetch(`${baseUrl}/api/v1/products?limit=5`, {
      headers: buildHeaders(apiKey),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const items: GamefyProduct[] = Array.isArray(json?.data) ? json.data : [];
      catalogCount = items.length;
      sampleProduct = items[0] ?? null;
      results.push(`GET /api/v1/products: ✅ (${catalogCount} products)`);
    } else {
      results.push(`GET /api/v1/products: ❌ HTTP ${res.status}`);
    }
  } catch (err) {
    results.push(`GET /api/v1/products error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. POST /api/v1/products (probe — send missing required field to get 400, not 405)
  try {
    const postRes = await fetch(`${baseUrl}/api/v1/products`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({ title: "_probe_" }), // missing categoryId → 400
    });
    if (postRes.status === 400) {
      results.push(`POST /api/v1/products: ✅ (endpoint live, needs categoryId)`);
    } else if (postRes.status === 201 || postRes.status === 200) {
      results.push(`POST /api/v1/products: ✅`);
    } else {
      results.push(`POST /api/v1/products: ❌ HTTP ${postRes.status}`);
    }
  } catch {
    results.push(`POST /api/v1/products: ❌ (network error)`);
  }

  // 3. GET /api/v1/discounts
  try {
    const discRes = await fetch(`${baseUrl}/api/v1/discounts`, {
      headers: buildHeaders(apiKey),
      cache: "no-store",
    });
    if (discRes.ok) {
      results.push(`GET /api/v1/discounts: ✅`);
    } else {
      results.push(`GET /api/v1/discounts: ❌ HTTP ${discRes.status}`);
    }
  } catch {
    results.push(`GET /api/v1/discounts: ❌ (network error)`);
  }

  // 4. PATCH /api/v1/products/[id] (probe with real product if we have one)
  if (sampleProduct?.id) {
    try {
      const patchRes = await fetch(`${baseUrl}/api/v1/products/${sampleProduct.id}`, {
        method: "PATCH",
        headers: buildHeaders(apiKey),
        body: JSON.stringify({}), // empty patch → should 200
      });
      if (patchRes.ok) {
        results.push(`PATCH /api/v1/products/[id]: ✅`);
      } else {
        results.push(`PATCH /api/v1/products/[id]: ❌ HTTP ${patchRes.status}`);
      }
    } catch {
      results.push(`PATCH /api/v1/products/[id]: ❌ (network error)`);
    }
  }

  const sampleInfo = sampleProduct
    ? ` | Sample: "${sampleProduct.title}" (${sampleProduct.id})`
    : "";

  return {
    ok: catalogCount > 0,
    message: `${results.join(" | ")}${sampleInfo}`,
    details: { catalogCount, sampleProduct },
  };
}

/**
 * Creates or updates a product on Gamefy Web with full discount lifecycle:
 * 1. Look up product by title in live catalog.
 * 2. Exists → PATCH /api/v1/products/[id].
 * 3. New → POST /api/v1/products with categoryId, type, coverUrl, variants[].
 * 4. Discount active → POST /api/v1/discounts (PERCENT, scope=PRODUCT).
 * 5. Discount expired → DELETE /api/v1/discounts/[id] automatically.
 */
export async function syncProductToGamefyStore(
  payload: GamefyProductPayload,
): Promise<{ ok: boolean; message: string; productId?: string; isUpdate?: boolean }> {
  const { baseUrl, apiKey } = getStoreConfig();
  if (!apiKey) {
    return { ok: false, message: "GAMEFY_STORE_API_KEY is not configured." };
  }

  const headers = buildHeaders(apiKey);

  const price = payload.sellingPrice ?? 0;
  const currency = payload.currency || "EGP";
  const platform = mapPlatform(payload.platform);

  const isDiscountActive =
    (payload.discountPercent && payload.discountPercent > 0) ||
    Boolean(payload.saleActive) ||
    Boolean(payload.oldPrice && payload.oldPrice > price);

  const discountPercent =
    payload.discountPercent && payload.discountPercent > 0
      ? payload.discountPercent
      : payload.oldPrice && payload.oldPrice > price
      ? Math.round(((payload.oldPrice - price) / payload.oldPrice) * 100)
      : 0;

  try {
    // 1. Look up existing product on Gamefy Web
    const existing = await findGamefyProductByTitle(payload.title);
    let targetProductId = existing?.id;
    let isUpdate = false;

    if (targetProductId) {
      // 2. Product exists → PATCH
      const patchBody: Record<string, unknown> = {
        publisher: payload.publisher ?? undefined,
        description: payload.description ?? undefined,
        coverUrl: payload.imageUrl ?? undefined,
        active: true,
      };

      // Remove undefined keys
      for (const k of Object.keys(patchBody)) {
        if (patchBody[k] === undefined) delete patchBody[k];
      }

      const patchRes = await fetch(`${baseUrl}/api/v1/products/${targetProductId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patchBody),
      });

      if (patchRes.ok) {
        isUpdate = true;
      } else {
        // If PATCH fails, fall through to create
        targetProductId = undefined;
      }
    }

    if (!targetProductId) {
      // 3. New product → POST with full required schema
      const createBody: Record<string, unknown> = {
        title: payload.title,
        categoryId: GAMES_CATEGORY_ID,
        type: "GAME",
        publisher: payload.publisher || null,
        description: payload.description || null,
        coverUrl: payload.imageUrl || null,
        active: true,
        // Create a default variant with the price
        variants: [
          {
            price,
            cost: payload.cost ?? null,
            currency,
            platform: platform || "PC",
            saleMode: "KEY",
            deliveryMethod: "AUTO_KEY",
            stockMode: "MANUAL",
            stockQty: 0,
            regionLockType: "NONE",
            active: true,
          },
        ],
      };

      const createRes = await fetch(`${baseUrl}/api/v1/products`, {
        method: "POST",
        headers,
        body: JSON.stringify(createBody),
      });

      if (createRes.ok) {
        const createdJson = await createRes.json().catch(() => ({})) as Record<string, unknown>;
        const created = (createdJson.data as Record<string, unknown> | undefined) ?? createdJson;
        targetProductId = created?.id as string | undefined;
      } else {
        const errBody = await createRes.text().catch(() => "");
        return {
          ok: false,
          message: `Failed to create on Gamefy Web: HTTP ${createRes.status}: ${errBody.slice(0, 200)}`,
        };
      }
    }

    // 4. Discount lifecycle management
    let discountNote = "";
    if (targetProductId) {
      if (isDiscountActive && discountPercent > 0) {
        const discRes = await createOrUpdateDiscountForProduct(
          targetProductId,
          payload.title,
          discountPercent,
        );
        if (discRes.ok) {
          discountNote = ` + ${discountPercent}% discount applied`;
        }
      } else {
        // Sale ended → auto-delete discount
        const delRes = await deleteDiscountForProduct(targetProductId, payload.title);
        if (delRes.ok && delRes.message?.includes("Removed")) {
          discountNote = " + Expired discount removed";
        }
      }
    }

    const action = isUpdate ? "Updated" : "Published";
    return {
      ok: true,
      message: `${action} "${payload.title}" on Gamefy Web (${price} ${currency})${discountNote}`,
      productId: targetProductId,
      isUpdate,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
