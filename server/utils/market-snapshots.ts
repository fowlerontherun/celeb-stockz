import { sql } from "./db";
import { celebrityMarkets, calculateMarketPrice, type CelebrityMarket } from "./markets";
import { getMarketMetadata, isEligibleMarket } from "./market-metadata";

type SnapshotRow = {
  ticker: string;
  captured_at: string;
  price_stkz: string;
  score: string;
  daily_change: string;
  pageviews: string | null;
  source_measurements: Record<string, unknown>;
};

type PageviewResult = {
  views: number | null;
  status: "verified" | "unavailable";
};

const DAILY_MOVE_CAP = 15;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function getWikipediaViews(article: string): Promise<PageviewResult> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const start = formatDate(yesterday);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${start}/${start}`;

  try {
    const response = await fetch(url, {
      headers: { "user-agent": "CelebStockz practice-market signal monitor" },
    });

    if (!response.ok) return { views: null, status: "unavailable" };

    const data = (await response.json()) as {
      items?: Array<{ views?: number }>;
    };

    return {
      views: data.items?.[0]?.views ?? null,
      status: "verified",
    };
  } catch {
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

async function getLatestSnapshot(ticker: string) {
  const rows = await sql<SnapshotRow[]>`
    SELECT ticker, captured_at, price_stkz, score, daily_change, pageviews, source_measurements
    FROM market_snapshots
    WHERE ticker = ${ticker}
    ORDER BY captured_at DESC
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function refreshMarketSnapshots() {
  const eligibleMarkets = celebrityMarkets.filter(isEligibleMarket);
  let verifiedCount = 0;
  let unavailableCount = 0;

  for (const market of eligibleMarkets) {
    const metadata = getMarketMetadata(market);
    const pageviews = await getWikipediaViews(metadata.wikipediaTitle);
    const previous = await getLatestSnapshot(market.ticker);
    const score = calculateTransparentScore(market, pageviews.views);
    const proposedPrice = score;
    const previousPrice = previous ? Number(previous.price_stkz) : proposedPrice;
    const rawMove = previousPrice
      ? ((proposedPrice - previousPrice) / previousPrice) * 100
      : 0;
    const dailyChange = Math.max(
      -DAILY_MOVE_CAP,
      Math.min(DAILY_MOVE_CAP, rawMove),
    );
    const price = Number(
      (previousPrice * (1 + dailyChange / 100)).toFixed(2),
    );
    const status = pageviews.status;

    if (status === "verified") verifiedCount += 1;
    else unavailableCount += 1;

    await sql`
      INSERT INTO market_snapshots (
        ticker, price_stkz, score, daily_change, pageviews, official_reach,
        source_measurements, refresh_status
      )
      VALUES (
        ${market.ticker}, ${price}, ${score}, ${dailyChange},
        ${pageviews.views}, ${market.signals.socialFollowersMillions * 1_000_000},
        ${JSON.stringify({
          wikipedia: {
            article: metadata.wikipediaTitle,
            dailyPageviews: pageviews.views,
            status,
          },
          officialPlatformReach: {
            value: market.signals.socialFollowersMillions * 1_000_000,
            status: "modeled-baseline",
          },
          searchMomentum: { status: "not-connected" },
          newsCoverage: { status: "not-connected" },
        })}::jsonb,
        ${status}
      )
    `;
  }

  await sql`
    INSERT INTO market_source_health (
      source_key, status, last_checked_at, last_success_at, detail
    )
    VALUES (
      'wikimedia-pageviews',
      ${unavailableCount === 0 ? "healthy" : "degraded"},
      now(),
      ${verifiedCount > 0 ? new Date().toISOString() : null},
      ${`${verifiedCount} verified, ${unavailableCount} unavailable`}
    )
    ON CONFLICT (source_key) DO UPDATE
    SET
      status = EXCLUDED.status,
      last_checked_at = EXCLUDED.last_checked_at,
      last_success_at = EXCLUDED.last_success_at,
      detail = EXCLUDED.detail
  `;

  return {
    refreshed: eligibleMarkets.length,
    verifiedCount,
    unavailableCount,
    refreshedAt: new Date().toISOString(),
  };
}

export async function getSnapshotMarkets() {
  const eligibleMarkets = celebrityMarkets.filter(isEligibleMarket);
  const rows = await sql<SnapshotRow[]>`
    SELECT DISTINCT ON (ticker)
      ticker, captured_at, price_stkz, score, daily_change, pageviews, source_measurements
    FROM market_snapshots
    ORDER BY ticker, captured_at DESC
  `;
  const snapshots = new Map(rows.map((row) => [row.ticker, row]));

  return eligibleMarkets.map((market) => {
    const snapshot = snapshots.get(market.ticker);
    const metadata = getMarketMetadata(market);

    return {
      ...market,
      price: snapshot ? Number(snapshot.price_stkz) : calculateMarketPrice(market.signals),
      change: snapshot ? Number(snapshot.daily_change) : market.change,
      metadata,
      snapshot: snapshot
        ? {
            capturedAt: snapshot.captured_at,
            score: Number(snapshot.score),
            pageviews: snapshot.pageviews ? Number(snapshot.pageviews) : null,
            measurements: snapshot.source_measurements,
            refreshStatus: "verified" as const,
          }
        : {
            capturedAt: null,
            score: calculateMarketPrice(market.signals),
            pageviews: null,
            measurements: null,
            refreshStatus: "fallback" as const,
          },
    };
  });
}

export async function getRecentSnapshotHistory(ticker: string) {
  const rows = await sql<SnapshotRow[]>`
    SELECT ticker, captured_at, price_stkz, score, daily_change, pageviews, source_measurements
    FROM market_snapshots
    WHERE ticker = ${ticker}
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