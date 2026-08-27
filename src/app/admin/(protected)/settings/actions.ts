"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SettingsState {
  ok: boolean;
  message: string;
}

export async function updatePricingSettings(
  _prevState: SettingsState | null,
  formData: FormData,
): Promise<SettingsState> {
  const num = (name: string) => Number(formData.get(name));

  const minimumProfit = num("minimum_profit");
  const targetProfitPercentage = num("target_profit_percentage");
  const paymentFeePercentage = num("payment_fee_percentage");
  const websiteFeePercentage = num("website_fee_percentage");
  const defaultCurrency = String(formData.get("default_currency") ?? "").trim() || "EGP";

  for (const [name, value] of Object.entries({
    minimum_profit: minimumProfit,
    target_profit_percentage: targetProfitPercentage,
    payment_fee_percentage: paymentFeePercentage,
    website_fee_percentage: websiteFeePercentage,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, message: `${name.replace(/_/g, " ")} must be a non-negative number.` };
    }
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pricing_settings")
    .update({
      minimum_profit: minimumProfit,
      target_profit_percentage: targetProfitPercentage,
      payment_fee_percentage: paymentFeePercentage,
      website_fee_percentage: websiteFeePercentage,
      default_currency: defaultCurrency,
    })
    .eq("id", true);

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { ok: true, message: "Saved." };
}
