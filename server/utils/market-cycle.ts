import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { runMarketRefresh } from "./run-market-refresh";
import { applyLivePriceTick } from "./live-prices";
import { processOpenOrders } from "./orders";

type SchedulerRow = {
  last_collection_at: string | null;
  last_tick_at: string | null;
};

export type MarketCycleMode = "cycle" | "collect" | "tick";

const LEASE_MINUTES = 20;
const TICK_BUCKET_MS = 2 * 60 * 1000;
let schemaPromise: Promise<void> | null = null;

function getCollectionIntervalMinutes() {
  const configured = Number(process.env.NITRO_MARKET_COLLECTION_MINUTES ?? 60);
  if (!Number.isFinite(configured)) return 60;
  return Math.max(15, Math.min(1440, Math.round(configured)));
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS market_scheduler_state (
          id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
          last_collection_at timestamptz,
          last_tick_at timestamptz,
          lease_token text,
          lease_until timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        INSERT INTO market_scheduler_state (id)
        VALUES (true)
        ON CONFLICT (id) DO NOTHING
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function acquireLease(token: string) {
  await ensureSchema();
  const rows = await sql<SchedulerRow[]>`
    UPDATE market_scheduler_state
    SET
      lease_token = ${token},
      lease_until = now() + (${LEASE_MINUTES} * interval '1 minute'),
      updated_at = now()
    WHERE id = true
      AND (lease_until IS NULL OR lease_until < now())
    RETURNING last_collection_at, last_tick_at
  `;
  return rows[0] ?? null;
}

async function releaseLease(token: string) {
  await sql`
    UPDATE market_scheduler_state
    SET lease_token = NULL, lease_until = NULL, updated_at = now()
    WHERE id = true AND lease_token = ${token}
  `;
}

async function markCollection(token: string) {
  await sql`
    UPDATE market_scheduler_state
    SET
      last_collection_at = now(),
      last_tick_at = now(),
      updated_at = now()
    WHERE id = true AND lease_token = ${token}
  `;
}

async function markTick(token: string) {
  await sql`
    UPDATE market_scheduler_state
    SET last_tick_at = now(), updated_at = now()
    WHERE id = true AND lease_token = ${token}
  `;
}

function isCollectionDue(lastCollectionAt: string | null) {
  if (!lastCollectionAt) return true;
  const timestamp = new Date(lastCollectionAt).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return (
    Date.now() - timestamp >= getCollectionIntervalMinutes() * 60 * 1000
  );
}

function isTickDue(lastTickAt: string | null) {
  if (!lastTickAt) return true;
  const timestamp = new Date(lastTickAt).getTime();
  if (!Number.isFinite(timestamp)) return true;

  return (
    Math.floor(Date.now() / TICK_BUCKET_MS) >
    Math.floor(timestamp / TICK_BUCKET_MS)
  );
}

export async function runMarketCycle(mode: MarketCycleMode = "cycle") {
  const token = randomUUID();
  const state = await acquireLease(token);

  if (!state) {
    return {
      mode: "skipped" as const,
      reason: "Another market cycle currently holds the distributed lease.",
      collectionIntervalMinutes: getCollectionIntervalMinutes(),
      skippedAt: new Date().toISOString(),
    };
  }

  try {
    const collect =
      mode === "collect" ||
      (mode === "cycle" && isCollectionDue(state.last_collection_at));

    if (collect) {
      const result = await runMarketRefresh();
      await markCollection(token);
      return {
        mode: "collect" as const,
        collectionIntervalMinutes: getCollectionIntervalMinutes(),
        ...result,
      };
    }

    if (!isTickDue(state.last_tick_at)) {
      return {
        mode: "skipped" as const,
        reason: "This two-minute live-price bucket has already been processed.",
        collectionIntervalMinutes: getCollectionIntervalMinutes(),
        skippedAt: new Date().toISOString(),
      };
    }

    const tick = await applyLivePriceTick();
    if (tick.updatedCount > 0) {
      await processOpenOrders();
    }
    await markTick(token);

    return {
      mode: "tick" as const,
      collectionIntervalMinutes: getCollectionIntervalMinutes(),
      ...tick,
      priceMovementModel: "real-world-anchor-plus-game-volatility",
    };
  } finally {
    await releaseLease(token);
  }
}
