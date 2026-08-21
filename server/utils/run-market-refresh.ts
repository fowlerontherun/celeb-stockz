import { createError } from "nitro/h3";
import { sql } from "./db";
import { refreshMarketSnapshots } from "./market-snapshots";
import { processOpenOrders } from "./orders";
import { syncMarketRegistry } from "./market-registry";
import { applyIntracycleMovements } from "./intracycle-movement";
import {
  refreshSearchMomentumObservations,
  type SearchMomentumRefreshSummary,
} from "./additional-price-signals";

const minimumRefreshIntervalMs = 60_000;
let lastRefreshStartedAt = 0;

export async function runMarketRefresh() {
  if (Date.now() - lastRefreshStartedAt < minimumRefreshIntervalMs) {
    throw createError({
      statusCode: 429,
      statusMessage:
        "A market refresh was started recently. Please wait before trying again.",
    });
  }

  lastRefreshStartedAt = Date.now();
  const startedAt = new Date().toISOString();

  try {
    await syncMarketRegistry();

    let searchMomentumRefresh: SearchMomentumRefreshSummary = {
      configured: false,
      selectedCount: 0,
      requestedCount: 0,
      verifiedCount: 0,
      unavailableCount: 0,
    };
    try {
      searchMomentumRefresh = await refreshSearchMomentumObservations();
    } catch (error) {
      const errorKind =
        error instanceof Error && error.name ? error.name : "UnknownError";
      console.warn("Search momentum collection failed; pricing will use stored observations", {
        errorKind,
      });
    }

    const refresh = await refreshMarketSnapshots();
    const intracycleUpdated = await applyIntracycleMovements(startedAt);

    if (refresh.verifiedCount > 0) {
      await processOpenOrders();
    }

    return {
      ...refresh,
      searchMomentumRefresh,
      intracycleUpdated,
    };
  } catch (error) {
    const errorKind =
      error instanceof Error && error.name ? error.name : "UnknownError";

    console.error("Market refresh job stopped unexpectedly", { errorKind });

    try {
      await sql`
        INSERT INTO market_source_health (
          source_key, status, last_checked_at, detail
        )
        VALUES (
          'market-refresh-job',
          'degraded',
          now(),
          'The refresh job stopped unexpectedly. Review secure server logs.'
        )
        ON CONFLICT (source_key) DO UPDATE
        SET
          status = EXCLUDED.status,
          last_checked_at = EXCLUDED.last_checked_at,
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
          'degraded',
          0,
          0,
          0,
          0,
          'The refresh job stopped unexpectedly. Review secure server logs.'
        )
      `;
    } catch (loggingError) {
      const loggingErrorKind =
        loggingError instanceof Error && loggingError.name
          ? loggingError.name
          : "UnknownError";

      console.error("Could not record market refresh failure", {
        errorKind: loggingErrorKind,
      });
    }

    throw error;
  }
}
