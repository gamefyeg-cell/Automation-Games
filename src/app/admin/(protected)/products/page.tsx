import { Star } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, title, selling_price, cost, profit, profit_margin, currency, published, featured")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Products"
        description="What actually appears on the Gamefy storefront. Publish an opportunity here to make it live."
      />

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
                {p.published ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">Draft</Badge>}
              </Td>
              <Td>
                {p.featured ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </Td>
            </Tr>
          ))}
          {products?.length === 0 && <EmptyRow colSpan={7}>No products yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
