import { ArrowRight, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { PublishButton } from "@/components/publish-button";
import type { RegionReport, PriceScenario } from "@/lib/pricing/report";

/**
 * The full itemized "how did we get this price" breakdown for one game
 * region — calculated TWICE: once against the full/original Steam price
 * and once against the current (possibly discounted) price, since the
 * cheapest gift-card combo for one isn't necessarily the cheapest for the
 * other. Shared by the /prices save-a-region flow and /admin/games' per-row
 * report.
 */
export function RegionReportDetail({ report }: { report: RegionReport }) {
  const hasDiscount = report.discountPercent > 0;
  const storeLabel = report.platform === "playstation" ? "PlayStation price" : "Steam price";

  return (
    <div className="space-y-4 text-zinc-300">
      <Card className="border-zinc-800 bg-zinc-950/60">
        <CardHeader>
          <CardTitle>{storeLabel}</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="Before discount">
            {report.beforeDiscount?.steamPrice} {report.currency}
          </Stat>
          <Stat label="Now">
            {report.afterDiscount?.steamPrice} {report.currency}
          </Stat>
          <Stat label="Discount">
            {hasDiscount ? (
              <Badge tone="success">-{report.discountPercent}%</Badge>
            ) : (
              <span className="text-zinc-600">none</span>
            )}
          </Stat>
          <Stat label="You saved">
            {report.savedAmount > 0 ? (
              <span className="text-emerald-400">
                {report.savedAmount} {report.currency}
              </span>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </Stat>
        </CardBody>
      </Card>

      {hasDiscount ? (
        <>
          <ScenarioSection
            title="If selling at the full price (before discount)"
            report={report}
            scenario={report.beforeDiscount}
          />
          <ScenarioSection
            title="If selling at the current discounted price"
            report={report}
            scenario={report.afterDiscount}
            highlight
          />
        </>
      ) : (
        <ScenarioSection title="Cost & profit" report={report} scenario={report.afterDiscount} highlight />
      )}
    </div>
  );
}

function ScenarioSection({
  title,
  report,
  scenario,
  highlight,
}: {
  title: string;
  report: RegionReport;
  scenario: PriceScenario | null;
  highlight?: boolean;
}) {
  if (!scenario) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        <span className="font-medium">{title}:</span> no combination of your active gift cards
        covers this price.
      </div>
    );
  }

  const totalFeePercentage = report.paymentFeePercentage + report.websiteFeePercentage;

  return (
    <div className={highlight ? "rounded-lg border border-indigo-500/20 p-3" : ""}>
      <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-zinc-400 uppercase">
        {title}
      </p>

      {/* The whole pipeline in one glance, with this scenario's real
          numbers — see "Main objective" in the README for the general
          version. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs">
        <Chain>
          {scenario.steamPrice} {report.currency}
        </Chain>
        <ArrowRight className="h-3 w-3 text-zinc-600" />
        <span className="text-zinc-500">paid with</span>
        <Chain>
          {scenario.totalValueCovered} {scenario.cards[0]?.valueCurrency} in gift cards
        </Chain>
        <ArrowRight className="h-3 w-3 text-zinc-600" />
        <span className="text-zinc-500">cost</span>
        <Chain>
          {scenario.cost} {report.productCurrency}
        </Chain>
        <ArrowRight className="h-3 w-3 text-zinc-600" />
        <span className="text-zinc-500">sell for</span>
        <Chain>
          {scenario.sellingPrice} {report.productCurrency}
        </Chain>
        <ArrowRight className="h-3 w-3 text-zinc-600" />
        <span className="text-zinc-500">profit</span>
        <Chain className={scenario.meetsMinimumProfit ? "text-emerald-400" : "text-amber-400"}>
          {scenario.profit} {report.productCurrency} ({scenario.profitMarginPercent.toFixed(1)}%)
        </Chain>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/60">
        <CardHeader>
          <CardTitle>Gift cards used</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <Thead>
              <tr>
                <Th>Provider</Th>
                <Th align="right">Qty</Th>
                <Th align="right">Unit value</Th>
                <Th align="right">Unit price</Th>
                <Th align="right">Unit fees</Th>
                <Th align="right">Unit cost</Th>
                <Th align="right">Line value</Th>
                <Th align="right">Line cost</Th>
              </tr>
            </Thead>
            <tbody>
              {scenario.cards.map((c, i) => (
                <Tr key={i}>
                  <Td>
                    <span className="font-medium text-zinc-100">{c.provider}</span>
                    <span className="ml-1.5 text-xs text-zinc-500">{c.productName}</span>
                  </Td>
                  <Td align="right">{c.quantity}×</Td>
                  <Td align="right" muted>
                    {c.unitValue} {c.valueCurrency}
                  </Td>
                  <Td align="right" muted>
                    {c.unitPurchasePrice} {c.purchaseCurrency}
                  </Td>
                  <Td align="right" muted>
                    {c.unitFees} {c.purchaseCurrency}
                  </Td>
                  <Td align="right" muted>
                    {c.unitTotalCost} {c.purchaseCurrency}
                  </Td>
                  <Td align="right">
                    {c.lineValue} {c.valueCurrency}
                  </Td>
                  <Td align="right">
                    <span className="font-medium text-zinc-100">
                      {c.lineCost} {c.purchaseCurrency}
                    </span>
                  </Td>
                </Tr>
              ))}
              <tr className="border-t border-zinc-700 font-semibold text-zinc-100">
                <Td colSpan={6}>Total</Td>
                <Td align="right">
                  {scenario.totalValueCovered} {scenario.cards[0]?.valueCurrency}
                </Td>
                <Td align="right">
                  {scenario.cost} {report.productCurrency}
                </Td>
              </tr>
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Card className="mt-3 border-zinc-800 bg-zinc-950/60">
        <CardHeader>
          <CardTitle>Selling price &amp; profit</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="Cost (gift cards)">
            {scenario.cost} {report.productCurrency}
          </Stat>
          <Stat label={`Fees (${totalFeePercentage}%)`}>
            {scenario.feeAmount} {report.productCurrency}
          </Stat>
          <Stat label={`Target margin (${report.targetProfitPercentage}%)`}>
            min. profit {report.minimumProfit} {report.productCurrency}
          </Stat>
          <Stat label="Selling price">
            <span className="text-base font-semibold text-zinc-100">
              {scenario.sellingPrice} {report.productCurrency}
            </span>
          </Stat>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-xs text-zinc-500">Profit</p>
            <p
              className={`flex items-center gap-1 text-base font-semibold ${
                scenario.meetsMinimumProfit ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              {scenario.profit} {report.productCurrency} ({scenario.profitMarginPercent.toFixed(1)}
              % margin)
              {!scenario.meetsMinimumProfit && (
                <span className="text-xs font-normal text-amber-400/80">
                  — below the {report.minimumProfit} {report.productCurrency} minimum
                </span>
              )}
            </p>
          </div>
          <div className="col-span-2 border-t border-zinc-800 pt-3 font-mono text-xs text-zinc-500 sm:col-span-4">
            cost {scenario.cost} + profit {scenario.profit} + fees {scenario.feeAmount} = selling
            price{" "}
            <span className="text-zinc-300">
              {round2(scenario.cost + scenario.profit + scenario.feeAmount)}{" "}
              {report.productCurrency}
            </span>
          </div>
        </CardBody>
      </Card>

      <div className="mt-3">
        <PublishButton
          platform={report.platform}
          gameId={report.gameId}
          gameRegionId={report.gameRegionId}
          title={report.gameName}
          imageUrl={report.imageUrl}
          sellingPrice={scenario.sellingPrice}
          cost={scenario.cost}
          currency={report.productCurrency}
        />
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="tabular-nums text-zinc-200">{children}</p>
    </div>
  );
}

function Chain({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded bg-zinc-800 px-2 py-1 font-medium tabular-nums text-zinc-100 ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
