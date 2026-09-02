import Link from "next/link";
import { ArrowRight, Gamepad2, Joystick, Store } from "lucide-react";

// The entry point: pick which storefront's pricing tools to work in.
// Steam tools live at /prices + /admin/*, PlayStation at /ps/*. Each side
// has its own games, gift cards, products and opportunities; the pricing
// rules (Pricing Settings) are shared.
export default function ChooserPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-base font-bold text-white">
          G
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Gamefy</h1>
      </div>
      <p className="mt-3 text-sm text-zinc-400">Which storefront do you want to work on?</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PlatformCard
          href="/prices"
          icon={<Gamepad2 className="h-6 w-6" strokeWidth={1.75} />}
          name="Steam"
          blurb="Regional Steam prices, Steam wallet gift cards, opportunities and products."
        />
        <PlatformCard
          href="/ps/prices"
          icon={<Joystick className="h-6 w-6" strokeWidth={1.75} />}
          name="PlayStation"
          blurb="Regional PlayStation Store prices, PSN wallet gift cards, opportunities and products."
        />
      </div>

      <Link
        href="/store"
        className="mt-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
      >
        <Store className="h-4 w-4" strokeWidth={1.75} />
        View the public storefront
      </Link>
    </main>
  );
}

function PlatformCard({
  href,
  icon,
  name,
  blurb,
}: {
  href: string;
  icon: React.ReactNode;
  name: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 transition-colors hover:border-indigo-500/50 hover:bg-zinc-900"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800 text-indigo-400 group-hover:bg-indigo-500/10">
        {icon}
      </span>
      <span className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-zinc-50">
        {name}
        <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-400" />
      </span>
      <span className="mt-1 text-sm text-zinc-400">{blurb}</span>
    </Link>
  );
}
