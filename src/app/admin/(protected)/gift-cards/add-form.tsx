"use client";

import { useActionState, useEffect, useRef } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { inputClass, labelClass } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { addGiftCard, type ImportState } from "./actions";

export function GiftCardAddForm() {
  const [state, formAction, pending] = useActionState<ImportState | null, FormData>(
    addGiftCard,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card className="mt-6">
      <CardBody>
        <form ref={formRef} action={formAction} className="space-y-4">
          <p className="text-sm font-semibold text-zinc-100">Add one gift card</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={labelClass}>Provider *</label>
              <input name="provider" required placeholder="G2A" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className={labelClass}>Product name</label>
              <input
                name="product_name"
                placeholder="Steam Wallet Code"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Value *</label>
              <input
                name="value"
                type="number"
                step="0.01"
                required
                placeholder="10"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Value currency</label>
              <input name="value_currency" placeholder="USD" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className={labelClass}>Purchase price *</label>
              <input
                name="purchase_price"
                type="number"
                step="0.01"
                required
                placeholder="470"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Fees</label>
              <input
                name="fees"
                type="number"
                step="0.01"
                placeholder="12"
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label className={labelClass}>Purchase currency</label>
              <input name="purchase_currency" placeholder="EGP" className={`${inputClass} mt-1`} />
            </div>
            <div>
              <label className={labelClass}>Region</label>
              <input name="region" placeholder="EGYPT" className={`${inputClass} mt-1`} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="active"
              defaultChecked
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/30"
            />
            Active
          </label>

          <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>
            {pending ? "Adding…" : "Add gift card"}
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
