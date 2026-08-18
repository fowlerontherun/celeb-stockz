import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";

const adminEmails = new Set(
  (process.env.NITRO_MARKET_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
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

  const [sources, recentRefreshes, snapshotCounts, executionCounts] =
    await Promise.all([
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
        SELECT
          COUNT(*) FILTER (WHERE refresh_status = 'verified')::int AS verified_snapshots,
          COUNT(*) FILTER (WHERE refresh_status = 'unavailable')::int AS unavailable_snapshots,
          COUNT(*) FILTER (WHERE refresh_status = 'flagged')::int AS flagged_snapshots,
          MAX(captured_at) FILTER (WHERE refresh_status = 'verified') AS latest_verified_at
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

  return {
    sources,
    recentRefreshes,
    metrics: {
      verifiedSnapshots: Number(snapshotCounts[0]?.verified_snapshots ?? 0),
      unavailableSnapshots: Number(
        snapshotCounts[0]?.unavailable_snapshots ?? 0,
      ),
      flaggedSnapshots: Number(snapshotCounts[0]?.flagged_snapshots ?? 0),
      latestVerifiedAt: snapshotCounts[0]?.latest_verified_at ?? null,
      latestRefreshSuccessRate:
        latestRefreshedCount > 0
          ? Number(((latestVerifiedCount / latestRefreshedCount) * 100).toFixed(1))
          : null,
      completedTrades: Number(executionCounts[0]?.completed_trades ?? 0),
      weeklyTrades: Number(executionCounts[0]?.weekly_trades ?? 0),
      openOrders: Number(executionCounts[0]?.open_orders ?? 0),
    },
  };
});