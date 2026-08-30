# Gamefy

A Steam-game reselling storefront built around a **profit engine**: Steam
tells you what a game costs, your gift-card inventory tells you what it
costs *you*, and this app turns the two into a selling price and a
calculated margin — calculated from current data, not guaranteed; Steam
prices, gift-card costs, and FX rates all move.

Stack: **Next.js (App Router) + Tailwind + Supabase (Postgres, RLS)**.

## Main objective

The question this app exists to answer isn't "what's the cheapest Steam
region" — it's:

> **What is the cheapest way for Gamefy to acquire this game, and at what
> price should it sell to hit the desired profit?**

Concretely, the pipeline is:

```text
Steam original price
        ↓
Sale / discount price
        ↓
Cheapest region             (src/lib/steam/regional-prices.ts, /prices)
        ↓
Best gift-card combination  (src/lib/pricing/engine.ts, filtered by
        ↓                    src/lib/steam/regions.ts for region/currency compatibility)
Real acquisition cost
        ↓
Fees                        (pricing_settings.payment_fee_percentage / website_fee_percentage)
        ↓
Recommended selling price
        ↓
Expected profit + margin
```

`/prices` runs this end-to-end for one game you pick, on demand — search,
choose a region, get the report. `/admin` (Opportunities) runs the same
engine in bulk, across every synced `game_regions` row, so you can compare
opportunities across your whole catalog at once rather than one game at a
time.

Both the pre-sale and current price are tracked per region
(`game_regions.original_price` / `current_price` / `discount_percent`),
and `game_price_history` appends a snapshot on every sync — so "is this
game still profitable at today's Steam price" is a live answer (re-run
the pipeline), and the history needed to answer "is today's discount
actually better than the lowest we've seen" is being recorded from day
one. Nothing queries that history into a BUY/WAIT recommendation yet —
see "Not yet implemented".

## Why Supabase

Supabase is the database backend: Postgres for the relational data below,
plus Row Level Security so the public site can only ever read `products`
marked `published`.

**Admin auth is deliberately not Supabase Auth.** This is a solo-operated
tool, not a multi-tenant app, so `/admin` is gated by one shared password
(`ADMIN_PASSWORD`, see [src/lib/auth/admin-session.ts](src/lib/auth/admin-session.ts))
rather than an email/magic-link account system. Once past that gate, admin
pages read/write through the **service-role client**
([src/lib/supabase/admin.ts](src/lib/supabase/admin.ts)), bypassing RLS —
the password check in the `(protected)` layout is the real authorization
boundary, not the database. The `profiles`/`is_admin` table and its RLS
policies still exist in the schema but are no longer exercised by the app;
harmless, just vestigial.

## Data model

Steam data, gift-card cost, and the storefront listing are **separate
tables on purpose** — so a supplier price change (e.g. a $20 card going
from 920 → 980 EGP) recalculates cost without touching Steam data, and a
Steam sale updating `game_regions` doesn't silently change what's already
published.

| Table | Purpose |
| --- | --- |
| `games` | One row per Steam app — region-independent metadata. |
| `game_regions` | Current Steam price per game per region/currency. |
| `game_price_history` | Append-only snapshots, for lowest-price / trend logic. |
| `gift_cards` | Supply side: what a gift card costs you to acquire (`purchase_price + fees`), which region's wallet it funds, and in what currency. |
| `pricing_settings` | Singleton row of business rules (minimum profit, target margin, fees). |
| `products` | What's actually live on the Gamefy storefront — computed cost/profit, `published` flag. |
| `profiles` | Vestigial — was for Supabase-Auth-based admin RLS, unused now (see "Why Supabase" above). |

Schema, indexes, generated columns (`gift_cards.total_cost`,
`products.profit`, `products.profit_margin`) and RLS policies live in
[`supabase/migrations`](supabase/migrations).

## The pricing engine

[`src/lib/pricing/engine.ts`](src/lib/pricing/engine.ts) is pure,
side-effect-free logic (easy to unit test, reusable from a cron worker or
an API route):

- `findCheapestGiftCardCombination(targetValue, giftCards)` — unbounded
  knapsack over gift-card denominations to find the cheapest combo whose
  face value covers a Steam price.
- `calculateProductPricing(steamPrice, giftCards, pricingSettings)` —
  turns that into a selling price that survives payment/website fees and
  still clears both the target margin **and** the minimum absolute
  profit.

