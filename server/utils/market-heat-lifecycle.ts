import { sql } from "./db";
import { normalizeHeatState, type MarketHeatState } from "./market-heat";

const HOT_DURATION_MS = 4 * 60 * 60 * 1000;
const VIRAL_DURATION_MS = 3 * 60 * 60 * 1000;
const MATERIAL_SCORE_CHANGE = 2;
const UPDATE_CONCURRENCY = 30;
let schemaPromise: Promise<void> | null = null;

type LiveHeatRow = {
  ticker: string;
  heat_score: string;
  heat_state: string;
};

type LifecycleRow = {
  ticker: string;
  heat_score: string;
  heat_state: string;
  started_at: string | null;
  expires_at: string | null;
};

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function durationFor(state: MarketHeatState) {
  return state === "viral" ? VIRAL_DURATION_MS : HOT_DURATION_MS;
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS market_heat_lifecycle (
          ticker text PRIMARY KEY,
          heat_score double precision NOT NULL DEFAULT 0,
          heat_state text NOT NULL DEFAULT 'normal',
          started_at timestamptz,
          expires_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export async function stabilizeMarketHeatLifecycles() {
  await ensureSchema();

  const [liveRows, lifecycleRows] = await Promise.all([
    sql<LiveHeatRow[]>`
      SELECT ticker, heat_score, heat_state
      FROM market_live_prices
    `,
    sql<LifecycleRow[]>`
      SELECT ticker, heat_score, heat_state, started_at, expires_at
      FROM market_heat_lifecycle
    `,
  ]);
  const lifecycleByTicker = new Map(
    lifecycleRows.map((row) => [row.ticker, row]),
  );
  let hotCount = 0;
  let viralCount = 0;
  let renewedCount = 0;

  for (const wave of chunk(liveRows, UPDATE_CONCURRENCY)) {
    await Promise.all(
      wave.map(async (live) => {
        const state = normalizeHeatState(live.heat_state);
        const score = Number(live.heat_score);
        const safeScore = Number.isFinite(score) ? score : 0;
        const previous = lifecycleByTicker.get(live.ticker);

        if (state === "normal") {
          await Promise.all([
            sql`
              INSERT INTO market_heat_lifecycle (
                ticker, heat_score, heat_state, started_at, expires_at, updated_at
              )
              VALUES (${live.ticker}, ${safeScore}, 'normal', NULL, NULL, now())
              ON CONFLICT (ticker) DO UPDATE
              SET
                heat_score = EXCLUDED.heat_score,
                heat_state = 'normal',
                started_at = NULL,
                expires_at = NULL,
                updated_at = now()
            `,
            sql`
              UPDATE market_live_prices
              SET heat_expires_at = NULL
              WHERE ticker = ${live.ticker}
            `,
          ]);
          return;
        }

        if (state === "hot") hotCount += 1;
        if (state === "viral") viralCount += 1;

        const previousState = normalizeHeatState(previous?.heat_state);
        const episodeBaselineScore = Number(previous?.heat_score ?? 0);
        const scoreChanged =
          !Number.isFinite(episodeBaselineScore) ||
          Math.abs(safeScore - episodeBaselineScore) >= MATERIAL_SCORE_CHANGE;
        const newEpisode = !previous || previousState !== state || scoreChanged;
        const startedAt = newEpisode
          ? new Date().toISOString()
          : previous.started_at ?? new Date().toISOString();
        const expiresAt = newEpisode
          ? new Date(Date.now() + durationFor(state)).toISOString()
          : previous.expires_at ??
            new Date(Date.now() + durationFor(state)).toISOString();
        const storedBaselineScore = newEpisode
          ? safeScore
          : Number.isFinite(episodeBaselineScore)
            ? episodeBaselineScore
            : safeScore;

        if (newEpisode) renewedCount += 1;

        await Promise.all([
          sql`
            INSERT INTO market_heat_lifecycle (
              ticker, heat_score, heat_state, started_at, expires_at, updated_at
            )
            VALUES (
              ${live.ticker}, ${storedBaselineScore}, ${state}, ${startedAt}, ${expiresAt}, now()
            )
            ON CONFLICT (ticker) DO UPDATE
            SET
              heat_score = EXCLUDED.heat_score,
              heat_state = EXCLUDED.heat_state,
              started_at = EXCLUDED.started_at,
              expires_at = EXCLUDED.expires_at,
              updated_at = now()
          `,
          sql`
            UPDATE market_live_prices
            SET heat_expires_at = ${expiresAt}
            WHERE ticker = ${live.ticker}
          `,
        ]);
      }),
    );
  }

  return {
    hotCount,
    viralCount,
    renewedCount,
    stabilizedAt: new Date().toISOString(),
  };
}
