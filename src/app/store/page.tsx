import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Uses the anon-key server client, so RLS restricts this query to
// products.published = true automatically — see the "products: public
// read published" policy in supabase/migrations.
//
// When Supabase env vars are missing (a fresh checkout with no .env.local)
// createClient() rejects — catch it so `npm run dev` still serves this
// page instead of a hard crash.
interface StoreProduct {
  id: string;
  title: string;
  image_url: string | null;
  selling_price: number;
  old_price: number | null;
  currency: string;
  platform?: string;
}

export default async function StorefrontPage() {
  const supabase = await createClient().catch(() => null);

  let products: StoreProduct[] | null = null;
  let error: { message?: string } | null = null;

  if (!supabase) {
    error = new Error("Supabase isn't configured — copy .env.example to .env.local.");
  } else {
    const baseCols = "id, title, image_url, selling_price, old_price, currency";
    const run = (cols: string) =>
      supabase
        .from("products")
        .select(cols)
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

    let res = await run(`${baseCols}, platform`);
    // Before the multi_platform migration the `platform` column doesn't
    // exist yet (PostgREST 42703) — fall back to the pre-migration columns.
    if (res.error?.code === "42703") res = await run(baseCols);
    products = (res.data as StoreProduct[] | null) ?? null;
    error = res.error;
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500 text-base font-bold text-white">
          G
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Gamefy</h1>
      </div>
      <p className="mt-3 max-w-lg text-sm text-zinc-400">
        Discounted Steam &amp; PlayStation games, priced by the Gamefy pricing engine.
      </p>
      <Link
        href="/"
        className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
      >
        Open the pricing tools
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>

      {error && (
        <p className="mt-10 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not load products. Is Supabase configured? See .env.example.
        </p>
      )}

      {!error && products?.length === 0 && (
        <p className="mt-10 text-sm text-zinc-500">
          No products published yet. Add games and gift cards, then publish a product from the admin
          dashboard.
        </p>
      )}

      <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((product) => (
          <li key={product.id}>
            <Card className="overflow-hidden transition-colors hover:border-zinc-700">
              {product.image_url && (
                <Image
                  src={product.image_url}
                  alt={product.title}
                  width={400}
                  height={200}
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-medium text-zinc-100">{product.title}</h2>
                  <Badge tone={product.platform === "playstation" ? "accent" : "neutral"}>
                    {product.platform === "playstation" ? "PS" : "Steam"}
                  </Badge>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
                  {product.old_price && (
                    <span className="text-sm text-zinc-500 line-through">
                      {product.old_price} {product.currency}
                    </span>
                  )}
                  <span className="font-semibold text-zinc-50">
                    {product.selling_price} {product.currency}
                  </span>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