The admin "Opportunities" page (`/admin`) runs this live against every
`game_regions` row and the active `gift_cards`, so you can see what's
worth publishing before it becomes a `products` row.

**Not every active gift card is usable for every region.** A Steam
wallet's currency is tied to the *account's* registered country, not to
whatever region's store page you're looking at — a card that tops up an
Egyptian-registered wallet can't pay for an India-priced listing just
because it's marked `active`. [`src/lib/steam/regions.ts`](src/lib/steam/regions.ts)
filters the candidate gift cards down to ones that actually match a
region *and* whose `value_currency` matches the currency Steam is quoting
before the engine ever runs — a card with no `region` set is treated as
unrestricted (a global wallet code), but the currency check applies
either way, since the engine compares face value to Steam price as raw
numbers and needs them to be denominated the same way to mean anything.
Both `/admin` (Opportunities) and `/prices` (the save-a-region report) go
through this filter.

## Project layout

```text
src/
  app/
    page.tsx              Public storefront (published products only)
    prices/                Public Steam price lookup — no login (search -> regions -> choose -> save + report)
      layout.tsx             Renders the shared sidebar (no auth check — see admin/(protected) for that)
      page.tsx                Search + regional price table + "Choose this region" per row
      actions.ts               saveGameRegionAndReport — the one write action this public page has, admin-gated internally
    admin/
      login/                Admin password form (outside the auth gate, see below)
      (protected)/          Everything else under /admin — gated by the ADMIN_PASSWORD cookie
        layout.tsx            The actual gate: redirects to /admin/login if the cookie's missing/wrong; renders the shared sidebar
        page.tsx              Live profit-opportunity board + stat cards
        games/                 Synced Steam game/region rows, with a delete button per row (actions.ts, delete-region-button.tsx)
        gift-cards/            Gift-card inventory: add-one form, CSV/TSV/Excel import (see "Importing gift cards" below)
        products/              Published/unpublished storefront listings
        settings/               Pricing rules — editable form (actions.ts, settings-form.tsx)
    api/
      admin/login, logout/    Sets/clears the admin cookie
      steam-search/            Public — name -> Steam App ID
      steam-price/[appId]/     Public — one game's price in every region, converted + ranked
      sync/steam/               Secret-gated (STEAM_SYNC_SECRET) — bulk writer for schedulers
  components/
    app-sidebar.tsx        The one sidebar every internal-tool page shares (/admin/* and /prices) — see "Design" below
    ui/                     Small shared primitives: Card, buttonClass, Badge, Table/Thead/Tr/Td, PageHeader, input styles
  lib/
    auth/
      admin-session.ts        ADMIN_PASSWORD check + cookie signing (see "Why Supabase" above)
    supabase/
      server.ts                Server Component client (anon key, RLS applies) — used by the public homepage
      admin.ts                 Service-role client — server-only, bypasses RLS, used by all of /admin and prices/actions.ts
      database.types.ts        Hand-written types matching the migration (regenerate once linked to a real project)
    pricing/
      engine.ts                The profit engine (see above)
    currency/
      fx.ts                    FX rates + conversion, for comparing regions on one footing
    steam/
      appdetails.ts             Steam's official appdetails endpoint client (free, no key)
      search.ts                  Steam storesearch client — name -> real App ID
      regional-prices.ts         "One game -> price in every region -> cheapest" (converts + ranks)
      regions.ts                  Region/currency compatibility check between gift cards and Steam prices (see below)
      sync.ts                    Orchestrates appdetails -> upsert into games/game_regions/game_price_history
    utils/
      cn.ts, slug.ts, concurrency.ts   Small helpers shared across the above
supabase/
  migrations/                SQL schema + RLS policies
```

## Design

One deliberate dark theme, not a light/dark toggle (`src/app/globals.css`
fixes `color-scheme: dark` and the palette — this is a solo-operated tool,
not a multi-theme product). [`src/components/app-sidebar.tsx`](src/components/app-sidebar.tsx)
is shared by every internal page (`/admin/*` and `/prices`) so the whole
thing reads as one app instead of disconnected pages — search, regional
prices, gift cards, products, and settings are all one click away, never a
typed URL. [`src/components/ui/`](src/components/ui/) holds the small
shared primitives (Card, Badge, Table, buttonClass, PageHeader) every page
builds on, plus icons via `lucide-react` — no emoji as UI icons.

