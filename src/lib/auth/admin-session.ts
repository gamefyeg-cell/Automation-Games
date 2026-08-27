import { createHash, timingSafeEqual } from "crypto";

/**
 * Admin gating for a solo-operated tool: one shared password (ADMIN_PASSWORD),
 * not Supabase Auth. There's no per-user account, no email round-trip — you
 * type the password once, get a cookie, done. The cookie holds a SHA-256 hash
 * of the password rather than the password itself, so it isn't a readable
 * copy of the secret if it ever leaks (log, browser devtools, etc).
 *
 * This replaces Supabase Auth + RLS as the authorization boundary for admin
 * routes — admin pages now read via the service-role client
 * (src/lib/supabase/admin.ts) and rely on this cookie check instead of RLS.
 */

export const ADMIN_COOKIE_NAME = "gamefy_admin";

function expectedToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(password).digest("hex");
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminPassword(candidate: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(password);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminCookieValue(): string | null {
  return expectedToken();
}

export function isValidAdminCookie(token: string | undefined | null): boolean {
  const expected = expectedToken();
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
