import type { Platform } from "@/lib/supabase/database.types";

interface PgResult<Row> {
  data: Row[] | null;
  error: { code?: string; message?: string } | null;
}

/**
 * Keeps platform-filtered reads correct in the window BEFORE the
 * multi_platform migration has been applied to the database. If the
 * `platform` column doesn't exist yet, PostgREST answers with error code
 * 42703 (undefined_column); every existing row is then implicitly Steam,
 * so a Steam query re-runs unfiltered and a PlayStation query returns [].
 *
 * Pass the SAME query twice — once already `.eq("platform", platform)`-
 * filtered, and a factory that rebuilds it without that filter:
 *
 *   await withPlatformFallback(
 *     supabase.from("x").select("...").eq("platform", p).order("y"),
 *     () => supabase.from("x").select("...").order("y"),
 *     p,
 *   )
 */
export async function withPlatformFallback<Row>(
  filtered: PromiseLike<PgResult<Row>>,
  unfiltered: () => PromiseLike<PgResult<Row>>,
  platform: Platform,
): Promise<PgResult<Row>> {
  const res = await filtered;
  if (res.error && isMissingPlatformColumn(res.error)) {
    return platform === "steam" ? unfiltered() : { data: [], error: null };
  }
  return res;
}

function isMissingPlatformColumn(error: { code?: string; message?: string }): boolean {
  return error.code === "42703" || /column .*platform.* does not exist/i.test(error.message ?? "");
}
