"use client";

import { useActionState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { inputClass, labelClass } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { updatePricingSettings, type SettingsState } from "./actions";

interface Settings {
  minimum_profit: number;
  target_profit_percentage: number;
  payment_fee_percentage: number;
  website_fee_percentage: number;
  default_currency: string;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, pending] = useActionState<SettingsState | null, FormData>(
    updatePricingSettings,
    null,
  );

  return (
    <Card className="max-w-xl">
      <CardBody>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Minimum profit</label>
              <input
                name="minimum_profit"
                type="number"
                step="0.01"
                defaultValue={settings.minimum_profit}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <input
                name="default_currency"
                defaultValue={settings.default_currency}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Target profit %</label>
              <input
                name="target_profit_percentage"
                type="number"
                step="0.01"
                defaultValue={settings.target_profit_percentage}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Payment fee %</label>
              <input
                name="payment_fee_percentage"
                type="number"
                step="0.01"
                defaultValue={settings.payment_fee_percentage}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Website fee %</label>
              <input
                name="website_fee_percentage"
                type="number"
                step="0.01"
                defaultValue={settings.website_fee_percentage}
                className={`${inputClass} mt-1`}
              />
            </div>
          </div>

          <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
            {pending ? "Saving…" : "Save"}
          </button>

          {state && (
            <p className={`text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>
              {state.message}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
