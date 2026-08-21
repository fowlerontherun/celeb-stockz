import { sql } from "./db";
import { getPracticeTradePressureMap } from "./additional-price-signals";
import {
  calculateMarketHeatFromMeasurements,
  getHeatTradePressureMultiplier,
  getHeatVolatilityMultiplier,
  normalizeHeatState,
  type MarketHeatState,
} from "./market-heat";

type LivePriceRow = {
  ticker: string;
  price_stkz: string;
  source_price_stkz: string | null;
  daily_change: string;
  trade_pressure: string;
  heat_score: string | null;
  heat_state: string | null;
  heat_reason: string | null;
  heat_expires_at: string | null;
  source_captured_at: string | null;
  updated_at: string;
};

type SnapshotSeedRow = {
  ticker: string;
  price_stkz: string;
  daily_change: string;
  captured_at: string;
  source_measurements: Record<string, unknown>;
};

export type LivePrice = {
  ticker: string;
  price: number;
  sourcePrice: number;
  dailyChange: number;
  tradePressure: number;
  heatScore: number;
  heatState: MarketHeatState;
  heatReason: string;
  heatExpiresAt: string | null;
  volatilityMultiplier: number;
  sourceCapturedAt: string | null;
  updatedAt: string;
};

const DEFAULT_GAME_VOLATILITY_PERCENT = 0.9;
const DEFAULT_MAX_TICK_MOVE_PERCENT = 3;
const DEFAULT_DAILY_MOVE_CAP = 45;
const QUIET_MARKET_ROTATION_DIVISOR = 3;
const UPDATE_CONCURRENCY = 30;
const TICK_BUCKET_MS = 2 * 60 * 1000;
const HOT_DURATION_MS = 4 * 60 * 60 * 1000;
const VIRAL_DURATION_MS = 3 * 60 * 60 * 1000;
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
  return (stableHash(seed) % 20_001) / 10_000 - 1;
}

function marketVolatilityMultiplier(ticker: string) {
  return 0.75 + (stableHash(`${ticker}:game-volatility`) % 51) / 100;
}

function shouldPulseQuietMarket(ticker: string, bucket: number) {
  return (
    stableHash(`${ticker}:${bucket}:rotation`) % QUIET_MARKET_ROTATION_DIVISOR ===
    0
  );
}

function resolveActiveHeatState(
  state: string | null,
  expiresAt: string | null,
): MarketHeatState {
  const normalized = normalizeHeatState(state);
  if (normalized === "normal" || !expiresAt) return normalized;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now() ? normalized : "normal";
}

function heatExpiry(state: MarketHeatState, capturedAt: string) {
  if (state === "normal") return null;
  const captured = new Date(capturedAt).getTime();
  const start = Number.isFinite(captured) ? captured : Date.now();
  const duration = state === "viral" ? VIRAL_DURATION_MS : HOT_DURATION_MS;
  return new Date(start + duration).toISOString();
}

