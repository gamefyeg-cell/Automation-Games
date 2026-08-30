import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { GameRegionRow } from "./game-region-row";

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
        description="Populated by POST /api/sync/steam or by choosing a region on Steam Prices. Click a row for the full cost/profit report."
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
            <Th align="right">Remove</Th>
          </tr>
        </Thead>
        <tbody>
          {regions?.map((r) => {
            const game = Array.isArray(r.games) ? r.games[0] : r.games;
            return (
              <GameRegionRow
                key={r.id}
                region={{
                  id: r.id,
                  gameName: game?.name ?? "Unknown game",
                  countryCode: r.country_code,
                  currency: r.currency,
                  originalPrice: r.original_price,
                  currentPrice: r.current_price,
                  discountPercent: r.discount_percent,
                  saleActive: r.sale_active,
                }}
              />
            );
          })}
          {regions?.length === 0 && <EmptyRow colSpan={7}>No games synced yet.</EmptyRow>}
        </tbody>
      </Table>
    </div>
  );
}
