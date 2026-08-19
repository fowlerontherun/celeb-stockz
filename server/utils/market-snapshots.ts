import { sql } from "./db";
import {
  celebrityMarkets,
  calculateMarketPrice,
  type CelebrityMarket,
} from "./markets";
import { getMarketMetadata, isEligibleMarket } from "./market-metadata";

type SnapshotRow = {
  ticker: string;
  captured_at: string;
  price_stkz: string;
  score: string;
  daily_change: string;
  pageviews: string | null;
  source_measurements: Record<string, unknown>;
  refresh_status: "verified" | "unavailable" | "flagged";
};

type PageviewResult = {
  views: number | null;
  status: "verified" | "unavailable";
};

const DAILY_MOVE_CAP = 15;
const REVIEW_MOVE_THRESHOLD = 30;
const SOURCE_CACHE_MS = 30 * 60 * 1000;
const pageviewCache = new Map<
  string,
  { result: PageviewResult; expiresAt: number }
>();

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function describePageviewChange(
  currentViews: number | null,
  previousViews: number | null,
) {
  if (currentViews === null || previousViews === null || previousViews <= 0) {
    return "Wikipedia interest was verified in the latest refresh.";
  }

  const change = ((currentViews - previousViews) / previousViews) * 100;
  const direction = change >= 0 ? "up" : "down";

  return `Wikipedia views ${direction} ${Math.abs(change).toFixed(1)}%.`;
}

