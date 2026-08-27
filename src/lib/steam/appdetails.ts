/**
 * Client for Steam's public (undocumented but stable) App Details endpoint.
 * No API key needed. Crucially, it accepts a `cc` (country code) query
 * param and returns that region's actual store price — no geo-proxying
 * required, unlike scraping the rendered store page.
 *
 * https://store.steampowered.com/api/appdetails?appids=730&cc=us
 */

const STEAM_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";

export class SteamApiError extends Error {}

export interface SteamAppDetails {
  appId: number;
  countryCode: string;
  /** False when Steam has no listing for this app in this region (success: false). */
  available: boolean;
  name: string | null;
  imageUrl: string | null;
  developer: string | null;
  publisher: string | null;
  genres: string[];
  isFree: boolean;
  /** Null when unavailable or free-to-play (Steam sends no price_overview for those). */
  currency: string | null;
  originalPrice: number | null;
  currentPrice: number | null;
  discountPercent: number;
}

export function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}/`;
}

interface SteamAppDetailsResponseEntry {
  success: boolean;
  data?: {
    name?: string;
    header_image?: string;
    developers?: string[];
    publishers?: string[];
    genres?: { id: string; description: string }[];
    is_free?: boolean;
    price_overview?: {
      currency: string;
      initial: number; // minor units, e.g. cents
      final: number;
      discount_percent: number;
    };
  };
}

/**
 * Fetches one app's details for one Steam store country/region.
 * Retries transient failures (429/5xx/network errors) with backoff; a
 * clean 4xx or a `success: false` body resolves to `available: false`
 * rather than throwing, since that's Steam's normal way of saying "this
 * app isn't sold in that region" rather than an error.
 */
export async function getAppDetails(
  appId: number,
  countryCode: string,
  { retries = 2 }: { retries?: number } = {},
): Promise<SteamAppDetails> {
  const cc = countryCode.toLowerCase();
  const url = new URL(STEAM_APPDETAILS_URL);
  url.searchParams.set("appids", String(appId));
  url.searchParams.set("cc", cc);
  url.searchParams.set("l", "english");

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });

      if (res.status === 429 || res.status >= 500) {
        throw new SteamApiError(
          `Steam appdetails returned ${res.status} for app ${appId} (${cc}).`,
        );
      }
      if (!res.ok) {
        return unavailable(appId, cc);
      }

      const body = (await res.json()) as Record<string, SteamAppDetailsResponseEntry>;
      const entry = body[String(appId)];
      if (!entry?.success || !entry.data) {
        return unavailable(appId, cc);
      }

      return normalize(appId, cc, entry.data);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new SteamApiError(String(lastError));
}

function unavailable(appId: number, countryCode: string): SteamAppDetails {
  return {
    appId,
    countryCode,
    available: false,
    name: null,
    imageUrl: null,
    developer: null,
    publisher: null,
    genres: [],
    isFree: false,
    currency: null,
    originalPrice: null,
    currentPrice: null,
    discountPercent: 0,
  };
}

function normalize(
  appId: number,
  countryCode: string,
  data: NonNullable<SteamAppDetailsResponseEntry["data"]>,
): SteamAppDetails {
  const priceOverview = data.price_overview;
  const isFree = Boolean(data.is_free);

  return {
    appId,
    countryCode,
    available: true,
    name: data.name ?? null,
    imageUrl: data.header_image ?? null,
    developer: data.developers?.[0] ?? null,
    publisher: data.publishers?.[0] ?? null,
    genres: data.genres?.map((g) => g.description).filter(Boolean) ?? [],
    isFree,
    // Steam sends no price_overview for free games; there's nothing to
    // price, so leave currency/prices null rather than guessing.
    currency: priceOverview?.currency ?? null,
    originalPrice: priceOverview ? priceOverview.initial / 100 : isFree ? 0 : null,
    currentPrice: priceOverview ? priceOverview.final / 100 : isFree ? 0 : null,
    discountPercent: priceOverview?.discount_percent ?? 0,
  };
}
