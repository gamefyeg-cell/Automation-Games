"use server";

import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/auth/admin-session";
import { syncSteamGameRegion } from "@/lib/steam/sync";
import { buildRegionReport, type RegionReport } from "@/lib/pricing/report";

export interface SaveRegionResult {
  ok: boolean;
  message: string;
  report?: RegionReport;
}

/**
 * "Choose this region" on /prices: saves the game + this one region into
 * the database (so it shows up on /admin/games and survives a page
 * refresh) and runs it through the gift-card pricing engine, returning a
 * full itemized breakdown (see src/lib/pricing/report.ts) — not just a
 * total — of exactly how the cost and selling price were derived.
 *
 * Requires the admin cookie even though /prices itself is public —
 * viewing prices is free and read-only, but writing to the database
 * isn't. If you're not logged in, this fails with a clear message
 * instead of silently doing nothing.
 */
export async function saveGameRegionAndReport(
  steamAppId: number,
  countryCode: string,
): Promise<SaveRegionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminCookie(token)) {
    return { ok: false, message: "Log in to /admin first — saving a game requires that." };
  }

  const sync = await syncSteamGameRegion(steamAppId, countryCode);
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

  const savedPrefix = `Saved ${sync.gameName} (${sync.countryCode.toUpperCase()}).`;

  const reportResult = await buildRegionReport({
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

  // The save itself always succeeded at this point — a missing report
  // (no matching gift cards, no pricing_settings, etc) is a separate,
  // non-fatal condition, so this still reports ok:true with an
  // explanation rather than treating it as a failure.
  if (!reportResult.ok || !reportResult.report) {
    return { ok: true, message: `${savedPrefix} ${reportResult.message}` };
  }

  return { ok: true, message: savedPrefix, report: reportResult.report };
}
