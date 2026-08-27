# Gamefy

A Steam-game reselling storefront built around a **profit engine**: Steam
tells you what a game costs, your gift-card inventory tells you what it
costs *you*, and this app turns the two into a selling price and a
guaranteed margin.

Stack: **Next.js (App Router) + Tailwind + Supabase (Postgres, RLS)**.

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
| `gift_cards` | Supply side: what a gift card costs you to acquire (`purchase_price + fees`). |
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

## Project layout

```text
src/
  app/
    page.tsx              Public storefront (published products only)
    prices/                Public Steam price lookup — no login (search -> regions -> cheapest)
    admin/
      login/                Admin password form (outside the auth gate, see below)
      (protected)/          Everything else under /admin — gated by the ADMIN_PASSWORD cookie
        layout.tsx            The actual gate: redirects to /admin/login if the cookie's missing/wrong
        page.tsx              Live profit-opportunity board
        games/                Synced Steam prices per region
        gift-cards/           Gift-card inventory + CSV/TSV import (actions.ts, import-form.tsx)
        products/             Published/unpublished storefront listings
        settings/             Pricing rules
    api/
      admin/login, logout/    Sets/clears the admin cookie
      steam-search/            Public — name -> Steam App ID
      steam-price/[appId]/     Public — one game's price in every region, converted + ranked
      sync/steam/               Secret-gated (STEAM_SYNC_SECRET) — bulk writer for schedulers
  lib/
    auth/
      admin-session.ts        ADMIN_PASSWORD check + cookie signing (see "Why Supabase" above)
    supabase/
      client.ts               Browser client (anon key, RLS applies) — currently unused
      server.ts                Server Component client (anon key, RLS applies) — used by the public homepage
      admin.ts                 Service-role client — server-only, bypasses RLS, used by all of /admin
      database.types.ts        Hand-written types matching the migration (regenerate once linked to a real project)
    pricing/
      engine.ts                The profit engine (see above)
    currency/
      fx.ts                    FX rates + conversion, for comparing regions on one footing
    steam/
      appdetails.ts             Steam's official appdetails endpoint client (free, no key)
      search.ts                  Steam storesearch client — name -> real App ID
      regional-prices.ts         "One game -> price in every region -> cheapest" (converts + ranks)
      sync.ts                    Orchestrates appdetails -> upsert into games/game_regions/game_price_history
      anakin.ts, extract.ts      Unused by default — Anakin.io scraper fallback, see note below
supabase/
  migrations/                SQL schema + RLS policies
```

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

### Anakin.io scraper (unused by default)

[src/lib/steam/anakin.ts](src/lib/steam/anakin.ts) and
[extract.ts](src/lib/steam/extract.ts) — an earlier AI-extraction-from-scraped-HTML
approach — are left in place but no longer wired into `sync.ts`, since the
official appdetails endpoint is free and strictly more accurate for this.
They're still worth knowing about for pages the JSON endpoint can't reach
(e.g. rendering something client-side that isn't in appdetails at all).

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

- **Publish flow** — a Server Action on the Opportunities page that takes
  a computed opportunity and upserts it into `products`.
- **Admin write forms for Games/Products/Settings** — still read-only
  lists (Gift Cards now has CSV/TSV import, see above); add/edit is a
  Server Action away, same pattern as the gift-card importer.
- **Wiring `/prices` into `/admin`** — the regional price lookup and the
  bulk DB sync (`/api/sync/steam`) are still two separate tools; there's
  no "sync this game I just looked up" button yet.
