import { ChevronDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { GiftCardAddForm } from "./add-form";
import { GiftCardImportForm } from "./import-form";

export default async function AdminGiftCardsPage() {
  const supabase = createAdminClient();
  const { data: giftCards } = await supabase
    .from("gift_cards")
    .select("*")
    .order("provider", { ascending: true })
    .order("value", { ascending: true });

  return (
    <div>
      <PageHeader title="Gift Cards" description="Your supply side — what it costs to fund a Steam purchase." />

      <GiftCardAddForm />

      <details className="group mt-4">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Got a lot of cards at once? Import from CSV/Excel instead
        </summary>
        <GiftCardImportForm />
      </details>

      <div className="mt-8">
        <Table>
          <Thead>
            <tr>
              <Th>Provider</Th>
              <Th align="right">Value</Th>
              <Th align="right">Purchase Price</Th>
              <Th align="right">Fees</Th>
              <Th align="right">Total Cost</Th>
              <Th>Active</Th>
            </tr>
          </Thead>
          <tbody>
            {giftCards?.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <span className="font-medium text-zinc-100">{c.provider}</span>
                </Td>
                <Td align="right">
                  {c.value} {c.value_currency}
                </Td>
                <Td align="right" muted>
                  {c.purchase_price} {c.purchase_currency}
                </Td>
                <Td align="right" muted>
                  {c.fees} {c.purchase_currency}
                </Td>
                <Td align="right">
                  {c.total_cost} {c.purchase_currency}
                </Td>
                <Td>
                  {c.active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
                </Td>
              </Tr>
            ))}
            {giftCards?.length === 0 && <EmptyRow colSpan={6}>No gift cards yet.</EmptyRow>}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
