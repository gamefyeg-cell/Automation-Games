import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { GameRegionRow } from "@/app/admin/(protected)/games/game-region-row";

const COPY: Record<Platform, { title: string; description: string }> = {
  steam: {
    title: "Steam Games",
    description:
      "Populated by POST /api/sync/steam or by choosing a region on Steam Prices. Click a row for the full cost/profit report.",
  },
  playstation: {
    title: "PlayStation Games",
    description:
      "Populated by choosing a region on PlayStation Prices. Click a row for the full cost/profit report.",
  },
};

export async function GamesView({ platform }: { platform: Platform }) {
  const supabase = createAdminClient();
  const COLS =
    "id, country_code, currency, original_price, current_price, discount_percent, sale_active, games(name)";
  const { data: regions } = await withPlatformFallback(
    supabase.from("game_regions").select(COLS).eq("platform", platform).order("last_updated", { ascending: false }),
    () => supabase.from("game_regions").select(COLS).order("last_updated", { ascending: false }),
    platform,
  );

  const copy = COPY[platform];

  return (
    <div>
      <PageHeader title={copy.title} description={copy.description} />

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
                platform={platform}
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
