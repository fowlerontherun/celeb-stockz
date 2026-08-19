import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";

const adminEmails = new Set(
  [
    ...(process.env.NITRO_MARKET_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    "j.fowler1986@gmail.com",
  ],
);

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !adminEmails.has(session.user.email.toLowerCase())) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const [
    sources,
    recentRefreshes,
    snapshotCounts,
    executionCounts,
    systemSettings,
  ] = await Promise.all([
    sql`
      SELECT source_key, status, last_checked_at, last_success_at, detail
      FROM market_source_health
      ORDER BY source_key
    `,
    sql`
      SELECT
        started_at, completed_at, status, refreshed_count, verified_count,
        unavailable_count, flagged_count, detail
      FROM market_refresh_log
      ORDER BY started_at DESC
      LIMIT 20
    `,
    sql`
      WITH latest_verified AS (
        SELECT DISTINCT ON (ticker) ticker, captured_at
        FROM market_snapshots
        WHERE refresh_status = 'verified'
        ORDER BY ticker, captured_at DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE refresh_status = 'verified')::int AS verified_snapshots,
        COUNT(*) FILTER (WHERE refresh_status = 'unavailable')::int AS unavailable_snapshots,
        COUNT(*) FILTER (WHERE refresh_status = 'flagged')::int AS flagged_snapshots,
        MAX(captured_at) FILTER (WHERE refresh_status = 'verified') AS latest_verified_at,
        (
          SELECT AVG(EXTRACT(EPOCH FROM (now() - captured_at)) / 60)
          FROM latest_verified
        ) AS average_freshness_minutes,
        (
          COUNT(*) FILTER (
            WHERE refresh_status = 'verified' AND abs(daily_change) <= 15
          )::numeric
          / NULLIF(COUNT(*) FILTER (WHERE refresh_status = 'verified'), 0)
        ) * 100 AS stable_snapshot_rate
      FROM market_snapshots
    `,
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM trade_history) AS completed_trades,
        (SELECT COUNT(*)::int FROM trade_orders WHERE status = 'open') AS open_orders,
        (
          SELECT COUNT(*)::int
          FROM trade_history
          WHERE created_at >= now() - interval '7 days'
        ) AS weekly_trades
    `,
    sql`
      SELECT trading_paused, updated_at
      FROM market_system_settings
      WHERE id = true
    `,
  ]);

  const latestRefresh = recentRefreshes[0] as
    | {
        refreshed_count: number;
        verified_count: number;
        unavailable_count: number;
        flagged_count: number;
      }
    | undefined;
  const latestRefreshedCount = Number(latestRefresh?.refreshed_count ?? 0);
  const latestVerifiedCount = Number(latestRefresh?.verified_count ?? 0);
  const settings = systemSettings[0];

  return {
    sources,
    recentRefreshes,
    system: {
      tradingPaused: Boolean(settings?.trading_paused),
      updatedAt: settings?.updated_at ?? null,
      apiConfiguration: {
        youtube:
          Boolean(process.env.NITRO_YOUTUBE_API_KEY) &&
          Boolean(process.env.NITRO_YOUTUBE_CHANNELS),
        search:
          Boolean(process.env.NITRO_GOOGLE_SEARCH_API_KEY) &&
          Boolean(process.env.NITRO_GOOGLE_SEARCH_ENGINE_ID),
        marketRefreshSecret: Boolean(process.env.NITRO_MARKET_REFRESH_SECRET),
      },
    },
    metrics: {
      verifiedSnapshots: Number(snapshotCounts[0]?.verified_snapshots ?? 0),
      unavailableSnapshots: Number(
        snapshotCounts[0]?.unavailable_snapshots ?? 0,
      ),
      flaggedSnapshots: Number(snapshotCounts[0]?.flagged_snapshots ?? 0),
      latestVerifiedAt: snapshotCounts[0]?.latest_verified_at ?? null,
      averageFreshnessMinutes: Number(
        snapshotCounts[0]?.average_freshness_minutes ?? 0,
      ),
      stableSnapshotRate: Number(snapshotCounts[0]?.stable_snapshot_rate ?? 0),
      latestRefreshSuccessRate:
        latestRefreshedCount > 0
          ? Number(
              ((latestVerifiedCount / latestRefreshedCount) * 100).toFixed(1),
            )
          : null,
      completedTrades: Number(executionCounts[0]?.completed_trades ?? 0),
      weeklyTrades: Number(executionCounts[0]?.weekly_trades ?? 0),
      openOrders: Number(executionCounts[0]?.open_orders ?? 0),
    },
  };
});