/**
 * A gift card that funds a specific region's Steam wallet only works for
 * that region — a "$20 US" code doesn't top up an Indian-wallet account.
 * `gift_cards.region` is free text (whatever the supplier calls it, e.g.
 * "EGYPT"), while `game_regions.country_code` is the ISO code Steam uses
 * (e.g. "EG"). This maps between them so the pricing engine can tell
 * whether a card is actually usable for a given region instead of
 * treating every active card as interchangeable.
 */
export const COUNTRY_NAMES: Record<string, string> = {
  US: "UNITED STATES",
  GB: "UNITED KINGDOM",
  DE: "GERMANY",
  FR: "FRANCE",
  ES: "SPAIN",
  IT: "ITALY",
  CA: "CANADA",
  AU: "AUSTRALIA",
  JP: "JAPAN",
  CN: "CHINA",
  BR: "BRAZIL",
  MX: "MEXICO",
  PL: "POLAND",
  TR: "TURKEY",
  UA: "UKRAINE",
  IN: "INDIA",
  EG: "EGYPT",
};

/**
 * A gift card with no region set is treated as unrestricted (a global
 * USD/EUR wallet code, for instance) — usable for any region. A gift
 * card *with* a region only matches that one region, by ISO code or by
 * name (either direction, case-insensitive).
 */
export function giftCardMatchesRegion(countryCode: string, giftCardRegion: string | null): boolean {
  if (!giftCardRegion) return true;

  const code = countryCode.trim().toUpperCase();
  const region = giftCardRegion.trim().toUpperCase();
  const name = COUNTRY_NAMES[code];

  return region === code || (name !== undefined && region === name);
}
