-- Sellable Gift Cards: retail gift cards sold directly to customers for profit.
-- Completely distinct from supply-side gift_cards (which are inputs for game arbitrage purchases).

create table if not exists public.sellable_gift_cards (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'steam' check (platform in ('steam', 'playstation')),
  region text not null,
  card_name text not null,
  cost numeric(12, 2) not null,
  selling_price numeric(12, 2) not null,
  profit numeric(12, 2) generated always as (selling_price - cost) stored,
  profit_margin numeric(6, 3) generated always as (
    case when selling_price = 0 then 0
    else round(((selling_price - cost) / selling_price)::numeric, 3) end
  ) stored,
  currency text not null default 'EGP',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sellable_gift_cards_set_updated_at
  before update on public.sellable_gift_cards
  for each row execute function public.set_updated_at();

create index if not exists sellable_gift_cards_platform_idx on public.sellable_gift_cards (platform);
create index if not exists sellable_gift_cards_region_idx on public.sellable_gift_cards (region);
create index if not exists sellable_gift_cards_active_idx on public.sellable_gift_cards (active);

-- Row Level Security
alter table public.sellable_gift_cards enable row level security;

create policy "sellable_gift_cards: public read active" on public.sellable_gift_cards
  for select using (active = true);

create policy "sellable_gift_cards: admin all" on public.sellable_gift_cards
  for all using (public.is_admin()) with check (public.is_admin());
