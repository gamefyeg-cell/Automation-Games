import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role Supabase client. BYPASSES Row Level Security entirely.
 *
 * Server-only: never import this from a Client Component, and never let
 * SUPABASE_SERVICE_ROLE_KEY leak into a NEXT_PUBLIC_* variable. Use this
 * only for trusted server-side code such as the Steam sync worker, cron
 * jobs, and admin API routes that need to write computed products/costs.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from the browser.");
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
