"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gamepad2,
  Gift,
  Joystick,
  LogOut,
  Package,
  Search,
  Settings,
  SquareArrowOutUpRight,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Opportunities", icon: TrendingUp },
  { href: "/prices", label: "Steam Prices", icon: Search },
  { href: "/psstore", label: "PlayStation Store", icon: Joystick },
  { href: "/admin/games", label: "Steam Games", icon: Gamepad2 },
  { href: "/admin/gift-cards", label: "Gift Cards", icon: Gift },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/settings", label: "Pricing Settings", icon: Settings },
];

/**
 * The one sidebar every internal-tool page shares — /admin/* (password
 * gated) and /prices (public) both render this, so the whole thing feels
 * like one app instead of scattered pages you have to type URLs for.
 * The public storefront (/) intentionally does NOT use this — that's the
 * customer-facing page, not your tool.
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
      <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">
          G
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-50">Gamefy</span>
      </Link>

      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-indigo-500 bg-zinc-900 text-zinc-50"
                    : "border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-0.5 border-t border-zinc-800 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
        >
          <SquareArrowOutUpRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          View storefront
        </Link>
        <form action="/api/admin/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}
