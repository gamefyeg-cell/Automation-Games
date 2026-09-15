import { ChevronDown, CreditCard, DollarSign, Globe, Percent } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { SellableGiftCardAddForm } from "@/app/admin/(protected)/sell-gift-cards/add-form";
import { SellableGiftCardImportForm } from "@/app/admin/(protected)/sell-gift-cards/import-form";
import {
  SellableGiftCardsTable,
  type SellableGiftCardRow,
} from "@/app/admin/(protected)/sell-gift-cards/sell-gift-cards-table";

const COPY: Record<Platform, string> = {
  steam: "Retail Steam gift cards you sell directly to customers for profit (not for funding game purchases).",
  playstation: "Retail PlayStation gift cards you sell directly to customers for profit (not for funding game purchases).",
};

export async function SellGiftCardsView({ platform }: { platform: Platform }) {
  const supabase = createAdminClient();

  const { data: cards, error } = await supabase
    .from("sellable_gift_cards")
    .select("*")
    .eq("platform", platform)
    .order("region", { ascending: true })
    .order("cost", { ascending: true });

  const isTableMissing = error?.code === "42P01";
  const cardList = (cards ?? []) as SellableGiftCardRow[];

  // Quick summary statistics
  const totalCards = cardList.length;
  const uniqueRegions = new Set(cardList.map((c) => c.region)).size;
  const activeCards = cardList.filter((c) => c.active);
  const avgMargin =
    activeCards.length > 0
      ? (activeCards.reduce((acc, c) => acc + c.profit_margin, 0) / activeCards.length) * 100
      : 0;
  const avgProfit =
    activeCards.length > 0
      ? activeCards.reduce((acc, c) => acc + c.profit, 0) / activeCards.length
      : 0;

  return (
    <div>
      <PageHeader
        title={platform === "playstation" ? "PlayStation Cards for Sale" : "Steam Cards for Sale"}
        description={COPY[platform]}
      />

      {isTableMissing && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-300">
          <p className="font-semibold text-amber-200">Database setup required:</p>
          <p className="mt-1 text-amber-300/80">
            The <code className="font-mono text-amber-200">sellable_gift_cards</code> table has not been created in Supabase yet.
            Please run the SQL file <code className="font-mono text-amber-200">supabase/migrations/20260915180000_sellable_gift_cards.sql</code> in your Supabase SQL Editor to enable this table.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Total Cards</p>
              <p className="text-lg font-bold text-zinc-100">{totalCards}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Regions</p>
              <p className="text-lg font-bold text-zinc-100">{uniqueRegions}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
              <Percent className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Avg. Margin</p>
              <p className="text-lg font-bold text-zinc-100">{avgMargin.toFixed(1)}%</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Avg. Profit</p>
              <p className="text-lg font-bold text-zinc-100">
                {avgProfit.toFixed(1)} {cardList[0]?.currency ?? "EGP"}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <SellableGiftCardAddForm platform={platform} />

      <details className="group mt-4">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Import cards from Excel (.xlsx) or CSV
        </summary>
        <SellableGiftCardImportForm platform={platform} />
      </details>

      <SellableGiftCardsTable cards={cardList} platform={platform} />
    </div>
  );
}
