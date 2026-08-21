import { sql } from "./db";

export type SignalObservation = {
  ticker: string;
  provider: string;
  metric: string;
  value: number | null;
  status: "verified" | "unavailable";
  capturedAt: string;
  metadata: Record<string, unknown>;
};

type ObservationRow = {
  ticker: string;
  provider: string;
  metric: string;
  value: string | null;
  status: "verified" | "unavailable";
  captured_at: string;
  metadata: Record<string, unknown> | null;
};

let schemaPromise: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS market_signal_observations (
          id bigserial PRIMARY KEY,
          ticker text NOT NULL,
          provider text NOT NULL,
          metric text NOT NULL,
          value double precision,
          status text NOT NULL,
          captured_at timestamptz NOT NULL DEFAULT now(),
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS market_signal_observations_lookup_idx
        ON market_signal_observations (ticker, provider, metric, captured_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS market_signal_observations_provider_time_idx
        ON market_signal_observations (provider, captured_at DESC)
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

function mapObservation(row: ObservationRow): SignalObservation {
  const numericValue = row.value === null ? null : Number(row.value);
  return {
    ticker: row.ticker,
    provider: row.provider,
    metric: row.metric,
    value:
      numericValue !== null && Number.isFinite(numericValue)
        ? numericValue
        : null,
    status: row.status,
    capturedAt: row.captured_at,
    metadata: row.metadata ?? {},
  };
}

export async function getLatestSignalObservation(
  ticker: string,
  provider: string,
  metric: string,
): Promise<SignalObservation | null> {
  try {
    await ensureSchema();
    const rows = await sql<ObservationRow[]>`
      SELECT ticker, provider, metric, value, status, captured_at, metadata
      FROM market_signal_observations
      WHERE ticker = ${ticker}
        AND provider = ${provider}
        AND metric = ${metric}
      ORDER BY captured_at DESC
      LIMIT 1
    `;
    return rows[0] ? mapObservation(rows[0]) : null;
  } catch (error) {
    console.warn("Could not read market signal observation", error);
    return null;
  }
}

export async function getRecentVerifiedSignalObservations(
  ticker: string,
  provider: string,
  metric: string,
  limit = 6,
): Promise<SignalObservation[]> {
  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit)));

  try {
    await ensureSchema();
    const rows = await sql<ObservationRow[]>`
      SELECT ticker, provider, metric, value, status, captured_at, metadata
      FROM market_signal_observations
      WHERE ticker = ${ticker}
        AND provider = ${provider}
        AND metric = ${metric}
        AND status = 'verified'
        AND value IS NOT NULL
      ORDER BY captured_at DESC
      LIMIT ${safeLimit}
    `;
    return rows.map(mapObservation);
  } catch (error) {
    console.warn("Could not read market signal observation history", error);
    return [];
  }
}

export async function recordSignalObservation(input: {
  ticker: string;
  provider: string;
  metric: string;
  value: number | null;
  status: "verified" | "unavailable";
  metadata?: Record<string, unknown>;
}) {
  try {
    await ensureSchema();
    const metadata = input.metadata ?? {};
    await sql`
      INSERT INTO market_signal_observations (
        ticker, provider, metric, value, status, metadata
      )
      VALUES (
        ${input.ticker},
        ${input.provider},
        ${input.metric},
        ${input.value},
        ${input.status},
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
    return true;
  } catch (error) {
    console.warn("Could not persist market signal observation", error);
    return false;
  }
}
