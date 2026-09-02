/**
 * PlayStation price-comparison regions. Mirrors src/lib/steam/regions.ts
 * but PlayStation addresses a storefront by a *locale* code (e.g. "tr-tr")
 * rather than Steam's bare country code ("tr"), and PlayStation has no
 * store in some countries Steam sells in (Egypt, for one).
 *
 * `countryCode` is ISO 3166-1 alpha-2, uppercase — the same convention as
 * `game_regions.country_code` and what `giftCardMatchesRegion` expects, so
 * a PSN wallet gift card tagged "TR" / "TURKEY" lines up with the Turkey
 * price automatically.
 */

// Re-exported: the ISO-code / country-name gift-card matcher is storefront
// agnostic, so PlayStation reuses Steam's rather than keeping a second copy.
export { giftCardMatchesRegion, COUNTRY_NAMES } from "@/lib/steam/regions";

export interface PsnRegion {
  countryCode: string;
  locale: string;
  label: string;
}

export const PSN_PRICE_REGIONS: PsnRegion[] = [
  { countryCode: "US", locale: "en-us", label: "United States" },
  { countryCode: "GB", locale: "en-gb", label: "United Kingdom" },
  { countryCode: "DE", locale: "de-de", label: "Germany" },
  { countryCode: "FR", locale: "fr-fr", label: "France" },
  { countryCode: "IT", locale: "it-it", label: "Italy" },
  { countryCode: "ES", locale: "es-es", label: "Spain" },
  { countryCode: "PL", locale: "pl-pl", label: "Poland" },
  { countryCode: "TR", locale: "tr-tr", label: "Turkey" },
  { countryCode: "UA", locale: "uk-ua", label: "Ukraine" },
  { countryCode: "IN", locale: "en-in", label: "India" },
  { countryCode: "BR", locale: "pt-br", label: "Brazil" },
  { countryCode: "AR", locale: "es-ar", label: "Argentina" },
  { countryCode: "MX", locale: "es-mx", label: "Mexico" },
  { countryCode: "CA", locale: "en-ca", label: "Canada" },
  { countryCode: "ZA", locale: "en-za", label: "South Africa" },
  { countryCode: "SA", locale: "ar-sa", label: "Saudi Arabia" },
  { countryCode: "AE", locale: "en-ae", label: "United Arab Emirates" },
  { countryCode: "JP", locale: "ja-jp", label: "Japan" },
  { countryCode: "KR", locale: "ko-kr", label: "South Korea" },
  { countryCode: "HK", locale: "en-hk", label: "Hong Kong" },
  { countryCode: "ID", locale: "en-id", label: "Indonesia" },
  { countryCode: "TH", locale: "th-th", label: "Thailand" },
];

export const PSN_DEFAULT_PRICE_REGION_CODES = PSN_PRICE_REGIONS.map((r) => r.countryCode);

export function psnRegionByCountry(countryCode: string): PsnRegion | undefined {
  const cc = countryCode.trim().toUpperCase();
  return PSN_PRICE_REGIONS.find((r) => r.countryCode === cc);
}

/**
 * PlayStation's price object carries both an integer `basePriceValue` and
 * a localized display string ("$69.99", "Rs 4,999", "Rp 1,142,190",
 * "¥8,690", "2.799,00 TL"). The integer is in *cents* for some currencies
 * (USD 6999 -> 69.99) but in whole units for others (INR 4999 -> ₹4,999,
 * JPY 8690 -> ¥8,690, KRW, IDR...) — and it's not the ISO minor-unit list.
 *
 * So: parse the numeric value out of the display string, work out the
 * divisor (1 or 100) by comparing it to the integer, and apply that same
 * divisor to both base and discounted values. Falls back to the integer
 * as-is if the string can't be parsed.
 */
export function psnPriceDivisor(displayString: string | null | undefined, value: number): number {
  const parsed = parseLocalizedNumber(displayString ?? "");
  if (parsed === null || parsed === 0) return value > 10000 ? 100 : 1;
  return Math.round(value / parsed) >= 50 ? 100 : 1;
}

function parseLocalizedNumber(raw: string): number | null {
  // Keep only digits and separators; spaces are used as thousands grouping.
  let s = raw.replace(/[^0-9.,\s]/g, "").replace(/\s+/g, "").trim();
  if (!s) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep = "";
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma !== -1) {
    decimalSep = s.length - lastComma - 1 === 2 && s.indexOf(",") === lastComma ? "," : "";
  } else if (lastDot !== -1) {
    decimalSep = s.length - lastDot - 1 === 2 && s.indexOf(".") === lastDot ? "." : "";
  }

  if (decimalSep === ",") s = s.replace(/\./g, "").replace(",", ".");
  else if (decimalSep === ".") s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
