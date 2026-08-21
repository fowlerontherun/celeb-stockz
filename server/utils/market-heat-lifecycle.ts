import { sql } from "./db";

const MATERIAL_SCORE_CHANGE = 2;
let schemaPromise: Promise<void> | null = null;

type HeatSummaryRow = {
  hot_count: string;
  viral_count: string;
};

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

  await sql`
    INSERT INTO market_heat_lifecycle AS lifecycle (
      ticker,
      heat_score,
      heat_state,
      started_at,
      expires_at,
      updated_at
    )
    SELECT
      ticker,
      heat_score,
      CASE
        WHEN heat_state IN ('hot', 'viral') THEN heat_state
        ELSE 'normal'
      END,
      CASE
        WHEN heat_state IN ('hot', 'viral') THEN now()
        ELSE NULL
      END,
      CASE
        WHEN heat_state = 'viral' THEN now() + interval '3 hours'
        WHEN heat_state = 'hot' THEN now() + interval '4 hours'
        ELSE NULL
      END,
      now()
    FROM market_live_prices
    ON CONFLICT (ticker) DO UPDATE
    SET
      heat_score = CASE
        WHEN EXCLUDED.heat_state = 'normal' THEN EXCLUDED.heat_score
        WHEN lifecycle.heat_state IS DISTINCT FROM EXCLUDED.heat_state
          OR abs(EXCLUDED.heat_score - lifecycle.heat_score) >= ${MATERIAL_SCORE_CHANGE}
          OR lifecycle.started_at IS NULL
        THEN EXCLUDED.heat_score
        ELSE lifecycle.heat_score
      END,
      heat_state = EXCLUDED.heat_state,
      started_at = CASE
        WHEN EXCLUDED.heat_state = 'normal' THEN NULL
        WHEN lifecycle.heat_state IS DISTINCT FROM EXCLUDED.heat_state
          OR abs(EXCLUDED.heat_score - lifecycle.heat_score) >= ${MATERIAL_SCORE_CHANGE}
          OR lifecycle.started_at IS NULL
        THEN now()
        ELSE lifecycle.started_at
      END,
      expires_at = CASE
        WHEN EXCLUDED.heat_state = 'normal' THEN NULL
        WHEN lifecycle.heat_state IS DISTINCT FROM EXCLUDED.heat_state
          OR abs(EXCLUDED.heat_score - lifecycle.heat_score) >= ${MATERIAL_SCORE_CHANGE}
          OR lifecycle.expires_at IS NULL
        THEN now() + CASE
          WHEN EXCLUDED.heat_state = 'viral' THEN interval '3 hours'
          ELSE interval '4 hours'
        END
        ELSE lifecycle.expires_at
      END,
      updated_at = now()
  `;

  await sql`
    UPDATE market_live_prices AS live
    SET heat_expires_at = lifecycle.expires_at
    FROM market_heat_lifecycle AS lifecycle
    WHERE lifecycle.ticker = live.ticker
  `;

  const summary = await sql<HeatSummaryRow[]>`
    SELECT
      count(*) FILTER (
        WHERE heat_state = 'hot' AND expires_at > now()
      )::text AS hot_count,
      count(*) FILTER (
        WHERE heat_state = 'viral' AND expires_at > now()
      )::text AS viral_count
    FROM market_heat_lifecycle
  `;

  return {
    hotCount: Number(summary[0]?.hot_count ?? 0),
    viralCount: Number(summary[0]?.viral_count ?? 0),
    stabilizedAt: new Date().toISOString(),
  };
}
