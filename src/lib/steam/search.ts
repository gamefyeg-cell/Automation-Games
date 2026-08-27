/**
 * Client for Steam's public storefront search endpoint. Used to resolve a
 * game name (e.g. "FC 26") to its actual Steam App ID — never assume the
 * app ID from the name; titles get re-released, remastered, and reused.
 *
 * https://store.steampowered.com/api/storesearch/?term=fc+26&cc=us
 */

const STEAM_STORESEARCH_URL = "https://store.steampowered.com/api/storesearch/";

export interface SteamSearchResult {
  appId: number;
  name: string;
  imageUrl: string | null;
}

interface StoreSearchResponseItem {
  id: number;
  name: string;
  tiny_image?: string;
}

export async function searchSteamApps(
  query: string,
  countryCode = "us",
): Promise<SteamSearchResult[]> {
  const url = new URL(STEAM_STORESEARCH_URL);
  url.searchParams.set("term", query);
  url.searchParams.set("cc", countryCode.toLowerCase());
  url.searchParams.set("l", "english");

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Steam storesearch returned ${res.status} for "${query}".`);
  }

  const body = (await res.json()) as { items?: StoreSearchResponseItem[] };
  return (body.items ?? []).map((item) => ({
    appId: item.id,
    name: item.name,
    imageUrl: item.tiny_image ?? null,
  }));
}
