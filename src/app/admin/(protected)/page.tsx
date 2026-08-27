import { AlertTriangle, TrendingUp } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateProductPricing, type GiftCardOption } from "@/lib/pricing/engine";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";

// The "Profit Opportunities" board: for every active Steam region price,
// runs the pricing engine against the current gift-card inventory and
// pricing rules, and ranks the results. Nothing here is persisted — this
// is a live view. Turning a row into a real product happens on the
// Products page (create/update a row in `products`).
//
// Uses the service-role client: this route is only reachable through the
// (protected) layout's admin-password cookie check, which is the actual
// authorization boundary now (see src/lib/auth/admin-session.ts) — not
// Supabase Auth + RLS.
export default async function AdminOpportunitiesPage() {
  const supabase = createAdminClient();

  const [{ data: regions }, { data: giftCards }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("game_regions")
      .select("id, country_code, currency, current_price, discount_percent, games(id, name)")
      .order("current_price", { ascending: true }),
    supabase.from("gift_cards").select("id, value, total_cost").eq("active", true),
    supabase.from("pricing_settings").select("*").single(),
  ]);

  const settings = settingsRow
    ? {
        minimumProfit: settingsRow.minimum_profit,
        targetProfitPercentage: settingsRow.target_profit_percentage,
        paymentFeePercentage: settingsRow.payment_fee_percentage,
        websiteFeePercentage: settingsRow.website_fee_percentage,
      }
    : null;

  const cardOptions: GiftCardOption[] =
    giftCards?.map((c) => ({ id: c.id, value: c.value, totalCost: c.total_cost })) ?? [];

  const opportunities =
    settings && cardOptions.length > 0
      ? (regions ?? [])
          .map((region) => {
            const game = Array.isArray(region.games) ? region.games[0] : region.games;
            const result = calculateProductPricing(region.current_price, cardOptions, settings);
            if (!result) return null;
            return {
              regionId: region.id,
              gameName: game?.name ?? "Unknown game",
              countryCode: region.country_code,
              steamPrice: region.current_price,
              discountPercent: region.discount_percent,
              ...result,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .sort((a, b) => b.profit - a.profit)
      : [];

  const profitable = opportunities.filter((o) => o.meetsMinimumProfit).length;
  const bestProfit = opportunities[0]?.profit ?? 0;
  const avgMargin = opportunities.length
    ? opportunities.reduce((sum, o) => sum + o.profitMarginPercent, 0) / opportunities.length
    : 0;

  return (
    <div>
      <PageHeader
        title="Best Opportunities"
        description="Live pricing-engine output: cheapest gift-card combo per Steam region price, ranked by profit. Nothing is saved until you publish a product."
      />

      {!settings && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No pricing_settings row found — run the migrations.
        </div>
      )}
      {settings && cardOptions.length === 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          No active gift cards yet. Add some on the Gift Cards page first.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Profitable regions" value={String(profitable)} />
        <StatCard label="Best profit" value={bestProfit.toFixed(2)} suffix="EGP" />
        <StatCard label="Average margin" value={avgMargin.toFixed(1)} suffix="%" />
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Game</Th>
            <Th>Region</Th>
            <Th align="right">Steam Price</Th>
            <Th align="right">Discount</Th>
            <Th align="right">Cost</Th>
            <Th align="right">Sell</Th>
            <Th align="right">Profit</Th>
            <Th align="right">Margin</Th>
          </tr>
        </Thead>
        <tbody>
          {opportunities.map((o) => (
            <Tr key={o.regionId}>
              <Td>
                <span className="font-medium text-zinc-100">{o.gameName}</span>
              </Td>
              <Td muted>{o.countryCode}</Td>
              <Td align="right" muted>
                {o.steamPrice}
              </Td>
              <Td align="right">
                {o.discountPercent > 0 ? (
                  <Badge tone="success">-{o.discountPercent}%</Badge>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </Td>
              <Td align="right" muted>
                {o.cost.toFixed(2)}
              </Td>
              <Td align="right">{o.sellingPrice.toFixed(2)}</Td>
              <Td align="right">
                <span
                  className={`flex items-center justify-end gap-1 font-medium ${
                    o.meetsMinimumProfit ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />
                  {o.profit.toFixed(2)}
                </span>
              </Td>
              <Td align="right" muted>
                {o.profitMarginPercent.toFixed(1)}%
              </Td>
            </Tr>
          ))}
          {opportunities.length === 0 && (
            <EmptyRow colSpan={8}>No opportunities yet — sync games and add gift cards first.</EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-50 tabular-nums">
          {value}
          {suffix && <span className="ml-1 text-sm font-normal text-zinc-500">{suffix}</span>}
        </p>
      </CardBody>
    </Card>
  );
}
