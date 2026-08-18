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
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const [sources, recentRefreshes, counts] = await Promise.all([
    sql`
      SELECT source_key, status, last_checked_at, last_success_at, detail
      FROM market_source_health
      ORDER BY source_key
    `,
    sql`
      SELECT started_at, completed_at, status, refreshed_count, verified_count, unavailable_count, flagged_count, detail
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
  ]);

  return {
    sources,
    recentRefreshes,
    metrics: {
      verifiedSnapshots: Number(counts[0]?.verified_snapshots ?? 0),
      unavailableSnapshots: Number(counts[0]?.unavailable_snapshots ?? 0),
      flaggedSnapshots: Number(counts[0]?.flagged_snapshots ?? 0),
      latestVerifiedAt: counts[0]?.latest_verified_at ?? null,
    },
  };
});