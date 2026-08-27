import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";

export default async function AdminGamesPage() {
  const supabase = createAdminClient();
  const { data: regions } = await supabase
    .from("game_regions")
    .select(
      "id, country_code, currency, original_price, current_price, discount_percent, sale_active, games(name)",
    )
    .order("last_updated", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Steam Games"
        description="Populated by POST /api/sync/steam — see the README for how to trigger it."
      />

      <Table>
        <Thead>
          <tr>
            <Th>Game</Th>
            <Th>Region</Th>
            <Th align="right">Original</Th>
            <Th align="right">Current</Th>
            <Th align="right">Discount</Th>
            <Th align="right">Sale</Th>
          </tr>
        </Thead>
        <tbody>
          {regions?.map((r) => {
            const game = Array.isArray(r.games) ? r.games[0] : r.games;
            return (
              <Tr key={r.id}>
                <Td>
                  <span className="font-medium text-zinc-100">{game?.name}</span>
                </Td>
                <Td muted>
                  {r.country_code} ({r.currency})
                </Td>
                <Td align="right" muted>
                  {r.original_price}
                </Td>
                <Td align="right">{r.current_price}</Td>
                <Td align="right">
                  {r.discount_percent > 0 ? (
                    <Badge tone="success">-{r.discount_percent}%</Badge>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </Td>
                <Td align="right">
                  {r.sale_active ? <Badge tone="success">Active</Badge> : <span className="text-zinc-600">—</span>}
                </Td>
              </Tr>
            );
          })}
          {regions?.length === 0 && <EmptyRow colSpan={6}>No games synced yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
