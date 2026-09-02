/**
 * Minimal TypeScript port of the parts of `mrt1m/playstation-store-api`
 * (the PHP library vendored in ./api-play-station-store) that this app
 * actually needs. It's a port, not a wrapper — nothing here shells out to
 * PHP, so `npm run dev` is all you need to run the PlayStation Store page.
 *
 * The PlayStation storefront is a GraphQL API that only accepts
 * *persisted* queries: you don't send the query text, you send an
 * `operationName` plus the sha256 hash of the query PlayStation has on
 * file. Those hashes are lifted from the browser's network panel (see
 * section 6 of api-play-station-store/README.md) and mirror
 * `PlaystationStoreApi\Enum\OperationSha256Enum`. If PlayStation rotates
 * a query and one starts returning `PersistedQueryNotFound`, grab the new
 * hash from store.playstation.com's requests and update it here.
 */

export const PSN_GRAPHQL_URL = "https://web.np.playstation.com/api/graphql/v1/op";

// operationName -> persistedQuery sha256Hash. From OperationSha256Enum.php.
export const PSN_OPERATION_HASH = {
  categoryGridRetrieve: "4ce7d410a4db2c8b635a48c1dcec375906ff63b19dadd87e073f8fd0c0481d35",
  metGetProductById: "a128042177bd93dd831164103d53b73ef790d56f51dae647064cb8f9d9fc9d1a",
  metGetPricingDataByConceptId:
    "abcb311ea830e679fe2b697a27f755764535d825b24510ab1239a4ca3092bd09",
} as const;

export type PsnOperation = keyof typeof PSN_OPERATION_HASH;

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Runs one persisted GraphQL operation against the PlayStation
 * storefront. `region` is a locale code like "en-us" / "tr-tr" (see
 * PSN_REGIONS) — it's sent both as the `x-psn-store-locale-override`
 * header and baked into every price PlayStation returns.
 *
 * Only ever call this from the server (route handlers, server
 * components): PlayStation blocks the browser with CORS, and proxying it
 * keeps the request shape in one place.
 */
export async function psnGraphql<T>(
  operationName: PsnOperation,
  variables: Record<string, unknown>,
  region: string,
  { noStore = false, revalidate = 30 }: { noStore?: boolean; revalidate?: number } = {},
): Promise<T> {
  const url = new URL(PSN_GRAPHQL_URL);
  url.searchParams.set("operationName", operationName);
  url.searchParams.set("variables", JSON.stringify(variables));
  url.searchParams.set(
    "extensions",
    JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: PSN_OPERATION_HASH[operationName] },
    }),
  );

  const res = await fetch(url, {
    headers: {
      "x-psn-store-locale-override": region,
      "content-type": "application/json",
      // PlayStation rejects the request without a store-looking Origin.
      origin: "https://store.playstation.com",
      accept: "application/json",
    },
    // Near-live: cache each response for `revalidate` seconds (30s for the
    // browse grid, longer for the bulk chunks the search scan pulls) so
    // clicking around doesn't hammer PlayStation, while store changes still
    // surface quickly. Next persists this cache to .next/cache, so it
    // survives a dev restart. The page's Refresh button sends noStore.
    ...(noStore ? { cache: "no-store" as const } : { next: { revalidate } }),
  });

  if (!res.ok) {
    throw new Error(
      `PlayStation Store API returned ${res.status} for ${operationName} (${region}).`,
    );
  }

  const body = (await res.json()) as GraphqlEnvelope<T>;
  if (body.errors?.length) {
    throw new Error(
      `PlayStation Store API error for ${operationName}: ${body.errors
        .map((e) => e.message)
        .join("; ")}`,
    );
  }
  if (!body.data) {
    throw new Error(`PlayStation Store API returned no data for ${operationName}.`);
  }
  return body.data;
}

/**
 * Locale codes PlayStation accepts, from `PlaystationStoreApi\Enum\RegionEnum`.
 * Trimmed to the storefronts worth comparing for price arbitrage rather
 * than the full ~120-entry list — add more codes here if you need them.
 */
export const PSN_REGIONS: { code: string; label: string }[] = [
  { code: "en-us", label: "United States" },
  { code: "en-gb", label: "United Kingdom" },
  { code: "de-de", label: "Germany" },
  { code: "fr-fr", label: "France" },
  { code: "es-es", label: "Spain" },
  { code: "it-it", label: "Italy" },
  { code: "pt-pt", label: "Portugal" },
  { code: "pl-pl", label: "Poland" },
  { code: "tr-tr", label: "Turkey" },
  { code: "ru-ru", label: "Russia" },
  { code: "uk-ua", label: "Ukraine" },
  { code: "en-in", label: "India" },
  { code: "pt-br", label: "Brazil" },
  { code: "es-ar", label: "Argentina" },
  { code: "es-mx", label: "Mexico" },
  { code: "en-ca", label: "Canada" },
  { code: "en-au", label: "Australia" },
  { code: "ja-jp", label: "Japan" },
  { code: "ko-kr", label: "South Korea" },
  { code: "en-za", label: "South Africa" },
  { code: "ar-sa", label: "Saudi Arabia" },
  { code: "en-ae", label: "United Arab Emirates" },
];

export const PSN_DEFAULT_REGION = "en-us";

export function isKnownRegion(code: string): boolean {
  return PSN_REGIONS.some((r) => r.code === code);
}
