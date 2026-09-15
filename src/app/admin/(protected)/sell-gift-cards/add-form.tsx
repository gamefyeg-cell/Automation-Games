"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/input";
import type { Platform } from "@/lib/supabase/database.types";
import { addSellableGiftCard, type ImportState } from "./actions";

export function SellableGiftCardAddForm({ platform }: { platform: Platform }) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [state, formAction, pending] = useActionState<ImportState | null, FormData>(
    addSellableGiftCard,
    null,
  );

  const numCost = Number(cost);
  const numPrice = Number(price);
  const hasValidNumbers = cost !== "" && price !== "" && Number.isFinite(numCost) && Number.isFinite(numPrice);
  const profit = hasValidNumbers ? numPrice - numCost : null;
  const margin = hasValidNumbers && numPrice > 0 ? (profit! / numPrice) * 100 : null;

  return (
    <Card className="mt-4">
      <CardBody>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Add retail gift card</h3>
            <p className="text-xs text-zinc-500">Add a card you sell directly to customers for profit.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={buttonClass("secondary", "sm")}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {open ? "Close" : "Add card"}
          </button>
        </div>

        {open && (
          <form action={formAction} className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
            <input type="hidden" name="platform" value={platform} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelClass}>Region / Country</label>
                <input
                  type="text"
                  name="region"
                  required
                  placeholder="e.g. US, Turkey, Global"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Card / Denomination</label>
                <input
                  type="text"
                  name="card_name"
                  required
                  placeholder="e.g. $10 Steam Card"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Your Cost</label>
                <input
                  type="number"
                  name="cost"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Recommended Price</label>
                <input
                  type="number"
                  name="selling_price"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-850 pt-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-400">Currency:</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue="EGP"
                    maxLength={4}
                    className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 uppercase"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked
                    className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
                  />
                  Active for sale
                </label>

                {profit !== null && (
                  <div className="text-xs">
                    <span className="text-zinc-500">Estimated profit: </span>
                    <span className={`font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                    </span>
                    {margin !== null && (
                      <span className="ml-1 text-zinc-400">({margin.toFixed(1)}%)</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
                  {pending ? "Adding…" : "Save card"}
                </button>
              </div>
            </div>

            {state && (
              <p className={`text-xs ${state.ok ? "text-emerald-400" : "text-red-400"}`}>
                {state.message}
              </p>
            )}
          </form>
        )}
      </CardBody>
    </Card>
  );
}
