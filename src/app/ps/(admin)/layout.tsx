import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/auth/admin-session";

// Same admin-password gate as /admin/(protected), for the PlayStation
// tools that read cost/margin data or write to the database. The sidebar
// shell comes from the parent /ps/layout.tsx; this only adds the auth
// check and the page container. /ps/prices and /ps/browse sit outside
// this group and stay public.
export default async function PsAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isValidAdminCookie(token)) redirect("/admin/login");

  return <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>;
}
