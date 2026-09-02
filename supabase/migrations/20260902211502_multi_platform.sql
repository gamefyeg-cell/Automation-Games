-- Multi-platform: run the same Steam arbitrage flow for the PlayStation
-- Store. Everything below is ADDITIVE and defaults to 'steam', so every
-- existing row and the whole existing Steam flow keep working untouched.
--
-- Split vs shared (per product decision):
--   games, game_regions, game_price_history, gift_cards, products  -> per platform
--   pricing_settings                                               -> shared (one row, both platforms)

-- ---------------------------------------------------------------------
-- platform discriminator
-- ---------------------------------------------------------------------

alter table public.games              add column if not exists platform text not null default 'steam';
alter table public.game_regions       add column if not exists platform text not null default 'steam';
alter table public.game_price_history add column if not exists platform text not null default 'steam';
alter table public.gift_cards         add column if not exists platform text not null default 'steam';
alter table public.products           add column if not exists platform text not null default 'steam';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'games_platform_chk') then
    alter table public.games add constraint games_platform_chk check (platform in ('steam','playstation'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_regions_platform_chk') then
    alter table public.game_regions add constraint game_regions_platform_chk check (platform in ('steam','playstation'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_price_history_platform_chk') then
    alter table public.game_price_history add constraint game_price_history_platform_chk check (platform in ('steam','playstation'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gift_cards_platform_chk') then
    alter table public.gift_cards add constraint gift_cards_platform_chk check (platform in ('steam','playstation'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_platform_chk') then
    alter table public.products add constraint products_platform_chk check (platform in ('steam','playstation'));
  end if;
end $$;

create index if not exists games_platform_idx on public.games (platform);
create index if not exists game_regions_platform_idx on public.game_regions (platform);
create index if not exists gift_cards_platform_idx on public.gift_cards (platform);
create index if not exists products_platform_idx on public.products (platform);

-- ---------------------------------------------------------------------
-- games: generalize the external id
--   Steam identifies an app by integer steam_app_id.
--   PlayStation identifies a game by a string "concept id" (e.g. 10006560)
--   which is region-independent, exactly what we need.
-- ---------------------------------------------------------------------

alter table public.games alter column steam_app_id drop not null;
alter table public.games add column if not exists ps_concept_id text;

-- One PlayStation game per concept id; Steam's own unique(steam_app_id)
-- still stands and simply ignores the now-nullable PlayStation rows.
create unique index if not exists games_ps_concept_id_key
  on public.games (ps_concept_id)
  where ps_concept_id is not null;

-- slug was globally unique; "god-of-war" can exist once per platform now.
alter table public.games drop constraint if exists games_slug_key;
create unique index if not exists games_platform_slug_key on public.games (platform, slug);

-- game_regions.unique(game_id, country_code) and
-- products.unique(game_id, game_region_id) both still hold — game_id is
-- already platform-scoped through games.platform.

-- ---------------------------------------------------------------------
-- RLS: existing policies are platform-agnostic and still correct
--   - games/game_regions/game_price_history: public read, admin write
--   - gift_cards/pricing_settings: admin only
--   - products: public reads published rows (any platform), admin all
-- Nothing to change here.
-- ---------------------------------------------------------------------
