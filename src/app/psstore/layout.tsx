import { AppSidebar } from "@/components/app-sidebar";

// Public, like /prices — it only reads PlayStation's own storefront (see
// src/app/api/psstore) — but it shares the admin sidebar shell so the
// whole internal tool feels like one app.
export default function PsStoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
