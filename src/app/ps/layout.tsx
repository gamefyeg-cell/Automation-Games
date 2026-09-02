import { AppSidebar } from "@/components/app-sidebar";

// Shared shell for every /ps/* page. Matches /prices: the sidebar is here
// for all of them, but only the (admin) sub-group inside gates on the
// admin password — /ps/prices and /ps/browse stay public and read-only.
export default function PsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
