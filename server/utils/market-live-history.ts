import { sql } from "./db";
import { getLivePriceMap } from "./live-prices";

export type LivePriceHistoryPoint = {
  capturedAt: string;
  price: number;
  change: number;
};

type LiveHistoryRow = {
  captured_at: string;
  price_stkz: string;
  daily_change: string;
};

const DEFAULT_HISTORY_BUCKET_MINUTES = 15;
const WRITE_CONCURRENCY = 30;
let schemaPromise: Promise<void> | null = null;

function configuredHistoryBucketMinutes() {
  const value = Number(
    process.env.NITRO_GAME_HISTORY_BUCKET_MINUTES ??
      DEFAULT_HISTORY_BUCKET_MINUTES,
  );
  if (!Number.isFinite(value)) return DEFAULT_HISTORY_BUCKET_MINUTES;
  return Math.max(5, Math.min(60, Math.round(value)));
}

function currentBucketStart() {
  const bucketMs = configuredHistoryBucketMinutes() * 60 * 1000;
  return new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString();
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS market_live_price_history (
          ticker text NOT NULL,
          captured_at timestamptz NOT NULL,
          price_stkz double precision NOT NULL,
          daily_change double precision NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (ticker, captured_at)
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS market_live_price_history_ticker_captured_idx
        ON market_live_price_history (ticker, captured_at DESC)
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export async function recordLivePriceHistory() {
  await ensureSchema();
  const prices = [...(await getLivePriceMap()).values()];
  if (!prices.length) return 0;

  const capturedAt = currentBucketStart();

  for (const wave of chunk(prices, WRITE_CONCURRENCY)) {
    await Promise.all(
      wave.map((price) => sql`
        INSERT INTO market_live_price_history (
          ticker,
          captured_at,
          price_stkz,
          daily_change
        )
        VALUES (
          ${price.ticker},
          ${capturedAt},
          ${price.price},
          ${price.dailyChange}
        )
        ON CONFLICT (ticker, captured_at) DO UPDATE
        SET
          price_stkz = EXCLUDED.price_stkz,
          daily_change = EXCLUDED.daily_change
      `),
    );
  }

  return prices.length;
}

export async function getRecentLivePriceHistory(
  ticker: string,
  limit = 200,
): Promise<LivePriceHistoryPoint[]> {
  await ensureSchema();
  const safeLimit = Math.max(1, Math.min(1500, Math.round(limit)));
  const rows = await sql<LiveHistoryRow[]>`
    SELECT captured_at, price_stkz, daily_change
    FROM market_live_price_history
    WHERE ticker = ${ticker}
    ORDER BY captured_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.reverse().map((row) => ({
    capturedAt: row.captured_at,
    price: Number(row.price_stkz),
    change: Number(row.daily_change),
  }));
}