## Steam pricing

Steam's own `store.steampowered.com/api/appdetails?appids={id}&cc={country}`
endpoint is free, needs no key, and — unlike scraping the rendered store
page — already returns exactly the structured price data we need
(`initial`, `final`, `discount_percent`, `currency`) directly as JSON, per
region, just by changing `cc`. No geo-proxying required.
[`src/lib/steam/appdetails.ts`](src/lib/steam/appdetails.ts) wraps it.

### Find a game's cheapest region — `GET /api/steam-price/{appId}`

The core "I pick a game → system finds its cheapest region → feeds the
gift-card engine" flow. **Public, no login** — it only reads Steam's own
public prices and free FX rates, nothing account-specific or costly. Try
it at [`/prices`](src/app/prices/page.tsx) (search a title, pick the right
App ID, see the ranked table), or hit the API directly:

```bash
curl "https://your-app/api/steam-price/3405690?countries=us,gb,de,tr,eg,in,ua&currency=EGP"
```

```jsonc
{
  "steamAppId": 3405690,
  "name": "EA SPORTS FC™ 26",
  "comparisonCurrency": "EGP",
  "prices": [
    { "country": "US", "currency": "USD", "final": 69.99, "convertedFinal": 3515.7, ... },
    { "country": "IN", "currency": "INR", "final": 750.0, "convertedFinal": 394.6, ... },
    // ...
  ],
  "cheapest": { "country": "IN", "convertedFinal": 394.6, ... }
}
```

Never guess the App ID from a title — `GET /api/steam-search?q=FC+26`
([src/lib/steam/search.ts](src/lib/steam/search.ts)) resolves a name to its
real App ID first (titles get re-released/remastered under the same name
with different IDs).

**Currency matters more than the raw number**: comparing ₺1,000 to $39.99
directly is meaningless, so [`src/lib/currency/fx.ts`](src/lib/currency/fx.ts)
converts every region into one comparison currency (free rates from
open.er-api.com, cached 6h) before ranking them — `cheapest` is picked by
*converted* price, not the raw regional number.

**Real finding from testing this against FC 26**: not every publisher
allows Steam's usual per-region local pricing — EA's newer titles show the
same USD price in the US, Turkey, and Egypt, while genuinely
region-priced markets like India came back ~9x cheaper after conversion.
Worth spot-checking `prices` per game rather than assuming every title
arbitrages the same way.

### Choosing a region: save it and see the gift-card report

Viewing prices is free and read-only; on `/prices`, every region row also
has a **Choose** button. Clicking it calls
[`saveGameRegionAndReport`](src/app/prices/actions.ts), which:

1. Requires the admin cookie — checked server-side even though the page
   itself has no login wall, since this one action *writes* to the
   database. Not logged in? It says so instead of silently doing nothing.
2. Re-syncs that one (app ID, country) pair via `syncSteamGameRegion` and
   upserts `games` + `game_regions` + `game_price_history` — so the game
   shows up on `/admin/games` from then on, survives a refresh, and can be
   deleted from there later (every row has a trash-can button).
3. Runs the saved price through the pricing engine against your active
   `gift_cards` and `pricing_settings`, and returns a report right there
   on the page: cost, sell price, profit/margin, and exactly which gift
   cards (and how many of each) cover it.

### Bulk sync into the database — `POST /api/sync/steam`

[src/app/api/sync/steam/route.ts](src/app/api/sync/steam/route.ts) is the
bulk/scheduled counterpart — same appdetails source, but it *writes*
`games`/`game_regions`/`game_price_history` instead of just reporting.
Guarded by a shared secret (not a session), since schedulers carry no
Supabase cookie:

```bash
curl -X POST https://your-app/api/sync/steam \
  -H "x-sync-secret: $STEAM_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"steamAppIds":[3405690],"countries":["us","eg","gb"]}'
```

Omit `steamAppIds` to resync every `games.active = true` row already in the
database; omit `countries` to fall back to `STEAM_SYNC_COUNTRIES`. Schedule
it with Supabase Cron (`pg_net`/`http` extension calling the route on a
timer) or any external scheduler that can send the secret header.

### Publishing an opportunity

