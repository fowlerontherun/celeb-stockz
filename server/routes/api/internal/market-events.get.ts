import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { sql } from "../../../utils/db";

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

  const events = await sql`
    SELECT id, ticker, event_type, severity, detail, source_url, created_at
    FROM market_events
    ORDER BY created_at DESC
    LIMIT 100
  `;

  return {
    events: events.map((item) => ({
      id: Number(item.id),
      ticker: item.ticker,
      type: item.event_type,
      severity: item.severity,
      detail: item.detail,
      sourceUrl: item.source_url,
      createdAt: item.created_at,
    })),
  };
});