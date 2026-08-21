import { sql } from "./db";
import { getPracticeTradePressureMap } from "./additional-price-signals";

type LivePriceRow = {
  ticker: string;
  price_stkz: string;
  source_price_stkz: string | null;
  daily_change: string;
  trade_pressure: string;
  source_captured_at: string | null;
  updated_at: string;
};

export type LivePrice = {
  ticker: string;
  price: number;
  sourcePrice: number;
  dailyChange: number;
  tradePressure: number;
  sourceCapturedAt: string | null;
  updatedAt: string;
};

const DEFAULT_GAME_VOLATILITY_PERCENT = 0.9;
const DEFAULT_MAX_TICK_MOVE_PERCENT = 3;
const DEFAULT_DAILY_MOVE_CAP = 45;
const QUIET_MARKET_ROTATION_DIVISOR = 3;
const UPDATE_CONCURRENCY = 30;
const TICK_BUCKET_MS = 2 * 60 * 1000;
let schemaPromise: Promise<void> | null = null;

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function stableHash(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}

function configuredNumber(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function getGameVolatilityPercent() {
  return configuredNumber(
    "NITRO_GAME_VOLATILITY_PERCENT",
    DEFAULT_GAME_VOLATILITY_PERCENT,
    0,
    2.5,
  );
}

function getMaxTickMovePercent() {
  return configuredNumber(
    "NITRO_GAME_MAX_TICK_MOVE_PERCENT",
    DEFAULT_MAX_TICK_MOVE_PERCENT,
    0.5,
    6,
  );
}

function getDailyMoveCap() {
  return configuredNumber(
    "NITRO_GAME_DAILY_MOVE_CAP_PERCENT",
    DEFAULT_DAILY_MOVE_CAP,
    20,
    75,
  );
}

function tickBucket() {
  return Math.floor(Date.now() / TICK_BUCKET_MS);
}

function signedUnit(seed: string) {
  return ((stableHash(seed) % 20_001) / 10_000) - 1;
}

function marketVolatilityMultiplier(ticker: string) {
  return 0.75 + (stableHash(`${ticker}:game-volatility`) % 51) / 100;
}

function shouldPulseQuietMarket(ticker: string, bucket: number) {
  return stableHash(`${ticker}:${bucket}:rotation`) % QUIET_MARKET_ROTATION_DIVISOR === 0;
}

function gamePulsePercent(ticker: string, bucket: number) {
  const volatility =
    getGameVolatilityPercent() * marketVolatilityMultiplier(ticker);
  const spike = stableHash(`${ticker}:${bucket}:buzz-spike`) % 100 < 7 ? 2.2 : 1;
  return signedUnit(`${ticker}:${bucket}:buzz-direction`) * volatility * spike;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS market_live_prices (
          ticker text PRIMARY KEY,
          price_stkz double precision NOT NULL,
          source_price_stkz double precision,
          daily_change double precision NOT NULL DEFAULT 0,
          trade_pressure double precision NOT NULL DEFAULT 0,
          source_captured_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        ALTER TABLE market_live_prices
        ADD COLUMN IF NOT EXISTS source_price_stkz double precision
      `;
      await sql`
        UPDATE market_live_prices
        SET source_price_stkz = price_stkz
        WHERE source_price_stkz IS NULL
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
  const price = Number(row.price_stkz);
  const sourcePrice = Number(row.source_price_stkz ?? row.price_stkz);
  return {
    ticker: row.ticker,
    price,
    sourcePrice: Number.isFinite(sourcePrice) && sourcePrice > 0 ? sourcePrice : price,
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
      source_price_stkz,
      daily_change,
      trade_pressure,
      source_captured_at,
      updated_at
    )
    SELECT DISTINCT ON (ticker)
      ticker,
      price_stkz::double precision,
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
      source_price_stkz = EXCLUDED.source_price_stkz,
      daily_change = EXCLUDED.daily_change,
      trade_pressure = EXCLUDED.trade_pressure,
      source_captured_at = EXCLUDED.source_captured_at,
      updated_at = now()
  `;
}

export async function getLivePriceMap() {
  await ensureSchema();
  const rows = await sql<LivePriceRow[]>`
    SELECT ticker, price_stkz, source_price_stkz, daily_change, trade_pressure, source_captured_at, updated_at
    FROM market_live_prices
  `;
  return new Map(rows.map((row) => [row.ticker, mapLivePrice(row)]));
}

export async function applyLivePriceTick() {
  await ensureSchema();
  let rows = await sql<LivePriceRow[]>`
    SELECT ticker, price_stkz, source_price_stkz, daily_change, trade_pressure, source_captured_at, updated_at
    FROM market_live_prices
  `;

  if (!rows.length) {
    await syncLivePricesFromSnapshots();
    rows = await sql<LivePriceRow[]>`
      SELECT ticker, price_stkz, source_price_stkz, daily_change, trade_pressure, source_captured_at, updated_at
      FROM market_live_prices
    `;
  }

  const pressure = await getPracticeTradePressureMap();
  const bucket = tickBucket();
  const maxTickMovePercent = getMaxTickMovePercent();
  const dailyMoveCap = getDailyMoveCap();
  let pressureDrivenCount = 0;
  let buzzDrivenCount = 0;

  const updates = rows
    .map((row) => {
      const currentPrice = Number(row.price_stkz);
      const sourcePrice = Number(row.source_price_stkz ?? row.price_stkz);
      const previousPressure = Number(row.trade_pressure);
      const currentPressure = pressure.get(row.ticker) ?? 0;
      const pressureDelta = currentPressure - previousPressure;
      const pressureActive =
        Number.isFinite(pressureDelta) && Math.abs(pressureDelta) >= 0.0001;
      const gamePulseActive = shouldPulseQuietMarket(row.ticker, bucket);

      if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !Number.isFinite(sourcePrice) ||
        sourcePrice <= 0 ||
        (!pressureActive && !gamePulseActive)
      ) {
        return null;
      }

      // Player activity is deliberately amplified because CelebStockz is a game,
      // not a passive analytics terminal. The hourly real-world snapshot remains
      // the anchor, while practice trading can create short-lived market drama.
      const pressureMovePercent = pressureActive
        ? Math.max(-2.25, Math.min(2.25, pressureDelta * 0.45))
        : 0;
      const pulsePercent = gamePulseActive
        ? gamePulsePercent(row.ticker, bucket)
        : 0;
      const distanceFromAnchorPercent =
        ((sourcePrice - currentPrice) / currentPrice) * 100;
      const meanReversionPercent = Math.max(
        -0.75,
        Math.min(0.75, distanceFromAnchorPercent * 0.18),
      );
      const rawMovePercent =
        pressureMovePercent + pulsePercent + meanReversionPercent;
      const movementPercent = Math.max(
        -maxTickMovePercent,
        Math.min(maxTickMovePercent, rawMovePercent),
      );

      if (Math.abs(movementPercent) < 0.025) return null;

      if (pressureActive) pressureDrivenCount += 1;
      if (gamePulseActive) buzzDrivenCount += 1;

      const price = Number(
        Math.max(1, currentPrice * (1 + movementPercent / 100)).toFixed(2),
      );
      const dailyChange = Number(
        Math.max(
          -dailyMoveCap,
          Math.min(
            dailyMoveCap,
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
    pressureDrivenCount,
    buzzDrivenCount,
    gameVolatilityPercent: getGameVolatilityPercent(),
    maxTickMovePercent,
    dailyMoveCapPercent: dailyMoveCap,
    tickedAt: new Date().toISOString(),
  };
}
