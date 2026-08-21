# CelebStockz market scheduler

CelebStockz separates **price ticks** from **third-party data collection**.

A scheduler may call the market-cycle endpoint every two minutes without causing every external API to be polled every two minutes. Normal tick cycles only use stored observations plus the current 24-hour practice-trade pressure. More expensive collection cycles run at a controlled cadence and store refreshed observations before recalculating source snapshots.

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
4. Updates only celebrities whose pressure actually changed.
5. Caps a single tick to ±1.5% and the displayed daily movement to ±35%.
6. Processes open orders if any live prices changed.
7. Releases the lease.

No Wikimedia, GDELT, DataForSEO, YouTube, NewsData, Webz, TMDB, Last.fm, or SportsDB request is made by a normal price tick.

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

`market_live_prices` holds one current row per celebrity. Two-minute practice-trade ticks update this row without inserting hundreds of historical snapshot rows. When a full external observation refresh completes, live prices are reseeded from the newly approved source snapshots.