async function getWikipediaViews(article: string): Promise<PageviewResult> {
  const cached = pageviewCache.get(article);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = formatDate(yesterday);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${date}/${date}`;

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "CelebStockz practice-market signal monitor",
      },
    });

    if (!response.ok) {
      return { views: null, status: "unavailable" };
    }

    const data = (await response.json()) as {
      items?: Array<{ views?: number }>;
    };
    const views = data.items?.[0]?.views ?? null;

    if (
      views !== null &&
      (!Number.isSafeInteger(views) || views < 0 || views > 1_000_000_000)
    ) {
      console.error("Unexpected Wikimedia pageview response", {
        article,
        views,
      });
      return { views: null, status: "unavailable" };
    }

    const result: PageviewResult = { views, status: "verified" };
    pageviewCache.set(article, {
      result,
      expiresAt: Date.now() + SOURCE_CACHE_MS,
    });

    return result;
  } catch (error) {
    console.error("Wikimedia signal refresh failed", {
      article,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { views: null, status: "unavailable" };
  }
}

function calculateTransparentScore(
  market: CelebrityMarket,
  pageviews: number | null,
) {
  const baseline = calculateMarketPrice(market.signals);
  const pageviewBoost = pageviews
    ? Math.min(18, Math.log10(Math.max(pageviews, 1)) * 2.2)
    : 0;

  return Number((baseline + pageviewBoost).toFixed(4));
}

async function getLatestVerifiedSnapshot(ticker: string) {
  const rows = await sql<SnapshotRow[]>`
    SELECT
      ticker,
      captured_at,
      price_stkz,
      score,
      daily_change,
      pageviews,
      source_measurements,
      refresh_status
    FROM market_snapshots
    WHERE ticker = ${ticker} AND refresh_status = 'verified'
    ORDER BY captured_at DESC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getLatestVerifiedPrices() {
  const rows = await sql<Pick<SnapshotRow, "ticker" | "price_stkz">[]>`
    SELECT DISTINCT ON (ticker) ticker, price_stkz
    FROM market_snapshots
    WHERE refresh_status = 'verified'
    ORDER BY ticker, captured_at DESC
  `;

  return new Map(rows.map((row) => [row.ticker, Number(row.price_stkz)]));
}

export async function refreshMarketSnapshots() {
  const startedAt = new Date().toISOString();
  const eligibleMarkets = celebrityMarkets.filter(isEligibleMarket);
  let verifiedCount = 0;
  let unavailableCount = 0;
  let flaggedCount = 0;

  for (const market of eligibleMarkets) {
    const metadata = getMarketMetadata(market);
    const pageviews = await getWikipediaViews(metadata.wikipediaTitle);
    const previous = await getLatestVerifiedSnapshot(market.ticker);
    const previousPageviews =
      previous?.pageviews === null || previous?.pageviews === undefined
        ? null
        : Number(previous.pageviews);

    if (pageviews.status === "unavailable" && previous) {
      unavailableCount += 1;

      await sql`
        INSERT INTO market_snapshots (
          ticker, price_stkz, score, daily_change, pageviews, official_reach,
          source_measurements, refresh_status
        )
        VALUES (
          ${market.ticker},
          ${Number(previous.price_stkz)},
          ${Number(previous.score)},
          0,
          null,
          ${market.signals.socialFollowersMillions * 1_000_000},
          ${JSON.stringify({
            wikipedia: {
              article: metadata.wikipediaTitle,
              status: "unavailable",
            },
            fallback: {
              capturedAt: previous.captured_at,
              reason: "Retained last verified snapshot",
            },
          })}::jsonb,
          'unavailable'
        )
      `;
      continue;
    }

    const score = calculateTransparentScore(market, pageviews.views);
    const previousPrice = previous ? Number(previous.price_stkz) : score;
    const rawMove = previousPrice
      ? ((score - previousPrice) / previousPrice) * 100
      : 0;
    const movementReason = describePageviewChange(
      pageviews.views,
      previousPageviews,
    );

    if (previous && Math.abs(rawMove) > REVIEW_MOVE_THRESHOLD) {
      flaggedCount += 1;

      await sql`
        INSERT INTO market_snapshots (
          ticker, price_stkz, score, daily_change, pageviews, official_reach,
          source_measurements, refresh_status
        )
        VALUES (
          ${market.ticker},
          ${previousPrice},
          ${score},
          0,
          ${pageviews.views},
          ${market.signals.socialFollowersMillions * 1_000_000},
          ${JSON.stringify({
            wikipedia: {
              article: metadata.wikipediaTitle,
              dailyPageviews: pageviews.views,
              previousDailyPageviews: previousPageviews,
              status: pageviews.status,
            },
            anomaly: {
              rawMove: Number(rawMove.toFixed(3)),
              reason: "Movement exceeds manual-review threshold",
            },
          })}::jsonb,
          'flagged'
        )
      `;
      continue;
    }

    const dailyChange = Math.max(
      -DAILY_MOVE_CAP,
      Math.min(DAILY_MOVE_CAP, rawMove),
    );
    const price = Number(
      (previousPrice * (1 + dailyChange / 100)).toFixed(2),
    );

    verifiedCount += 1;
    await sql`
      INSERT INTO market_snapshots (
        ticker, price_stkz, score, daily_change, pageviews, official_reach,
        source_measurements, refresh_status
      )
      VALUES (
        ${market.ticker},
        ${price},
        ${score},
        ${dailyChange},
        ${pageviews.views},
        ${market.signals.socialFollowersMillions * 1_000_000},
        ${JSON.stringify({
          wikipedia: {
            article: metadata.wikipediaTitle,
            dailyPageviews: pageviews.views,
            previousDailyPageviews: previousPageviews,
            status: pageviews.status,
          },
          movementReason,
          officialPlatformReach: {
            value: market.signals.socialFollowersMillions * 1_000_000,
            status: "modeled-baseline",
          },
          searchMomentum: { status: "not-connected" },
          newsCoverage: { status: "not-connected" },
        })}::jsonb,
        'verified'
      )
    `;
  }

  const status = unavailableCount || flaggedCount ? "degraded" : "healthy";

  await sql`
    INSERT INTO market_source_health (
      source_key, status, last_checked_at, last_success_at, detail
    )
    VALUES (
      'wikimedia-pageviews',
      ${status},
      now(),
      ${verifiedCount > 0 ? new Date().toISOString() : null},
      ${`${verifiedCount} verified, ${unavailableCount} unavailable, ${flaggedCount} flagged`}
    )
    ON CONFLICT (source_key) DO UPDATE
    SET
      status = EXCLUDED.status,
      last_checked_at = EXCLUDED.last_checked_at,
      last_success_at = EXCLUDED.last_success_at,
      detail = EXCLUDED.detail
  `;

  await sql`
    INSERT INTO market_refresh_log (
      started_at, completed_at, status, refreshed_count, verified_count,
      unavailable_count, flagged_count, detail
    )
    VALUES (
      ${startedAt},
      now(),
      ${status},
      ${eligibleMarkets.length},
      ${verifiedCount},
      ${unavailableCount},
      ${flaggedCount},
      ${"Wikimedia pageview refresh"}
    )
  `;

  return {
    refreshed: eligibleMarkets.length,
    verifiedCount,
    unavailableCount,
    flaggedCount,
    refreshedAt: new Date().toISOString(),
  };
}

export async function getSnapshotMarkets() {
  const eligibleMarkets = celebrityMarkets.filter(isEligibleMarket);
  const rows = await sql<SnapshotRow[]>`
    SELECT DISTINCT ON (ticker)
      ticker,
      captured_at,
      price_stkz,
      score,
      daily_change,
      pageviews,
      source_measurements,
      refresh_status
    FROM market_snapshots
    WHERE refresh_status = 'verified'
    ORDER BY ticker, captured_at DESC
  `;
  const snapshots = new Map(rows.map((row) => [row.ticker, row]));

  return eligibleMarkets.map((market) => {
    const snapshot = snapshots.get(market.ticker);
    const metadata = getMarketMetadata(market);
    const measurements = snapshot?.source_measurements;
    const movementReason =
      typeof measurements?.movementReason === "string"
        ? measurements.movementReason
        : "Using the current approved practice-market signal baseline.";

    return {
      ...market,
      price: snapshot
        ? Number(snapshot.price_stkz)
        : calculateMarketPrice(market.signals),
      change: snapshot ? Number(snapshot.daily_change) : market.change,
      metadata,
      snapshot: snapshot
        ? {
            capturedAt: snapshot.captured_at,
            score: Number(snapshot.score),
            pageviews: snapshot.pageviews ? Number(snapshot.pageviews) : null,
            movementReason,
            refreshStatus: "verified" as const,
          }
        : {
            capturedAt: null,
            score: calculateMarketPrice(market.signals),
            pageviews: null,
            movementReason:
              "Waiting for the first approved public-signal snapshot.",
            refreshStatus: "fallback" as const,
          },
    };
  });
}

export async function getRecentSnapshotHistory(ticker: string) {
  const rows = await sql<SnapshotRow[]>`
    SELECT
      ticker, captured_at, price_stkz, score, daily_change, pageviews,
      source_measurements, refresh_status
    FROM market_snapshots
    WHERE ticker = ${ticker} AND refresh_status = 'verified'
    ORDER BY captured_at DESC
    LIMIT 14
  `;

  return rows.reverse().map((row) => ({
    capturedAt: row.captured_at,
    price: Number(row.price_stkz),
    change: Number(row.daily_change),
    pageviews: row.pageviews ? Number(row.pageviews) : null,
  }));
}