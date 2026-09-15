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
import { buttonClass } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/ui/input";
import { Table, Thead, Tr, Td, EmptyRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";
import type { Platform } from "@/lib/supabase/database.types";
import {
  deleteSellableGiftCard,
  deleteSellableGiftCards,
  updateSellableGiftCard,
  type SellableGiftCardPatch,
} from "./actions";

export interface SellableGiftCardRow {
  id: string;
  platform: Platform;
  region: string;
  card_name: string;
  cost: number;
  selling_price: number;
  profit: number;
  profit_margin: number;
  currency: string;
  active: boolean;
  created_at: string;
}

type SortKey = "region" | "card_name" | "cost" | "selling_price" | "profit" | "profit_margin";
type StatusFilter = "all" | "active" | "inactive";

const NUM_INPUT =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-indigo-500";

export function SellableGiftCardsTable({
  cards,
  platform,
}: {
  cards: SellableGiftCardRow[];
  platform: Platform;
}) {
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "region",
    dir: "asc",
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const regions = useMemo(
    () => uniqueSorted(cards.map((c) => c.region).filter(Boolean)),
    [cards],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    const rows = cards.filter((c) => {
      if (needle) {
        const hay = `${c.region} ${c.card_name}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (regionFilter && c.region !== regionFilter) return false;
      if (statusFilter === "active" && !c.active) return false;
      if (statusFilter === "inactive" && c.active) return false;
      return true;
    });

    const { key, dir } = sort;
    return rows.sort((a, b) => {
      const av = typeof a[key] === "string" ? (a[key] as string).toLowerCase() : a[key];
      const bv = typeof b[key] === "string" ? (b[key] as string).toLowerCase() : b[key];
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [cards, q, regionFilter, statusFilter, sort]);

  const filteredIds = useMemo(() => filtered.map((c) => c.id), [filtered]);

  const allSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someSelected =
    filteredIds.some((id) => selectedIds.has(id)) && !allSelected;

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of filteredIds) {
          next.delete(id);
        }
      } else {
        for (const id of filteredIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleSelectRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${ids.length} selected gift card${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBulkError(null);
    startBulkTransition(async () => {
      const res = await deleteSellableGiftCards(ids, platform);
      if (res.ok) {
        setSelectedIds(new Set());
      } else {
        setBulkError(res.message ?? "Could not delete cards.");
      }
    });
  }

  function toggleSort(key: SortKey) {
    setSort((cur) =>
      cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Search & Filter Bar */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <SearchIcon
                className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                strokeWidth={1.75}
              />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search region or card name…"
                className={cn(inputClass, "pl-8 text-xs")}
              />
            </div>

            <div className="w-40">
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className={cn(inputClass, "text-xs")}
              >
                <option value="">All regions</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-32">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className={cn(inputClass, "text-xs")}
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Bulk action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-xs text-indigo-200">
          <div className="flex items-center gap-2 font-medium">
            <span>
              {selectedIds.size} of {filtered.length} card{selectedIds.size === 1 ? "" : "s"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
            >
              {isBulkPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {bulkError && <p className="text-xs text-red-400">{bulkError}</p>}

      {/* Table */}
      <Table>
        <Thead>
          <tr>
            <th className="w-8 px-3 py-2 text-left">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
              />
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400">
              <SortHeader label="Region" sortKey="region" currentSort={sort} onSort={toggleSort} />
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-400">
              <SortHeader label="Card" sortKey="card_name" currentSort={sort} onSort={toggleSort} />
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-400">
              <SortHeader label="Your Cost" sortKey="cost" currentSort={sort} onSort={toggleSort} />
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-400">
              <SortHeader label="Recommended Price" sortKey="selling_price" currentSort={sort} onSort={toggleSort} />
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-400">
              <SortHeader label="Profit" sortKey="profit" currentSort={sort} onSort={toggleSort} />
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-400">
              <SortHeader label="Margin" sortKey="profit_margin" currentSort={sort} onSort={toggleSort} />
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-zinc-400">Status</th>
            <th className="w-20 px-3 py-2 text-right text-xs font-semibold text-zinc-400">Actions</th>
          </tr>
        </Thead>
        <tbody>
          {filtered.map((card) => (
            <Row
              key={card.id}
              card={card}
              platform={platform}
              selected={selectedIds.has(card.id)}
              onToggleSelect={() => toggleSelectRow(card.id)}
            />
          ))}
          {filtered.length === 0 && (
            <EmptyRow colSpan={9}>
              {cards.length === 0
                ? "No retail gift cards yet. Upload your Excel sheet or add one above."
                : "No gift cards match your filter."}
            </EmptyRow>
          )}
        </tbody>
      </Table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 hover:text-zinc-200"
    >
      <span>{label}</span>
      {active ? (
        currentSort.dir === "asc" ? (
          <ArrowUp className="h-3 w-3 text-indigo-400" />
        ) : (
          <ArrowDown className="h-3 w-3 text-indigo-400" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 text-zinc-600" />
      )}
    </button>
  );
}

function Row({
  card,
  platform,
  selected,
  onToggleSelect,
}: {
  card: SellableGiftCardRow;
  platform: Platform;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [region, setRegion] = useState(card.region);
  const [cardName, setCardName] = useState(card.card_name);
  const [cost, setCost] = useState(String(card.cost));
  const [sellingPrice, setSellingPrice] = useState(String(card.selling_price));
  const [currency, setCurrency] = useState(card.currency);
  const [active, setActive] = useState(card.active);

  const numCost = Number(cost);
  const numPrice = Number(sellingPrice);
  const editProfit = Number.isFinite(numCost) && Number.isFinite(numPrice) ? numPrice - numCost : card.profit;
  const editMargin = Number.isFinite(numPrice) && numPrice > 0 ? (editProfit / numPrice) * 100 : card.profit_margin * 100;

  function cancel() {
    setRegion(card.region);
    setCardName(card.card_name);
    setCost(String(card.cost));
    setSellingPrice(String(card.selling_price));
    setCurrency(card.currency);
    setActive(card.active);
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const patch: SellableGiftCardPatch = {};
      if (region.trim() !== card.region) patch.region = region.trim();
      if (cardName.trim() !== card.card_name) patch.card_name = cardName.trim();
      if (numCost !== card.cost) patch.cost = numCost;
      if (numPrice !== card.selling_price) patch.selling_price = numPrice;
      if (currency.trim().toUpperCase() !== card.currency) patch.currency = currency.trim().toUpperCase();
      if (active !== card.active) patch.active = active;

      const res = await updateSellableGiftCard(card.id, platform, patch);
      if (res.ok) {
        setEditing(false);
      } else {
        setError(res.message ?? "Save failed.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${card.region} — ${card.card_name}?`)) return;
    startTransition(async () => {
      const res = await deleteSellableGiftCard(card.id, platform);
      if (!res.ok) setError(res.message ?? "Delete failed.");
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await updateSellableGiftCard(card.id, platform, { active: !card.active });
      if (!res.ok) setError(res.message ?? "Status update failed.");
    });
  }

  if (editing) {
    return (
      <Tr className="bg-zinc-900/60">
        <Td>
          <input type="checkbox" disabled checked={selected} className="opacity-40" />
        </Td>
        <Td>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className={NUM_INPUT}
            placeholder="Region"
          />
        </Td>
        <Td>
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className={NUM_INPUT}
            placeholder="Card name"
          />
        </Td>
        <Td align="right">
          <input
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className={cn(NUM_INPUT, "text-right")}
          />
        </Td>
        <Td align="right">
          <input
            type="number"
            step="0.01"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
            className={cn(NUM_INPUT, "text-right")}
          />
        </Td>
        <Td align="right" muted>
          <span className={editProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
            {editProfit.toFixed(2)}
          </span>
        </Td>
        <Td align="right" muted>
          <span>{editMargin.toFixed(1)}%</span>
        </Td>
        <Td className="text-center">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
          />
        </Td>
        <Td align="right">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 disabled:opacity-50"
              title="Save"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={isPending}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
        </Td>
      </Tr>
    );
  }

  const isProfitable = card.profit >= 0;

  return (
    <Tr className={cn(!card.active && "opacity-60")}>
      <Td>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-indigo-500"
        />
      </Td>
      <Td>
        <span className="font-semibold text-zinc-200">{card.region}</span>
      </Td>
      <Td>
        <span className="font-medium text-zinc-100">{card.card_name}</span>
      </Td>
      <Td align="right" muted>
        <span className="tabular-nums">{card.cost.toFixed(2)} {card.currency}</span>
      </Td>
      <Td align="right">
        <span className="font-semibold text-zinc-100 tabular-nums">
          {card.selling_price.toFixed(2)} {card.currency}
        </span>
      </Td>
      <Td align="right">
        <span
          className={cn(
            "font-semibold tabular-nums",
            isProfitable ? "text-emerald-400" : "text-red-400",
          )}
        >
          {isProfitable ? "+" : ""}
          {card.profit.toFixed(2)} {card.currency}
        </span>
      </Td>
      <Td align="right">
        <Badge tone={isProfitable ? (card.profit_margin >= 0.15 ? "success" : "accent") : "danger"}>
          {(card.profit_margin * 100).toFixed(1)}%
        </Badge>
      </Td>
      <Td className="text-center">
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={isPending}
          className="cursor-pointer"
          title={card.active ? "Click to disable" : "Click to enable"}
        >
          <Badge tone={card.active ? "success" : "neutral"}>
            {card.active ? "Active" : "Inactive"}
          </Badge>
        </button>
      </Td>
      <Td align="right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={isPending}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
      </Td>
    </Tr>
  );
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort();
}
