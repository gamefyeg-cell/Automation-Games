import { AppSidebar } from "@/components/app-sidebar";

// No password gate here — /prices stays public (see src/app/api/steam-price
// and src/app/api/steam-search) — but it shares the same sidebar shell as
// /admin so the whole tool feels like one app.
export default function PricesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
