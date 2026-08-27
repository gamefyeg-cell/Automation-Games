-- Gamefy core schema
-- Steam game data, gift-card costs, pricing rules and the resulting
-- storefront products are kept in separate tables on purpose: Steam data,
-- your gift-card costs, and what you actually sell on Gamefy must be able
-- to change independently and be recalculated from each other.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin flag on top of Supabase auth users. Keep it minimal: anyone who
-- needs to see costs/margins or manage gift cards & publishing must have
-- a row here with is_admin = true.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- games: one row per Steam app, region-independent metadata
-- ---------------------------------------------------------------------

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  steam_app_id integer not null unique,
  name text not null,
  slug text not null unique,
  description text,
  developer text,
  publisher text,
  genres text[] not null default '{}',
  image_url text,
  steam_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

create index if not exists games_steam_app_id_idx on public.games (steam_app_id);
create index if not exists games_active_idx on public.games (active);

-- ---------------------------------------------------------------------
-- game_regions: current Steam price per game per region/currency
-- ---------------------------------------------------------------------

create table if not exists public.game_regions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  country_code text not null, -- ISO 3166-1 alpha-2, e.g. 'US', 'EG'
  currency text not null,     -- ISO 4217, e.g. 'USD', 'EGP'
  original_price numeric(12, 2) not null,
  current_price numeric(12, 2) not null,
  discount_percent smallint not null default 0,
  sale_active boolean not null default false,
  sale_end timestamptz,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (game_id, country_code)
);

create index if not exists game_regions_game_id_idx on public.game_regions (game_id);
create index if not exists game_regions_country_code_idx on public.game_regions (country_code);
create index if not exists game_regions_sale_active_idx on public.game_regions (sale_active);

-- ---------------------------------------------------------------------
-- game_price_history: append-only snapshots for trend/lowest-price logic
-- ---------------------------------------------------------------------

create table if not exists public.game_price_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  country_code text not null,
  currency text not null,
  original_price numeric(12, 2) not null,
  current_price numeric(12, 2) not null,
  discount_percent smallint not null default 0,
  recorded_at timestamptz not null default now()
);

create index if not exists game_price_history_game_region_idx
  on public.game_price_history (game_id, country_code, recorded_at desc);

-- ---------------------------------------------------------------------
-- gift_cards: your supply side (e.g. G2A Steam wallet codes)
-- ---------------------------------------------------------------------

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  provider text not null,       -- e.g. 'G2A'
  product_name text not null,
  value numeric(12, 2) not null,      -- face value, e.g. 10.00
  value_currency text not null,       -- currency the face value is denominated in, e.g. 'USD'
  region text,                        -- Steam wallet region this card tops up, e.g. 'EGYPT'
  purchase_price numeric(12, 2) not null, -- what you pay the supplier
  fees numeric(12, 2) not null default 0,
  purchase_currency text not null default 'EGP',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gift_cards
  add column if not exists total_cost numeric(12, 2)
  generated always as (purchase_price + fees) stored;

create trigger gift_cards_set_updated_at
  before update on public.gift_cards
  for each row execute function public.set_updated_at();

create index if not exists gift_cards_provider_idx on public.gift_cards (provider);
create index if not exists gift_cards_active_idx on public.gift_cards (active);

-- ---------------------------------------------------------------------
-- pricing_settings: singleton row of business rules the engine reads
-- ---------------------------------------------------------------------

create table if not exists public.pricing_settings (
  id boolean primary key default true, -- always exactly one row (id = true)
  minimum_profit numeric(12, 2) not null default 150,
  target_profit_percentage numeric(5, 2) not null default 20,
  payment_fee_percentage numeric(5, 2) not null default 3,
  website_fee_percentage numeric(5, 2) not null default 0,
  default_currency text not null default 'EGP',
  updated_at timestamptz not null default now(),
  constraint pricing_settings_singleton check (id)
);

insert into public.pricing_settings (id)
values (true)
on conflict (id) do nothing;

create trigger pricing_settings_set_updated_at
  before update on public.pricing_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- products: what actually appears on the Gamefy storefront
-- ---------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  game_region_id uuid references public.game_regions (id) on delete set null,
  title text not null,
  description text,
  image_url text,
  selling_price numeric(12, 2) not null,
  old_price numeric(12, 2),
  cost numeric(12, 2) not null default 0,
  profit numeric(12, 2) generated always as (selling_price - cost) stored,
  profit_margin numeric(6, 3) generated always as (
    case when selling_price = 0 then 0
    else round(((selling_price - cost) / selling_price)::numeric, 3) end
  ) stored,
  currency text not null default 'EGP',
  stock integer,
  published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create index if not exists products_game_id_idx on public.products (game_id);
create index if not exists products_published_idx on public.products (published);
create index if not exists products_featured_idx on public.products (featured);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_regions enable row level security;
alter table public.game_price_history enable row level security;
alter table public.gift_cards enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.products enable row level security;

-- profiles: a user can read their own row; only admins can read/manage all
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: admins manage all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- games / game_regions / game_price_history: public catalog data,
-- readable by anyone, writable only by admins (the sync worker should
-- use the service role key, which bypasses RLS entirely).
create policy "games: public read" on public.games
  for select using (true);
create policy "games: admin write" on public.games
  for insert with check (public.is_admin());
create policy "games: admin update" on public.games
  for update using (public.is_admin()) with check (public.is_admin());
create policy "games: admin delete" on public.games
  for delete using (public.is_admin());

create policy "game_regions: public read" on public.game_regions
  for select using (true);
create policy "game_regions: admin write" on public.game_regions
  for insert with check (public.is_admin());
create policy "game_regions: admin update" on public.game_regions
  for update using (public.is_admin()) with check (public.is_admin());
create policy "game_regions: admin delete" on public.game_regions
  for delete using (public.is_admin());

create policy "game_price_history: admin read" on public.game_price_history
  for select using (public.is_admin());
create policy "game_price_history: admin write" on public.game_price_history
  for insert with check (public.is_admin());

-- gift_cards & pricing_settings hold cost/margin data: admin-only, never
-- exposed to the public storefront.
create policy "gift_cards: admin all" on public.gift_cards
  for all using (public.is_admin()) with check (public.is_admin());

create policy "pricing_settings: admin all" on public.pricing_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- products: only published rows are visible publicly; admins see and
-- manage everything (including unpublished/rejected products).
create policy "products: public read published" on public.products
  for select using (published = true);
create policy "products: admin read all" on public.products
  for select using (public.is_admin());
create policy "products: admin write" on public.products
  for insert with check (public.is_admin());
create policy "products: admin update" on public.products
  for update using (public.is_admin()) with check (public.is_admin());
create policy "products: admin delete" on public.products
  for delete using (public.is_admin());
