"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Loader2,
  Pencil,
  Search as SearchIcon,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inputClass, labelClass } from "@/components/ui/input";
import { Table, Thead, Tr, Td, EmptyRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import type { Platform } from "@/lib/supabase/database.types";
import { deleteGiftCard, updateGiftCard, type GiftCardPatch } from "./actions";

export interface GiftCardRow {
  id: string;
  provider: string;
  product_name: string;
  value: number;
  value_currency: string;
  region: string | null;
  purchase_price: number;
  fees: number;
  purchase_currency: string;
  total_cost: number;
  active: boolean;
}

type SortKey = "provider" | "value" | "purchase_price" | "fees" | "total_cost";
type StatusFilter = "all" | "active" | "inactive";

const NUM_INPUT = "w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500";

export function GiftCardsTable({ cards, platform }: { cards: GiftCardRow[]; platform: Platform }) {
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("");
  const [region, setRegion] = useState("");
  const [currency, setCurrency] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "provider",
    dir: "asc",
  });

  const providers = useMemo(() => uniqueSorted(cards.map((c) => c.provider)), [cards]);
  const regions = useMemo(
    () => uniqueSorted(cards.map((c) => c.region ?? "").filter(Boolean)),
    [cards],
  );
  const currencies = useMemo(() => uniqueSorted(cards.map((c) => c.value_currency)), [cards]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const min = minValue === "" ? null : Number(minValue);
    const max = maxValue === "" ? null : Number(maxValue);

    const rows = cards.filter((c) => {
      if (needle) {
        const hay = `${c.provider} ${c.product_name} ${c.region ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (provider && c.provider !== provider) return false;
      if (region === "__none__" ? !!c.region : region && c.region !== region) return false;
      if (currency && c.value_currency !== currency) return false;
      if (status === "active" && !c.active) return false;
      if (status === "inactive" && c.active) return false;
      if (min !== null && Number.isFinite(min) && c.value < min) return false;
      if (max !== null && Number.isFinite(max) && c.value > max) return false;
      return true;
    });

    const { key, dir } = sort;
    return rows.sort((a, b) => {
      const av = key === "provider" ? a.provider.toLowerCase() : a[key];
      const bv = key === "provider" ? b.provider.toLowerCase() : b[key];
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [cards, q, provider, region, currency, status, minValue, maxValue, sort]);

  const anyFilter =
    q || provider || region || currency || status !== "all" || minValue || maxValue;

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }
  function clearFilters() {
    setQ("");
    setProvider("");
    setRegion("");
    setCurrency("");
    setStatus("all");
    setMinValue("");
    setMaxValue("");
  }

  return (
    <div className="mt-8 space-y-3">
      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              strokeWidth={1.75}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search provider, product name, region…"
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <FilterSelect
              label="Provider"
              value={provider}
              onChange={setProvider}
              options={providers}
              allLabel="All providers"
            />
            <FilterSelect
              label="Region"
              value={region}
              onChange={setRegion}
              options={regions}
              allLabel="All regions"
              extraOption={{ value: "__none__", label: "Unrestricted" }}
            />
            <FilterSelect
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={currencies}
              allLabel="All currencies"
            />
            <label className="block">
              <span className={labelClass}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                className={`${inputClass} mt-1`}
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Min value</span>
              <input
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="0"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Max value</span>
              <input
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder="∞"
                className={`${inputClass} mt-1`}
              />
            </label>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">
              {filtered.length} of {cards.length} card{cards.length === 1 ? "" : "s"}
            </span>
            {anyFilter ? (
              <button onClick={clearFilters} className="text-zinc-400 hover:text-zinc-200">
                Clear filters
              </button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Table>
        <Thead>
          <tr>
            <SortableTh label="Provider" k="provider" sort={sort} onSort={toggleSort} />
            <th className="px-4 py-3">Region</th>
            <SortableTh label="Value" k="value" sort={sort} onSort={toggleSort} align="right" />
            <SortableTh
              label="Purchase"
              k="purchase_price"
              sort={sort}
              onSort={toggleSort}
              align="right"
            />
            <SortableTh label="Fees" k="fees" sort={sort} onSort={toggleSort} align="right" />
            <SortableTh
              label="Total cost"
              k="total_cost"
              sort={sort}
              onSort={toggleSort}
              align="right"
            />
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3 text-right">Edit</th>
          </tr>
        </Thead>
        <tbody>
          {filtered.map((c) => (
            <GiftCardTableRow key={c.id} card={c} platform={platform} />
          ))}
          {filtered.length === 0 && (
            <EmptyRow colSpan={8}>
              {cards.length === 0 ? "No gift cards yet." : "No cards match these filters."}
            </EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}

function GiftCardTableRow({ card, platform }: { card: GiftCardRow; platform: Platform }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => toForm(card));
  const [pending, startTransition] = useTransition();

  function startEdit() {
    setForm(toForm(card));
    setError(null);
    setEditing(true);
  }

  function save() {
    const patch: GiftCardPatch = {
      provider: form.provider,
      product_name: form.product_name,
      value: Number(form.value),
      value_currency: form.value_currency,
      region: form.region,
      purchase_price: Number(form.purchase_price),
      fees: Number(form.fees || "0"),
      purchase_currency: form.purchase_currency,
      active: form.active,
    };
    setError(null);
    startTransition(async () => {
      const res = await updateGiftCard(card.id, platform, patch);
      if (res.ok) setEditing(false);
      else setError(res.message ?? "Update failed.");
    });
  }

  function toggleActive() {
    startTransition(async () => {
      const res = await updateGiftCard(card.id, platform, { active: !card.active });
      if (!res.ok) setError(res.message ?? "Update failed.");
    });
  }

  function remove() {
    if (!confirm(`Delete ${card.provider} — ${card.value} ${card.value_currency}? This can't be undone.`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteGiftCard(card.id, platform);
      if (!res.ok) setError(res.message ?? "Delete failed.");
    });
  }

  if (editing) {
    const previewTotal = (Number(form.purchase_price) || 0) + (Number(form.fees) || 0);
    return (
      <Tr className="align-top">
        <Td>
          <input
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
            className={NUM_INPUT}
            placeholder="Provider"
          />
          <input
            value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
            className={`${NUM_INPUT} mt-1`}
            placeholder="Product name"
          />
        </Td>
        <Td>
          <input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className={NUM_INPUT}
            placeholder="any"
          />
        </Td>
        <Td align="right">
          <div className="flex gap-1">
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              type="number"
              className={`${NUM_INPUT} text-right`}
            />
            <input
              value={form.value_currency}
              onChange={(e) => setForm({ ...form, value_currency: e.target.value })}
              className={`${NUM_INPUT} w-16`}
            />
          </div>
        </Td>
        <Td align="right">
          <div className="flex gap-1">
            <input
              value={form.purchase_price}
              onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              type="number"
              className={`${NUM_INPUT} text-right`}
            />
            <input
              value={form.purchase_currency}
              onChange={(e) => setForm({ ...form, purchase_currency: e.target.value })}
              className={`${NUM_INPUT} w-16`}
            />
          </div>
        </Td>
        <Td align="right">
          <input
            value={form.fees}
            onChange={(e) => setForm({ ...form, fees: e.target.value })}
            type="number"
            className={`${NUM_INPUT} text-right`}
          />
        </Td>
        <Td align="right" muted>
          {previewTotal.toFixed(2)} {form.purchase_currency}
        </Td>
        <Td>
          <label className="flex items-center gap-1.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-indigo-500"
            />
            Active
          </label>
        </Td>
        <Td align="right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={save}
              disabled={pending}
              aria-label="Save"
              className="rounded p-1.5 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={pending}
              aria-label="Cancel"
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {error && <p className="mt-1 text-right text-xs text-red-400">{error}</p>}
        </Td>
      </Tr>
    );
  }

  return (
    <Tr>
      <Td>
        <span className="font-medium text-zinc-100">{card.provider}</span>
        {card.product_name && card.product_name !== card.provider && (
          <span className="ml-1.5 text-xs text-zinc-500">{card.product_name}</span>
        )}
      </Td>
      <Td muted>{card.region ? <Badge tone="accent">{card.region}</Badge> : "any"}</Td>
      <Td align="right">
        {card.value} {card.value_currency}
      </Td>
      <Td align="right" muted>
        {card.purchase_price} {card.purchase_currency}
      </Td>
      <Td align="right" muted>
        {card.fees} {card.purchase_currency}
      </Td>
      <Td align="right">
        {card.total_cost} {card.purchase_currency}
      </Td>
      <Td>
        <button onClick={toggleActive} disabled={pending} className="disabled:opacity-50">
          {card.active ? (
            <Badge tone="success">Active</Badge>
          ) : (
            <Badge tone="neutral">Inactive</Badge>
          )}
        </button>
      </Td>
      <Td align="right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={startEdit}
            disabled={pending}
            aria-label={`Edit ${card.provider} ${card.value} ${card.value_currency}`}
            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={remove}
            disabled={pending}
            aria-label={`Delete ${card.provider} ${card.value} ${card.value_currency}`}
            className="rounded p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="mt-1 text-right text-xs text-red-400">{error}</p>}
      </Td>
    </Tr>
  );
}

function toForm(c: GiftCardRow) {
  return {
    provider: c.provider,
    product_name: c.product_name ?? "",
    value: String(c.value),
    value_currency: c.value_currency,
    region: c.region ?? "",
    purchase_price: String(c.purchase_price),
    fees: String(c.fees ?? 0),
    purchase_currency: c.purchase_currency,
    active: c.active,
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  extraOption,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
  extraOption?: { value: string; label: string };
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1`}
      >
        <option value="">{allLabel}</option>
        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortableTh({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("px-4 py-3", align === "right" && "text-right")}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-zinc-300",
          align === "right" && "flex-row-reverse",
          active && "text-zinc-200",
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}
