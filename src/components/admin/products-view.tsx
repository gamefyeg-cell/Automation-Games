import { Star } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { PublishedToggle } from "@/app/admin/(protected)/products/published-toggle";
import {
  SyncWebButton,
  SyncAllWebButton,
} from "@/app/admin/(protected)/products/sync-web-button";

const COPY: Record<Platform, string> = {
  steam:
    "What actually appears on the Gamefy storefront. Publish an opportunity from Opportunities or Steam Prices to create one — click Published/Draft here to toggle visibility, or push directly to your live Gamefy store.",
  playstation:
    "What actually appears on the Gamefy storefront. Publish an opportunity from Opportunities or PlayStation Prices to create one — click Published/Draft here to toggle visibility, or push directly to your live Gamefy store.",
};

export async function ProductsView({ platform }: { platform: Platform }) {
  const supabase = createAdminClient();
  const COLS =
    "id, title, selling_price, cost, profit, profit_margin, currency, published, featured";
  const { data: products } = await withPlatformFallback(
    supabase.from("products").select(COLS).eq("platform", platform).order("created_at", { ascending: false }),
    () => supabase.from("products").select(COLS).order("created_at", { ascending: false }),
    platform,
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Products" description={COPY[platform]} />
        <div className="shrink-0">
          <SyncAllWebButton platform={platform} />
        </div>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Title</Th>
            <Th align="right">Cost</Th>
            <Th align="right">Sell</Th>
            <Th align="right">Profit</Th>
            <Th align="right">Margin</Th>
            <Th>Status</Th>
            <Th>Featured</Th>
            <Th className="text-right">Gamefy Web</Th>
          </tr>
        </Thead>
        <tbody>
          {products?.map((p) => (
            <Tr key={p.id}>
              <Td>
                <span className="font-medium text-zinc-100">{p.title}</span>
              </Td>
              <Td align="right" muted>
                {p.cost} {p.currency}
              </Td>
              <Td align="right">
                {p.selling_price} {p.currency}
              </Td>
              <Td align="right" muted>
                {p.profit}
              </Td>
              <Td align="right" muted>
                {(p.profit_margin * 100).toFixed(1)}%
              </Td>
              <Td>
                <PublishedToggle id={p.id} published={p.published} />
              </Td>
              <Td>
                {p.featured ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </Td>
              <Td align="right">
                <SyncWebButton productId={p.id} title={p.title} />
              </Td>
            </Tr>
          ))}
          {products?.length === 0 && <EmptyRow colSpan={8}>No products yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
