import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Supabase client for use in Server Components, Route Handlers and
 * Server Actions. Reads/writes the session via Next.js cookies and is
 * still subject to RLS (anon key) — use for anything that runs on
 * behalf of a signed-in user (including admins).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component with no request context to
            // write to — safe to ignore as long as middleware refreshes
            // the session on every request.
          }
        },
      },
    },
  );
}