function gamePulsePercent(
  ticker: string,
  bucket: number,
  heatState: MarketHeatState,
) {
  const heatMultiplier = getHeatVolatilityMultiplier(heatState);
  const volatility =
    getGameVolatilityPercent() *
    marketVolatilityMultiplier(ticker) *
    heatMultiplier;
  const spikeChance = heatState === "viral" ? 22 : heatState === "hot" ? 14 : 7;
  const spikeMultiplier =
    heatState === "viral" ? 2.6 : heatState === "hot" ? 2.3 : 2.2;
  const spike =
    stableHash(`${ticker}:${bucket}:buzz-spike`) % 100 < spikeChance
      ? spikeMultiplier
      : 1;
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
          heat_score double precision NOT NULL DEFAULT 0,
          heat_state text NOT NULL DEFAULT 'normal',
          heat_reason text,
          heat_expires_at timestamptz,
          source_captured_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        ALTER TABLE market_live_prices
        ADD COLUMN IF NOT EXISTS source_price_stkz double precision
      `;
      await sql`
        ALTER TABLE market_live_prices
        ADD COLUMN IF NOT EXISTS heat_score double precision NOT NULL DEFAULT 0
      `;
      await sql`
        ALTER TABLE market_live_prices
        ADD COLUMN IF NOT EXISTS heat_state text NOT NULL DEFAULT 'normal'
      `;
      await sql`
        ALTER TABLE market_live_prices
        ADD COLUMN IF NOT EXISTS heat_reason text
      `;
      await sql`
        ALTER TABLE market_live_prices
        ADD COLUMN IF NOT EXISTS heat_expires_at timestamptz
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
      await sql`
        CREATE INDEX IF NOT EXISTS market_live_prices_heat_idx
        ON market_live_prices (heat_state, heat_score DESC)
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
  const heatState = resolveActiveHeatState(row.heat_state, row.heat_expires_at);
  return {
    ticker: row.ticker,
    price,
    sourcePrice:
      Number.isFinite(sourcePrice) && sourcePrice > 0 ? sourcePrice : price,
    dailyChange: Number(row.daily_change),
    tradePressure: Number(row.trade_pressure),
    heatScore: Number(row.heat_score ?? 0),
    heatState,
    heatReason:
      heatState === "normal" && normalizeHeatState(row.heat_state) !== "normal"
        ? "The recent attention spike has cooled."
        : row.heat_reason ?? "Real-world attention is within its normal range.",
    heatExpiresAt: heatState === "normal" ? null : row.heat_expires_at,
    volatilityMultiplier: getHeatVolatilityMultiplier(heatState),
    sourceCapturedAt: row.source_captured_at,
    updatedAt: row.updated_at,
  };
}

export async function syncLivePricesFromSnapshots() {
  await ensureSchema();
  const snapshots = await sql<SnapshotSeedRow[]>`
    SELECT DISTINCT ON (ticker)
      ticker,
      price_stkz,
      daily_change,
      captured_at,
      source_measurements
    FROM market_snapshots
    WHERE refresh_status = 'verified'
    ORDER BY ticker, captured_at DESC
  `;

  for (const wave of chunk(snapshots, UPDATE_CONCURRENCY)) {
    await Promise.all(
      wave.map(async (snapshot) => {
        const heat = calculateMarketHeatFromMeasurements(
          snapshot.source_measurements,
        );
        const tradePressure = Number(
          (
            snapshot.source_measurements?.additionalSignals as
              | Record<string, unknown>
              | undefined
          )?.practiceTradePressure ?? 0,
        );
        const safeTradePressure = Number.isFinite(tradePressure)
          ? tradePressure
          : 0;
        const expiresAt = heatExpiry(heat.state, snapshot.captured_at);

        await sql`
          INSERT INTO market_live_prices (
            ticker,
            price_stkz,
            source_price_stkz,
            daily_change,
            trade_pressure,
            heat_score,
            heat_state,
            heat_reason,
            heat_expires_at,
            source_captured_at,
            updated_at
          )
          VALUES (
            ${snapshot.ticker},
            ${Number(snapshot.price_stkz)},
            ${Number(snapshot.price_stkz)},
            ${Number(snapshot.daily_change)},
            ${safeTradePressure},
            ${heat.score},
            ${heat.state},
            ${heat.reason},
            ${expiresAt},
            ${snapshot.captured_at},
            now()
          )
          ON CONFLICT (ticker) DO UPDATE
          SET
            price_stkz = EXCLUDED.price_stkz,
            source_price_stkz = EXCLUDED.source_price_stkz,
            daily_change = EXCLUDED.daily_change,
            trade_pressure = EXCLUDED.trade_pressure,
            heat_score = EXCLUDED.heat_score,
            heat_state = EXCLUDED.heat_state,
            heat_reason = EXCLUDED.heat_reason,
            heat_expires_at = EXCLUDED.heat_expires_at,
            source_captured_at = EXCLUDED.source_captured_at,
            updated_at = now()
        `;
      }),
    );
  }
}

export async function getLivePriceMap() {
  await ensureSchema();
  const rows = await sql<LivePriceRow[]>`
    SELECT
      ticker,
      price_stkz,
      source_price_stkz,
      daily_change,
      trade_pressure,
      heat_score,
      heat_state,
      heat_reason,
      heat_expires_at,
      source_captured_at,
      updated_at
    FROM market_live_prices
  `;
  return new Map(rows.map((row) => [row.ticker, mapLivePrice(row)]));
}

export async function applyLivePriceTick() {
  await ensureSchema();
  let rows = await sql<LivePriceRow[]>`
    SELECT
      ticker,
      price_stkz,
      source_price_stkz,
      daily_change,
      trade_pressure,
      heat_score,
      heat_state,
      heat_reason,
      heat_expires_at,
      source_captured_at,
      updated_at
    FROM market_live_prices
  `;

  if (!rows.length) {
    await syncLivePricesFromSnapshots();
    rows = await sql<LivePriceRow[]>`
      SELECT
        ticker,
        price_stkz,
        source_price_stkz,
        daily_change,
        trade_pressure,
        heat_score,
        heat_state,
        heat_reason,
        heat_expires_at,
        source_captured_at,
        updated_at
      FROM market_live_prices
    `;
  }

  const pressure = await getPracticeTradePressureMap();
  const bucket = tickBucket();
  const baseMaxTickMovePercent = getMaxTickMovePercent();
  const dailyMoveCap = getDailyMoveCap();
  let pressureDrivenCount = 0;
  let buzzDrivenCount = 0;
  let hotMarketCount = 0;
  let viralMarketCount = 0;

  const updates = rows
    .map((row) => {
      const currentPrice = Number(row.price_stkz);
      const sourcePrice = Number(row.source_price_stkz ?? row.price_stkz);
      const previousPressure = Number(row.trade_pressure);
      const currentPressure = pressure.get(row.ticker) ?? 0;
      const pressureDelta = currentPressure - previousPressure;
      const pressureActive =
        Number.isFinite(pressureDelta) && Math.abs(pressureDelta) >= 0.0001;
      const heatState = resolveActiveHeatState(
        row.heat_state,
        row.heat_expires_at,
      );
      if (heatState === "hot") hotMarketCount += 1;
      if (heatState === "viral") viralMarketCount += 1;
      const heatVolatilityMultiplier = getHeatVolatilityMultiplier(heatState);
      const tradePressureMultiplier = getHeatTradePressureMultiplier(heatState);
      const gamePulseActive =
        heatState !== "normal" || shouldPulseQuietMarket(row.ticker, bucket);

      if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !Number.isFinite(sourcePrice) ||
        sourcePrice <= 0 ||
        (!pressureActive && !gamePulseActive)
      ) {
        return null;
      }

      const pressureCap = 2.25 * tradePressureMultiplier;
      const pressureMovePercent = pressureActive
        ? Math.max(
            -pressureCap,
            Math.min(
              pressureCap,
              pressureDelta * 0.45 * tradePressureMultiplier,
            ),
          )
        : 0;
      const pulsePercent = gamePulseActive
        ? gamePulsePercent(row.ticker, bucket, heatState)
        : 0;
      const distanceFromAnchorPercent =
        ((sourcePrice - currentPrice) / currentPrice) * 100;
      const reversionStrength =
        heatState === "viral" ? 0.06 : heatState === "hot" ? 0.1 : 0.18;
      const meanReversionPercent = Math.max(
        -0.75,
        Math.min(0.75, distanceFromAnchorPercent * reversionStrength),
      );
      const rawMovePercent =
        pressureMovePercent + pulsePercent + meanReversionPercent;
      const effectiveMaxTickMovePercent = Math.min(
        8,
        baseMaxTickMovePercent * heatVolatilityMultiplier,
      );
      const movementPercent = Math.max(
        -effectiveMaxTickMovePercent,
        Math.min(effectiveMaxTickMovePercent, rawMovePercent),
      );

      if (Math.abs(movementPercent) < 0.025) return null;

      const unconstrainedPrice = Math.max(
        1,
        currentPrice * (1 + movementPercent / 100),
      );
      const lowerPriceBound = Math.max(
        1,
        sourcePrice * (1 - dailyMoveCap / 100),
      );
      const upperPriceBound = Math.max(
        lowerPriceBound,
        sourcePrice * (1 + dailyMoveCap / 100),
      );
      const price = Number(
        Math.max(
          lowerPriceBound,
          Math.min(upperPriceBound, unconstrainedPrice),
        ).toFixed(2),
      );
      const actualMovementPercent =
        currentPrice > 0 ? ((price - currentPrice) / currentPrice) * 100 : 0;

      if (Math.abs(actualMovementPercent) < 0.001) return null;

      if (pressureActive) pressureDrivenCount += 1;
      if (gamePulseActive) buzzDrivenCount += 1;

      const previousDailyChange = Number(row.daily_change);
      const dailyChange = Number(
        Math.max(
          -dailyMoveCap,
          Math.min(
            dailyMoveCap,
            (Number.isFinite(previousDailyChange) ? previousDailyChange : 0) +
              actualMovementPercent,
          ),
        ).toFixed(3),
      );

      return {
        ticker: row.ticker,
        price,
        dailyChange,
        currentPressure,
        movementPercent: Number(actualMovementPercent.toFixed(4)),
        heatState,
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
    hotMarketCount,
    viralMarketCount,
    gameVolatilityPercent: getGameVolatilityPercent(),
    baseMaxTickMovePercent,
    hotMaxTickMovePercent: Math.min(
      8,
      baseMaxTickMovePercent * getHeatVolatilityMultiplier("hot"),
    ),
    viralMaxTickMovePercent: Math.min(
      8,
      baseMaxTickMovePercent * getHeatVolatilityMultiplier("viral"),
    ),
    dailyMoveCapPercent: dailyMoveCap,
    tickedAt: new Date().toISOString(),
  };
}
