# CelebStockz market scheduler

CelebStockz separates **price ticks** from **third-party data collection**.

The market is intentionally designed as a game rather than a literal financial model. Real-world observations establish each celebrity's pricing anchor and momentum context, while short-lived game volatility and player trading pressure make the market feel active between collection cycles.

A scheduler may call the market-cycle endpoint every two minutes without causing every external API to be polled every two minutes. Normal tick cycles use stored observations, the latest real-world anchor, current 24-hour practice-trade pressure, and bounded gameplay volatility. More expensive collection cycles run at a controlled cadence and store refreshed observations before recalculating source snapshots.

## Endpoint

`GET /api/internal/market-refresh?mode=cycle`

Authentication is required. Send either:

- `Authorization: Bearer <secret>`
- `x-market-refresh-secret: <secret>`

Secrets are accepted from `CRON_SECRET`, `NITRO_MARKET_REFRESH_SECRET`, or the securely stored Market Refresh Secret. Secrets are deliberately **not** accepted in the URL/query string.

### Modes

- `cycle` — recommended scheduler mode. Runs a collection if one is due; otherwise runs a lightweight live-price tick.
- `tick` — forces the lightweight live-price tick and never calls third-party providers.
- `collect` — forces the full observation collection and source-snapshot refresh. The admin manual-refresh action uses this mode through the distributed scheduler lease.

## What happens every two minutes

A normal `cycle` request that is not due for collection:

1. Acquires the Postgres distributed scheduler lease.
2. Reads 24-hour buy/sell pressure once for the whole market.
3. Compares each celebrity's pressure with its previous live-price pressure.
4. Applies amplified player-pressure movement to active markets.
5. Gives roughly one third of otherwise quiet markets a rotating deterministic game-buzz pulse, with occasional larger buzz spikes.
6. Applies gentle mean reversion toward the latest real-world source price so game noise remains short-lived rather than permanently replacing the underlying signal.
7. Caps a single tick to ±3% and the live cumulative movement envelope to ±45% by default.
8. Processes open orders if any live prices changed.
9. Releases the lease.

No Wikimedia, GDELT, DataForSEO, YouTube, NewsData, Webz, TMDB, Last.fm, or SportsDB request is made by a normal price tick.

The default gameplay settings are intentionally lively and can be tuned without a code release:

- `NITRO_GAME_VOLATILITY_PERCENT=0.9` — base quiet-market game pulse.
- `NITRO_GAME_MAX_TICK_MOVE_PERCENT=3` — hard cap for one live tick.
- `NITRO_GAME_DAILY_MOVE_CAP_PERCENT=45` — live cumulative movement envelope between source refresh resets.

A full observation refresh reseeds `market_live_prices` from the approved source snapshots, so real-world celebrity attention continues to shape the medium-term market even when short-term game volatility is high.

## Collection cadence

`NITRO_MARKET_COLLECTION_MINUTES` controls how often a `cycle` request is allowed to perform a full collection. The default is `60` minutes and the accepted range is 15–1440 minutes.

Individual collectors still have their own freshness controls, so a collection cycle does not necessarily call every provider:

- Wikimedia daily pageviews: approximately daily.
- Wikipedia revision activity: approximately hourly.
- GDELT 7-day news volume: approximately hourly.
- DataForSEO search momentum: approximately daily / when stale.
- YouTube channel observations: approximately daily / when stale.
- NewsData, Webz, TMDB, Last.fm, SportsDB: cost-controlled rotating collection with stored observations retained between collection days.

Price calculation reads stored observations; it does not make third-party network requests.

## Vercel security

Set a long random value as `CRON_SECRET` in Vercel. Vercel Cron sends this value in the `Authorization: Bearer ...` header. Set `NITRO_MARKET_REFRESH_SECRET` to the same value if you also want an external scheduler to use the same Bearer token.

If no server-side refresh secret is configured, the scheduling endpoint returns HTTP 503 rather than becoming a public expensive endpoint.

## Vercel Hobby

Keep `vercel.json` at the existing once-per-day schedule. Hobby currently only permits native Vercel Cron jobs once per day, so committing a `*/2 * * * *` schedule can block deployment validation.

For two-minute market ticks on Hobby, configure an external scheduler that supports custom request headers:

- URL: `https://<production-domain>/api/internal/market-refresh?mode=cycle`
- Frequency: every 2 minutes
- Header: `Authorization: Bearer <same-secret>`

The existing daily Vercel cron remains as a fallback. If the external scheduler stops, the next daily Vercel invocation will perform a collection because the collection window is overdue.

## Vercel Pro / Enterprise

Pro and Enterprise support much more frequent native cron schedules. After confirming the production cycle endpoint and observation collection are healthy, the `vercel.json` cron can be changed to:

`*/2 * * * *`

Do not make that change while the project is on Hobby.

## Distributed safety

`market_scheduler_state` contains a database-backed lease. This prevents simultaneous Vercel, external-scheduler, and manual-admin runs from processing the same cycle concurrently. If another invocation arrives while the lease is active, it returns a successful `skipped` result instead of starting duplicate work.

## Live prices vs source snapshots

`market_snapshots` remains the approved history of real-world observation recalculations.

`market_live_prices` holds one current row per celebrity plus the most recent real-world source price. Two-minute ticks update this row without inserting hundreds of historical snapshot rows. When a full external observation refresh completes, live prices and their source anchors are reseeded from the newly approved source snapshots.