A **Publish** button on each row of `/admin` (Opportunities) and on the
`/prices` save-a-region report turns a computed opportunity into a live
`products` row — [`publishOpportunity`](src/app/admin/(protected)/products/actions.ts)
upserts on `(game_id, game_region_id)` (see the
`products_game_region_unique` migration), so re-publishing the same
opportunity after a Steam price change **updates** the existing listing
instead of creating a duplicate. `old_price` is only ever set to the
*previous* Gamefy selling price, and only when it's genuinely higher than
the new one — a real markdown from what Gamefy itself charged before,
never a fabricated "was" price. `/admin/products` has a click-to-toggle
Published/Draft badge per row to take a listing down without deleting it.

## Importing gift cards

`/admin/gift-cards` has two ways in: a one-row-at-a-time form for "I just
bought one card", and an importer
([import-form.tsx](src/app/admin/(protected)/gift-cards/import-form.tsx) +
[actions.ts](src/app/admin/(protected)/gift-cards/actions.ts)) built around
real supplier spreadsheets rather than a strict template you have to
reformat into:

- **Real drag-and-drop** — drop a file anywhere on the box (not just a
  tiny "choose file" link), plus a guard on the surrounding form so a
  stray drop elsewhere doesn't make the browser navigate away and show
  raw file bytes.
- **Actual `.xlsx`/`.xls`/`.xlsb`/`.ods` parsing**, not just CSV/TSV —
  via [SheetJS](https://sheetjs.com) (`xlsx` package), converting the
  first sheet to CSV client-side, which then flows through the same
  parser as a pasted CSV. The npm-published `xlsx` version has known
  unpatched CVEs, so this installs SheetJS's own patched build directly
  from `cdn.sheetjs.com` instead (see the `xlsx` entry in `package.json`
  — it's a URL, not a version range; `npm audit` is clean).
- **Flexible column names** — your header row doesn't need to say
  `provider`/`value`/`purchase_price`. `HEADER_ALIASES` in actions.ts
  recognizes common variants (`Product`, `Country`, `Price`, `Supplier`,
  `Cost`, ...) and simply ignores columns it doesn't recognize (a
  suggested margin %, a computed final price, a supplier link — whatever
  your sheet already has for your own tracking).
- **Currency embedded in the value cell** — `1$`, `€5`, `50 UAH`, `5 CNY`
  are all parsed into a number + ISO currency code automatically
  (`parseValueCell`); an explicit `value_currency`/`Currency` column, if
  present, wins over what's parsed from the cell.
- **Scans for the real header row** — a title/banner row above the actual
  headers (a merged "Gift Card" cell spanning the sheet, in the case this
  was built for) is common in real spreadsheets. The parser checks the
  first 10 lines for the one that actually contains the required columns
  rather than assuming line 1 is always the header.
- **Blank separator rows are skipped**, not treated as bad data — a
  visually-blank row between groups (e.g. one block per country) becomes
  a line of bare commas once a spreadsheet is exported to CSV, not a
  truly empty line, so it needs an explicit check rather than just
  filtering empty strings.

Only `provider`, `value`, and `purchase_price` (or a recognized alias) are
required; everything else has a sensible default (`product_name` falls
back to provider, `purchase_currency` defaults to EGP, `active` defaults
to true).

## Getting started

1. Create a Supabase project, then copy `.env.example` to `.env.local` and
   fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API.
2. Link the CLI and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push
   ```
   (Or run everything locally first with `npm run db:start`, which needs
   Docker Desktop.)
3. Regenerate types against the real schema (optional but recommended):
   ```bash
   npm run db:types
   ```
4. Set `ADMIN_PASSWORD` in `.env.local` to whatever you want — that's the
   entire admin auth setup, no accounts to create.
5. `npm run dev` and open `http://localhost:3000` (storefront),
   `http://localhost:3000/prices` (public Steam price lookup), and
   `http://localhost:3000/admin` (password-gated dashboard).

## Not yet implemented

- **Admin write forms for Products** — Games has delete (no add/edit —
  that comes from syncing), Gift Cards has full add/import, Settings is a
  full edit form, Products now has publish/unpublish; editing a
  published listing's title/description/image by hand isn't there yet.
- **BUY/WAIT recommendation from price history** — `game_price_history`
  has been recording a snapshot on every sync since it was added, but
  nothing reads it back yet to say "today's discount beats the historical
  low" vs "this dips lower than this every few months, wait." The data's
  there; the query and the UI for it aren't.
