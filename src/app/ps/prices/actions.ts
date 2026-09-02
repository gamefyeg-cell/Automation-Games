"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/auth/admin-session";
import { syncPsGameRegion } from "@/lib/psn/sync";
import { buildRegionReport } from "@/lib/pricing/report";
import type { SaveRegionResult } from "@/app/prices/actions";

/**
 * "Choose this region" on /ps/prices — the PlayStation counterpart to
 * src/app/prices/actions.ts. Saves the game + this one region into the
 * database (platform = 'playstation') and runs it through the shared
 * gift-card pricing engine against your PSN gift-card inventory.
 *
 * Needs the admin cookie: viewing PlayStation prices is public and
 * read-only, but writing to the database isn't.
 */
export async function savePsGameRegionAndReport(
  input: { conceptId: string; name: string; imageUrl: string | null },
  countryCode: string,
): Promise<SaveRegionResult> {
  const cookieStore = await cookies();
  if (!isValidAdminCookie(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return { ok: false, message: "Log in to /admin first — saving a game requires that." };
  }

  const sync = await syncPsGameRegion(input, countryCode);
  if (
    !sync.ok ||
    sync.currentPrice === undefined ||
    sync.originalPrice === undefined ||
    sync.discountPercent === undefined ||
    !sync.currency ||
    !sync.gameId ||
    !sync.gameRegionId
  ) {
    return { ok: false, message: sync.error ?? "Failed to save this region." };
  }

  const savedPrefix = `Saved ${sync.gameName} (${sync.countryCode}).`;

  const reportResult = await buildRegionReport({
    platform: "playstation",
    gameId: sync.gameId,
    gameRegionId: sync.gameRegionId,
    imageUrl: sync.imageUrl ?? null,
    gameName: sync.gameName ?? "Unknown game",
    countryCode: sync.countryCode,
    originalPrice: sync.originalPrice,
    currentPrice: sync.currentPrice,
    discountPercent: sync.discountPercent,
    currency: sync.currency,
  });

  if (!reportResult.ok || !reportResult.report) {
    return { ok: true, message: `${savedPrefix} ${reportResult.message}` };
  }
  return { ok: true, message: savedPrefix, report: reportResult.report };
}
