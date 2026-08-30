"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ImportState {
  ok: boolean;
  message: string;
}

/**
 * Adds a single gift card by hand — the simple path for "I just want to
 * add the one card I bought", no CSV needed.
 */
export async function addGiftCard(
  _prevState: ImportState | null,
  formData: FormData,
): Promise<ImportState> {
  const get = (name: string) => String(formData.get(name) ?? "").trim();

  const provider = get("provider");
  const value = Number(get("value"));
  const purchasePrice = Number(get("purchase_price"));

  if (!provider) return { ok: false, message: "Provider is required." };
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Value must be a positive number." };
  }
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    return { ok: false, message: "Purchase price must be a non-negative number." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("gift_cards").insert({
    provider,
    product_name: get("product_name") || provider,
    value,
    value_currency: get("value_currency") || "USD",
    region: get("region") || null,
    purchase_price: purchasePrice,
    fees: Number(get("fees")) || 0,
    purchase_currency: get("purchase_currency") || "EGP",
    active: formData.get("active") !== null,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/gift-cards");
  return { ok: true, message: `Added ${provider} — ${value} ${get("value_currency") || "USD"}.` };
}

interface ParsedGiftCard {
  provider: string;
  product_name: string;
  value: number;
  value_currency: string;
  region: string | null;
  purchase_price: number;
  fees: number;
  purchase_currency: string;
  active: boolean;
}

/**
 * Bulk-imports gift cards from pasted/uploaded CSV or TSV (e.g. an Excel
 * export). Runs via the service-role client — reachable only through the
 * (protected) admin layout's password-cookie check.
 */
export async function importGiftCardsCsv(
  _prevState: ImportState | null,
  formData: FormData,
): Promise<ImportState> {
  const raw = String(formData.get("csv") ?? "").trim();
  if (!raw) return { ok: false, message: "Paste or upload some rows first." };

  let rows: ParsedGiftCard[];
  try {
    rows = parseGiftCardRows(raw);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  if (rows.length === 0) return { ok: false, message: "No data rows found." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("gift_cards").insert(rows);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/gift-cards");
  return {
    ok: true,
    message: `Imported ${rows.length} gift card${rows.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Real-world spreadsheets don't use our column names — a reseller's own
 * sheet might have "Product"/"Country"/"Price" instead of
 * "product_name"/"region"/"purchase_price", plus extra computed columns
 * (a suggested markup %, a final price, a supplier link) we don't need.
 * Recognize common aliases instead of forcing a reformat; unrecognized
 * columns are simply ignored.
 */
const HEADER_ALIASES = {
  provider: ["provider", "supplier"],
  product_name: ["product_name", "product name", "product"],
  value: ["value", "denomination", "amount", "face value"],
  value_currency: ["value_currency", "value currency", "currency"],
  purchase_price: ["purchase_price", "purchase price", "price", "cost"],
  fees: ["fees", "fee"],
  purchase_currency: ["purchase_currency", "purchase currency"],
  region: ["region", "country"],
  active: ["active"],
} as const satisfies Record<string, readonly string[]>;

type CanonicalColumn = keyof typeof HEADER_ALIASES;
const REQUIRED_COLUMNS: CanonicalColumn[] = ["provider", "value", "purchase_price"];

/** Currency symbol -> ISO code, for cells like "1$" or "€5" or "50 UAH". */
const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "CNY",
  "₺": "TRY",
  "₴": "UAH",
  "₹": "INR",
  "₪": "ILS",
};

/** Parses cells like "1$", "€5", "50 UAH", "5 CNY", or a bare "50". */
function parseValueCell(raw: string): { amount: number; currency: string | null } {
  const trimmed = raw.trim();
  const toNumber = (s: string) => Number(s.replace(/,/g, ""));

  let m = trimmed.match(/^([$€£¥₺₴₹₪])\s*([\d.,]+)$/);
  if (m) return { amount: toNumber(m[2]), currency: CURRENCY_SYMBOLS[m[1]] };

  m = trimmed.match(/^([\d.,]+)\s*([$€£¥₺₴₹₪])$/);
  if (m) return { amount: toNumber(m[1]), currency: CURRENCY_SYMBOLS[m[2]] };

  m = trimmed.match(/^([\d.,]+)\s*([A-Za-z]{2,4})$/);
  if (m) return { amount: toNumber(m[1]), currency: m[2].toUpperCase() };

  m = trimmed.match(/^([\d.,]+)$/);
  if (m) return { amount: toNumber(m[1]), currency: null };

  return { amount: NaN, currency: null };
}

function buildColumnIndex(headerRow: string[]): Partial<Record<CanonicalColumn, number>> {
  const normalized = headerRow.map((h) => h.trim().toLowerCase());
  const index: Partial<Record<CanonicalColumn, number>> = {};
  for (const canonical of Object.keys(HEADER_ALIASES) as CanonicalColumn[]) {
    const col = normalized.findIndex((h) => (HEADER_ALIASES[canonical] as readonly string[]).includes(h));
    if (col !== -1) index[canonical] = col;
  }
  return index;
}

function parseGiftCardRows(text: string): ParsedGiftCard[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Need a header row plus at least one data row.");
  }

  const commaCount = (lines[0].match(/,/g) ?? []).length;
  const tabCount = (lines[0].match(/\t/g) ?? []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

  // Real spreadsheets often have a title/banner row above the real
  // headers (a merged "Gift Card" cell spanning the sheet, in one that
  // was reported) — sheet_to_csv turns that into a non-blank first line,
  // so don't assume line 0 is the header. Scan for the first line that
  // actually contains every required column.
  const scanLimit = Math.min(lines.length - 1, 10);
  let headerRowIndex = -1;
  let colIndex: Partial<Record<CanonicalColumn, number>> = {};
  for (let i = 0; i < scanLimit; i++) {
    const candidate = buildColumnIndex(splitDelimited(lines[i], delimiter));
    if (REQUIRED_COLUMNS.every((col) => candidate[col] !== undefined)) {
      headerRowIndex = i;
      colIndex = candidate;
      break;
    }
  }

  if (headerRowIndex === -1) {
    const missing = REQUIRED_COLUMNS.filter(
      (col) => buildColumnIndex(splitDelimited(lines[0], delimiter))[col] === undefined,
    );
    throw new Error(
      `Couldn't find a header row with ${missing
        .map((col) => `"${col}" (${HEADER_ALIASES[col].join(", ")})`)
        .join(" and ")} in the first ${scanLimit} row${scanLimit === 1 ? "" : "s"}.`,
    );
  }

  return lines
    .slice(headerRowIndex + 1)
    .map((line, i) => {
      const cells = splitDelimited(line, delimiter);

      // Spreadsheet exports often use blank rows as visual separators
      // between groups (e.g. one block per country) — sheet_to_csv turns
      // those into a line of bare commas, not a truly empty string, so
      // they survive the earlier blank-line filter. Skip them here
      // instead of erroring on a "row" with no data in it.
      if (cells.every((c) => c.trim() === "")) return null;

      return parseRow(cells, colIndex, i);
    })
    .filter((row): row is ParsedGiftCard => row !== null);
}

function parseRow(
  cells: string[],
  colIndex: Partial<Record<CanonicalColumn, number>>,
  i: number,
): ParsedGiftCard {
  const get = (name: CanonicalColumn): string | undefined => {
    const col = colIndex[name];
    return col === undefined ? undefined : cells[col]?.trim();
  };

  const provider = get("provider");
  if (!provider) throw new Error(`Data row ${i + 1}: missing provider.`);

  const rawValue = get("value");
  if (!rawValue) throw new Error(`Data row ${i + 1}: missing value.`);
  const parsedValue = parseValueCell(rawValue);
  if (!Number.isFinite(parsedValue.amount) || parsedValue.amount <= 0) {
    throw new Error(`Data row ${i + 1}: couldn't read value "${rawValue}".`);
  }

  const purchasePrice = Number(get("purchase_price"));
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
    throw new Error(`Data row ${i + 1}: invalid purchase price.`);
  }

  const activeRaw = get("active");
  const active =
    activeRaw === undefined || activeRaw === "" ? true : /^(1|true|yes|y)$/i.test(activeRaw);

  return {
    provider,
    product_name: get("product_name") || provider,
    value: parsedValue.amount,
    value_currency: (get("value_currency") || parsedValue.currency || "USD").toUpperCase(),
    region: get("region") || null,
    purchase_price: purchasePrice,
    fees: Number(get("fees")) || 0,
    purchase_currency: get("purchase_currency") || "EGP",
    active,
  };
}

/** Minimal CSV/TSV tokenizer: quoted fields keep embedded delimiters. */
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
