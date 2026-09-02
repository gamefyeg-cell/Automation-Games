"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Gamepad2,
  Gift,
  Joystick,
  LayoutGrid,
  LogOut,
  Package,
  Search,
  Settings,
  SquareArrowOutUpRight,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Active only on an exact path match (for index-ish routes). */
  exact?: boolean;
}

const STEAM_NAV: NavItem[] = [
  { href: "/admin", label: "Opportunities", icon: TrendingUp, exact: true },
  { href: "/prices", label: "Steam Prices", icon: Search },
  { href: "/admin/games", label: "Steam Games", icon: Gamepad2 },
  { href: "/admin/gift-cards", label: "Gift Cards", icon: Gift },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/settings", label: "Pricing Settings", icon: Settings },
];

const PS_NAV: NavItem[] = [
  { href: "/ps", label: "Opportunities", icon: TrendingUp, exact: true },
  { href: "/ps/prices", label: "PlayStation Prices", icon: Search },
  { href: "/ps/browse", label: "Browse Store", icon: LayoutGrid },
  { href: "/ps/games", label: "PlayStation Games", icon: Joystick },
  { href: "/ps/gift-cards", label: "Gift Cards", icon: Gift },
  { href: "/ps/products", label: "Products", icon: Package },
  { href: "/admin/settings", label: "Pricing Settings", icon: Settings },
];

/**
 * The one sidebar every internal-tool page shares. It switches its nav to
 * match the platform you're in — /ps/* shows the PlayStation tools, every
 * other tool route shows the Steam tools — so PlayStation pages never show
 * up under Steam and vice versa. "Switch platform" goes back to the
 * chooser at /. The public storefront (/store) does NOT render this.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const isPlaystation = pathname === "/ps" || pathname.startsWith("/ps/");
  const nav = isPlaystation ? PS_NAV : STEAM_NAV;

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 p-4">
      <Link href="/" className="mb-1 flex items-center gap-2 px-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">
          G
        </span>
        <span className="text-sm font-semibold tracking-tight text-zinc-50">Gamefy</span>
      </Link>
      <p className="mb-5 px-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        {isPlaystation ? "PlayStation" : "Steam"}
      </p>

      <ul className="space-y-0.5">
        {nav.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
          <ArrowLeftRight className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Switch platform
        </Link>
        <Link
          href="/store"
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
