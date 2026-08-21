import { sql } from "./db";
import { getPracticeTradePressureMap } from "./additional-price-signals";

type LivePriceRow = {
  ticker: string;
  price_stkz: string;
  daily_change: string;
  trade_pressure: string;
  source_captured_at: string | null;
  updated_at: string;
};

export type LivePrice = {
  ticker: string;
  price: number;
  dailyChange: number;
  tradePressure: number;
  sourceCapturedAt: string | null;
  updatedAt: string;
};

const MAX_TICK_MOVE_PERCENT = 1.5;
const DAILY_MOVE_CAP = 35;
const UPDATE_CONCURRENCY = 30;
let schemaPromise: Promise<void> | null = null;

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
        CREATE TABLE IF NOT EXISTS market_live_prices (
          ticker text PRIMARY KEY,
          price_stkz double precision NOT NULL,
          daily_change double precision NOT NULL DEFAULT 0,
          trade_pressure double precision NOT NULL DEFAULT 0,
          source_captured_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS market_live_prices_updated_idx
        ON market_live_prices (updated_at DESC)
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function mapLivePrice(row: LivePriceRow): LivePrice {
  return {
    ticker: row.ticker,
    price: Number(row.price_stkz),
    dailyChange: Number(row.daily_change),
    tradePressure: Number(row.trade_pressure),
    sourceCapturedAt: row.source_captured_at,
    updatedAt: row.updated_at,
  };
}

export async function syncLivePricesFromSnapshots() {
  await ensureSchema();
  await sql`
    INSERT INTO market_live_prices (
      ticker,
      price_stkz,
      daily_change,
      trade_pressure,
      source_captured_at,
      updated_at
    )
    SELECT DISTINCT ON (ticker)
      ticker,
      price_stkz::double precision,
      daily_change::double precision,
      COALESCE(
        NULLIF(source_measurements -> 'additionalSignals' ->> 'practiceTradePressure', '')::double precision,
        0
      ),
      captured_at,
      now()
    FROM market_snapshots
    WHERE refresh_status = 'verified'
    ORDER BY ticker, captured_at DESC
    ON CONFLICT (ticker) DO UPDATE
    SET
      price_stkz = EXCLUDED.price_stkz,
      daily_change = EXCLUDED.daily_change,
      trade_pressure = EXCLUDED.trade_pressure,
      source_captured_at = EXCLUDED.source_captured_at,
      updated_at = now()
  `;
}

export async function getLivePriceMap() {
  await ensureSchema();
  const rows = await sql<LivePriceRow[]>`
    SELECT ticker, price_stkz, daily_change, trade_pressure, source_captured_at, updated_at
    FROM market_live_prices
  `;
  return new Map(rows.map((row) => [row.ticker, mapLivePrice(row)]));
}

export async function applyLivePriceTick() {
  await ensureSchema();
  let rows = await sql<LivePriceRow[]>`
    SELECT ticker, price_stkz, daily_change, trade_pressure, source_captured_at, updated_at
    FROM market_live_prices
  `;

  if (!rows.length) {
    await syncLivePricesFromSnapshots();
    rows = await sql<LivePriceRow[]>`
      SELECT ticker, price_stkz, daily_change, trade_pressure, source_captured_at, updated_at
      FROM market_live_prices
    `;
  }

  const pressure = await getPracticeTradePressureMap();
  const updates = rows
    .map((row) => {
      const currentPrice = Number(row.price_stkz);
      const previousPressure = Number(row.trade_pressure);
      const currentPressure = pressure.get(row.ticker) ?? 0;
      const pressureDelta = currentPressure - previousPressure;

      if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !Number.isFinite(pressureDelta) ||
        Math.abs(pressureDelta) < 0.0001
      ) {
        return null;
      }

      const rawMovePercent = (pressureDelta / currentPrice) * 100;
      const movementPercent = Math.max(
        -MAX_TICK_MOVE_PERCENT,
        Math.min(MAX_TICK_MOVE_PERCENT, rawMovePercent),
      );
      const price = Number(
        Math.max(1, currentPrice * (1 + movementPercent / 100)).toFixed(2),
      );
      const dailyChange = Number(
        Math.max(
          -DAILY_MOVE_CAP,
          Math.min(
            DAILY_MOVE_CAP,
            Number(row.daily_change) + movementPercent,
          ),
        ).toFixed(3),
      );

      return {
        ticker: row.ticker,
        price,
        dailyChange,
        currentPressure,
        movementPercent: Number(movementPercent.toFixed(4)),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  for (const wave of chunk(updates, UPDATE_CONCURRENCY)) {
    await Promise.all(
      wave.map((update) => sql`
        UPDATE market_live_prices
        SET
          price_stkz = ${update.price},
          daily_change = ${update.dailyChange},
          trade_pressure = ${update.currentPressure},
          updated_at = now()
        WHERE ticker = ${update.ticker}
      `),
    );
  }

  return {
    updatedCount: updates.length,
    changedTickers: updates.map((update) => update.ticker),
    maxTickMovePercent: MAX_TICK_MOVE_PERCENT,
    tickedAt: new Date().toISOString(),
  };
}
