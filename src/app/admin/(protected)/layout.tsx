import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/auth/admin-session";
import { AppSidebar } from "@/components/app-sidebar";

// Every /admin/* route (other than /admin/login itself, which lives
// outside this route group) requires the ADMIN_COOKIE_NAME cookie set by
// POST /api/admin/login — see src/lib/auth/admin-session.ts. This is a
// single shared password, not a per-user Supabase account: admin data
// reads below use the service-role client and rely on this check as the
// authorization boundary instead of Supabase Auth + RLS.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminCookie(token)) redirect("/admin/login");

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
