import { ChevronDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Platform } from "@/lib/supabase/database.types";
import { withPlatformFallback } from "@/lib/supabase/platform-filter";
import { PageHeader } from "@/components/ui/page-header";
import { GiftCardAddForm } from "@/app/admin/(protected)/gift-cards/add-form";
import { GiftCardImportForm } from "@/app/admin/(protected)/gift-cards/import-form";
import {
  GiftCardsTable,
  type GiftCardRow,
} from "@/app/admin/(protected)/gift-cards/gift-cards-table";

const COPY: Record<Platform, string> = {
  steam: "Your supply side — what it costs to fund a Steam purchase.",
  playstation: "Your supply side — what it costs to fund a PlayStation Store purchase.",
};

export async function GiftCardsView({ platform }: { platform: Platform }) {
  const supabase = createAdminClient();
  const { data: giftCards } = await withPlatformFallback(
    supabase
      .from("gift_cards")
      .select("*")
      .eq("platform", platform)
      .order("provider", { ascending: true })
      .order("value", { ascending: true }),
    () =>
      supabase
        .from("gift_cards")
        .select("*")
        .order("provider", { ascending: true })
        .order("value", { ascending: true }),
    platform,
  );

  return (
    <div>
      <PageHeader title="Gift Cards" description={COPY[platform]} />

      <GiftCardAddForm platform={platform} />

      <details className="group mt-4">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          Got a lot of cards at once? Import from CSV/Excel instead
        </summary>
        <GiftCardImportForm platform={platform} />
      </details>

      <GiftCardsTable cards={(giftCards ?? []) as GiftCardRow[]} platform={platform} />
    </div>
  );
}
