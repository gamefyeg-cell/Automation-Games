"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";

export interface ImportState {
  ok: boolean;
  message: string;
}

export interface MutationResult {
  ok: boolean;
  message?: string;
}

export interface SellableGiftCardPatch {
  region?: string;
  card_name?: string;
  cost?: number;
  selling_price?: number;
  currency?: string;
  active?: boolean;
}

export interface ParsedSellableGiftCard {
  region: string;
  card_name: string;
  cost: number;
  selling_price: number;
  currency: string;
  active: boolean;
}

function readPlatform(formData: FormData): Platform {
  return String(formData.get("platform") ?? "") === "playstation" ? "playstation" : "steam";
}

function sellGiftCardsPath(platform: Platform): string {
  return platform === "playstation" ? "/ps/sell-gift-cards" : "/admin/sell-gift-cards";
}

/**
 * Adds a single retail gift card manually.
 */
export async function addSellableGiftCard(
  _prevState: ImportState | null,
  formData: FormData,
): Promise<ImportState> {
  const get = (name: string) => String(formData.get(name) ?? "").trim();

  const region = get("region");
  const cardName = get("card_name");
  const cost = Number(get("cost"));
  const sellingPrice = Number(get("selling_price"));
  const currency = (get("currency") || "EGP").toUpperCase();

  if (!region) return { ok: false, message: "Region is required." };
  if (!cardName) return { ok: false, message: "Card name is required." };
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, message: "Your cost must be a non-negative number." };
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    return { ok: false, message: "Recommended price must be a non-negative number." };
  }

  const platform = readPlatform(formData);
  const supabase = createAdminClient();

  const { error } = await supabase.from("sellable_gift_cards").insert({
    platform,
    region,
    card_name: cardName,
    cost,
    selling_price: sellingPrice,
    currency,
    active: formData.get("active") !== null,
  });

  if (error) {
    if (error.code === "42P01") {
      return {
        ok: false,
        message:
          "Database table 'sellable_gift_cards' does not exist yet. Please run migration 20260915180000_sellable_gift_cards.sql in your Supabase SQL editor.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(sellGiftCardsPath(platform));
  return { ok: true, message: `Added ${region} — ${cardName} successfully.` };
}

/**
 * Updates a single retail gift card (inline editing).
 */
export async function updateSellableGiftCard(
  id: string,
  platform: Platform,
  patch: SellableGiftCardPatch,
): Promise<MutationResult> {
  const clean: SellableGiftCardPatch = {};

  if (patch.region !== undefined) {
    const region = patch.region.trim();
    if (!region) return { ok: false, message: "Region cannot be empty." };
    clean.region = region;
  }
  if (patch.card_name !== undefined) {
    const cardName = patch.card_name.trim();
    if (!cardName) return { ok: false, message: "Card name cannot be empty." };
    clean.card_name = cardName;
  }
  if (patch.cost !== undefined) {
    if (!Number.isFinite(patch.cost) || patch.cost < 0) {
      return { ok: false, message: "Cost must be a non-negative number." };
    }
    clean.cost = patch.cost;
  }
  if (patch.selling_price !== undefined) {
    if (!Number.isFinite(patch.selling_price) || patch.selling_price < 0) {
      return { ok: false, message: "Recommended price must be a non-negative number." };
    }
    clean.selling_price = patch.selling_price;
  }
  if (patch.currency !== undefined) {
    clean.currency = patch.currency.trim().toUpperCase() || "EGP";
  }
  if (patch.active !== undefined) {
    clean.active = patch.active;
  }

  if (Object.keys(clean).length === 0) return { ok: true };

  const supabase = createAdminClient();
  const { error } = await supabase.from("sellable_gift_cards").update(clean).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath(sellGiftCardsPath(platform));
  return { ok: true };
}

/**
 * Deletes a single retail gift card.
 */
export async function deleteSellableGiftCard(
  id: string,
  platform: Platform,
): Promise<MutationResult> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sellable_gift_cards").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath(sellGiftCardsPath(platform));
  return { ok: true };
}

/**
 * Bulk-deletes retail gift cards.
 */
export async function deleteSellableGiftCards(
  ids: string[],
  platform: Platform,
): Promise<MutationResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = createAdminClient();
  const { error } = await supabase.from("sellable_gift_cards").delete().in("id", ids);
  if (error) return { ok: false, message: error.message };

  revalidatePath(sellGiftCardsPath(platform));
  return { ok: true };
}

/**
 * Bulk-imports retail gift cards from pasted/uploaded CSV or Excel text.
 */
