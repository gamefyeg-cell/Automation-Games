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

const REQUIRED_COLUMNS = ["provider", "product_name", "value", "purchase_price"];

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

  const header = splitDelimited(lines[0], delimiter).map((h) => h.trim().toLowerCase());
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) {
      throw new Error(
        `Missing required column "${col}". Header must include: ${REQUIRED_COLUMNS.join(", ")}.`,
      );
    }
  }

  return lines.slice(1).map((line, i) => {
    const cells = splitDelimited(line, delimiter);
    const get = (name: string): string | undefined => {
      const col = header.indexOf(name);
      return col === -1 ? undefined : cells[col]?.trim();
    };

    const provider = get("provider");
    const value = Number(get("value"));
    const purchasePrice = Number(get("purchase_price"));

    if (!provider) throw new Error(`Row ${i + 2}: missing provider.`);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Row ${i + 2}: invalid value.`);
    }
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      throw new Error(`Row ${i + 2}: invalid purchase_price.`);
    }

    const activeRaw = get("active");
    const active =
      activeRaw === undefined || activeRaw === "" ? true : /^(1|true|yes|y)$/i.test(activeRaw);

    return {
      provider,
      product_name: get("product_name") || provider,
      value,
      value_currency: get("value_currency") || "USD",
      region: get("region") || null,
      purchase_price: purchasePrice,
      fees: Number(get("fees")) || 0,
      purchase_currency: get("purchase_currency") || "EGP",
      active,
    };
  });
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
