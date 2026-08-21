import { createError } from "nitro/h3";
import { sql } from "./db";
import { refreshMarketSnapshots } from "./market-snapshots";
import { processOpenOrders } from "./orders";
import { syncMarketRegistry } from "./market-registry";
import {
  refreshSearchMomentumObservations,
  refreshYoutubeObservations,
  type SearchMomentumRefreshSummary,
  type YoutubeObservationRefreshSummary,
} from "./additional-price-signals";
import {
  refreshExternalProviderObservations,
  type ExternalProviderRefreshSummary,
} from "./external-source-signals";

const minimumRefreshIntervalMs = 60_000;
let lastRefreshStartedAt = 0;

function emptyYoutubeSummary(): YoutubeObservationRefreshSummary {
  return {
    configured: false,
    mappedCount: 0,
    requestedCount: 0,
    verifiedCount: 0,
    unavailableCount: 0,
  };
}

function emptyExternalSummary(): ExternalProviderRefreshSummary {
  const empty = {
    configured: false,
    selectedCount: 0,
    requestedCount: 0,
    verifiedCount: 0,
    unavailableCount: 0,
  };
  return {
    newsdata: { ...empty },
    webz: { ...empty },
    tmdb: { ...empty },
    lastfm: { ...empty },
    sportsdb: { ...empty },
  };
}

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
    let youtubeObservationRefresh = emptyYoutubeSummary();
    let externalProviderRefresh = emptyExternalSummary();

    try {
      searchMomentumRefresh = await refreshSearchMomentumObservations();
    } catch (error) {
      const errorKind =
        error instanceof Error && error.name ? error.name : "UnknownError";
      console.warn(
        "Search momentum collection failed; pricing will use stored observations",
        { errorKind },
      );
    }

    try {
      youtubeObservationRefresh = await refreshYoutubeObservations();
    } catch (error) {
      const errorKind =
        error instanceof Error && error.name ? error.name : "UnknownError";
      console.warn(
        "YouTube observation collection failed; pricing will use stored observations",
        { errorKind },
      );
    }

    try {
      externalProviderRefresh = await refreshExternalProviderObservations();
    } catch (error) {
      const errorKind =
        error instanceof Error && error.name ? error.name : "UnknownError";
      console.warn(
        "External provider collection failed; pricing will use stored observations",
        { errorKind },
      );
    }

    const refresh = await refreshMarketSnapshots();

    if (refresh.verifiedCount > 0) {
      await processOpenOrders();
    }

    return {
      ...refresh,
      searchMomentumRefresh,
      youtubeObservationRefresh,
      externalProviderRefresh,
      // Compatibility field retained for older admin clients. Synthetic
      // intracycle movement has been removed; prices move only on verified
      // signal snapshots and completed trading activity.
      intracycleUpdated: 0,
      priceMovementModel: "observation-momentum-v2",
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