export async function importSellableGiftCardsCsv(
  _prevState: ImportState | null,
  formData: FormData,
): Promise<ImportState> {
  const raw = String(formData.get("csv") ?? "").trim();
  if (!raw) return { ok: false, message: "Paste or upload some rows first." };

  const platform = readPlatform(formData);

  let rows: ParsedSellableGiftCard[];
  try {
    rows = parseSellableGiftCardRows(raw);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  if (rows.length === 0) return { ok: false, message: "No data rows found." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sellable_gift_cards")
    .insert(rows.map((r) => ({ ...r, platform })));

  if (error) {
    if (error.code === "42P01") {
      return {
        ok: false,
        message:
          "Database table 'sellable_gift_cards' does not exist yet. Please run migration 20260915180000_sellable_gift_cards.sql in your Supabase SQL editor.",
      };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath(sellGiftCardsPath(platform));
  return {
    ok: true,
    message: `Imported ${rows.length} gift card${rows.length === 1 ? "" : "s"} successfully.`,
  };
}

// ---------------------------------------------------------------------------
// CSV / TSV / Excel parser with flexible header matching
// ---------------------------------------------------------------------------

const HEADER_ALIASES = {
  region: ["region", "country", "country_code", "store", "market"],
  card_name: [
    "card",
    "card_name",
    "card name",
    "product",
    "product_name",
    "product name",
    "item",
    "denomination",
    "title",
  ],
  cost: [
    "your cost",
    "your_cost",
    "cost",
    "our cost",
    "our_cost",
    "purchase price",
    "purchase_price",
    "buy price",
    "buy_price",
  ],
  selling_price: [
    "recommended price",
    "recommended_price",
    "recommended",
    "rec price",
    "rec_price",
    "selling price",
    "selling_price",
    "sell price",
    "sell_price",
    "retail price",
    "retail_price",
    "price",
  ],
  profit: ["profit", "margin"],
  currency: ["currency", "curr"],
  active: ["active", "status"],
} as const satisfies Record<string, readonly string[]>;

type CanonicalColumn = keyof typeof HEADER_ALIASES;

function cleanNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  // Remove currency signs, commas, extra whitespace
  const cleaned = raw.replace(/[$€£¥₺₴₹₪A-Za-z]/g, "").replace(/,/g, "").trim();
  return Number(cleaned);
}

function buildColumnIndex(headerRow: string[]): Partial<Record<CanonicalColumn, number>> {
  const normalized = headerRow.map((h) => h.trim().toLowerCase());
  const index: Partial<Record<CanonicalColumn, number>> = {};
  for (const canonical of Object.keys(HEADER_ALIASES) as CanonicalColumn[]) {
    const col = normalized.findIndex((h) =>
      (HEADER_ALIASES[canonical] as readonly string[]).includes(h),
    );
    if (col !== -1) index[canonical] = col;
  }
  return index;
}

function parseSellableGiftCardRows(text: string): ParsedSellableGiftCard[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Spreadsheet needs a header row plus at least one data row.");
  }

  const commaCount = (lines[0].match(/,/g) ?? []).length;
  const tabCount = (lines[0].match(/\t/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  const scanLimit = Math.min(lines.length - 1, 10);
  let headerRowIndex = -1;
  let colIndex: Partial<Record<CanonicalColumn, number>> = {};

  for (let i = 0; i < scanLimit; i++) {
    const candidate = buildColumnIndex(splitDelimited(lines[i], delimiter));
    // We need at least Region and Card, plus either (Cost and Price) OR (Cost and Profit) OR (Price and Profit)
    const hasRegion = candidate.region !== undefined;
    const hasCard = candidate.card_name !== undefined;
    const hasPricing =
      (candidate.cost !== undefined && candidate.selling_price !== undefined) ||
      (candidate.cost !== undefined && candidate.profit !== undefined) ||
      (candidate.selling_price !== undefined && candidate.profit !== undefined);

    if (hasRegion && hasCard && hasPricing) {
      headerRowIndex = i;
      colIndex = candidate;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'Could not detect header columns. Please include "Region", "Card", "Your Cost", and "Recommended Price" (or "Profit").',
    );
  }

  return lines
    .slice(headerRowIndex + 1)
    .map((line, i) => {
      const cells = splitDelimited(line, delimiter);
      if (cells.every((c) => c.trim() === "")) return null;

      // Skip repeated header row
      const candidate = buildColumnIndex(cells);
      if (candidate.region !== undefined && candidate.card_name !== undefined) {
        return null;
      }

      return parseRow(cells, colIndex, i);
    })
    .filter((row): row is ParsedSellableGiftCard => row !== null);
}

function parseRow(
  cells: string[],
  colIndex: Partial<Record<CanonicalColumn, number>>,
  rowIndex: number,
): ParsedSellableGiftCard {
  const get = (name: CanonicalColumn): string | undefined => {
    const col = colIndex[name];
    return col === undefined ? undefined : cells[col]?.trim();
  };

  const region = get("region");
  if (!region) throw new Error(`Row ${rowIndex + 1}: missing Region.`);

  const cardName = get("card_name");
  if (!cardName) throw new Error(`Row ${rowIndex + 1}: missing Card.`);

  const rawCost = cleanNumber(get("cost"));
  const rawPrice = cleanNumber(get("selling_price"));
  const rawProfit = cleanNumber(get("profit"));

  let cost = rawCost;
  let sellingPrice = rawPrice;

  // Infer missing cost or price if profit was given
  if (!Number.isFinite(sellingPrice) && Number.isFinite(cost) && Number.isFinite(rawProfit)) {
    sellingPrice = cost + rawProfit;
  } else if (!Number.isFinite(cost) && Number.isFinite(sellingPrice) && Number.isFinite(rawProfit)) {
    cost = sellingPrice - rawProfit;
  }

  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error(`Row ${rowIndex + 1} (${cardName}): invalid Your Cost.`);
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new Error(`Row ${rowIndex + 1} (${cardName}): invalid Recommended Price.`);
  }

  const rawCurrency = get("currency");
  const currency = rawCurrency ? rawCurrency.toUpperCase() : "EGP";

  const activeRaw = get("active");
  const active =
    activeRaw === undefined || activeRaw === "" ? true : /^(1|true|yes|y|active)$/i.test(activeRaw);

  return {
    region,
    card_name: cardName,
    cost,
    selling_price: sellingPrice,
    currency,
    active,
  };
}

function splitDelimited(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.replace(/^"|"$/g, ""));
}
