import { scrapeUrl } from "@/lib/steam/anakin";

/** JSON Schema handed to Anakin's AI extraction (generateJson + outputSchema). */
export const STEAM_PAGE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The game's title, exactly as shown as the page heading." },
    developer: { type: "string", description: "The game's developer / development studio." },
    publisher: { type: "string", description: "The game's publisher." },
    genres: {
      type: "array",
      items: { type: "string" },
      description: "Genre tags/categories shown for the game (e.g. Action, RPG, Open World).",
    },
    imageUrl: {
      type: "string",
      description: "URL of the main header/capsule artwork image for the game.",
    },
    currency: {
      type: "string",
      description:
        "ISO 4217 currency code implied by the price shown (e.g. USD, EGP, GBP), inferred from the currency symbol.",
    },
    originalPrice: {
      type: "number",
      description:
        "The undiscounted list price as a plain number with no currency symbol. Same as currentPrice if there is no active discount. 0 if the game is free.",
    },
    currentPrice: {
      type: "number",
      description:
        "The price actually being charged right now, after any discount, as a plain number with no currency symbol. 0 if the game is free.",
    },
    discountPercent: {
      type: "number",
      description: "The discount percentage currently applied to the price. 0 if there is no active discount.",
    },
    saleActive: {
      type: "boolean",
      description: "Whether a discount/sale is currently active on this page.",
    },
  },
  required: ["name", "currentPrice"],
} as const;

export interface SteamPageExtraction {
  name: string;
  developer: string | null;
  publisher: string | null;
  genres: string[];
  imageUrl: string | null;
  currency: string;
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  saleActive: boolean;
}

export function steamStoreUrl(steamAppId: number): string {
  return `https://store.steampowered.com/app/${steamAppId}/`;
}

/**
 * Scrapes a Steam store page (geo-routed through Anakin for the given country)
 * and returns structured pricing/metadata extracted by Anakin's AI extraction.
 *
 * Known limitation: Steam's mature-content age gate serves an interstitial
 * page instead of the store page for some games. That interstitial has no
 * price data, so this will return currentPrice: 0 / saleActive: false for
 * those app IDs until the worker also handles `actions` to click through it.
 */
export async function extractSteamGamePage(
  steamAppId: number,
  countryCode: string,
): Promise<SteamPageExtraction> {
  const job = await scrapeUrl({
    url: steamStoreUrl(steamAppId),
    country: countryCode,
    formats: ["json"],
    generateJson: true,
    outputSchema: STEAM_PAGE_SCHEMA,
  });

  const data = job.generatedJson?.data as Partial<SteamPageExtraction> | undefined;
  if (!data || typeof data.name !== "string") {
    throw new Error(
      `Anakin returned no usable data for Steam app ${steamAppId} (${countryCode}).`,
    );
  }

  const currentPrice = numberOr(data.currentPrice, 0);
  const originalPrice = numberOr(data.originalPrice, currentPrice);
  const discountPercent = Math.round(numberOr(data.discountPercent, 0));

  return {
    name: data.name,
    developer: data.developer ?? null,
    publisher: data.publisher ?? null,
    genres: Array.isArray(data.genres) ? data.genres : [],
    imageUrl: data.imageUrl ?? null,
    currency: (data.currency || "USD").toUpperCase(),
    originalPrice,
    currentPrice,
    discountPercent,
    saleActive: data.saleActive ?? discountPercent > 0,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
