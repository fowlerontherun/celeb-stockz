import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { sql } from "../../../utils/db";

type ReviewInput = {
  ticker?: string;
  reviewType?: "eligibility-review" | "source-correction" | "anomaly-review";
  detail?: string;
  sourceUrl?: string;
};

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

  const body = await readBody<ReviewInput>(event);
  const ticker = body?.ticker?.trim().toUpperCase() ?? "";
  const detail = body?.detail?.trim() ?? "";

  if (
    !ticker ||
    !detail ||
    detail.length > 1000 ||
    !["eligibility-review", "source-correction", "anomaly-review"].includes(
      body?.reviewType ?? "",
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Enter a valid ticker, review type, and concise note.",
    });
  }

  const market = await sql`
    SELECT ticker FROM celebrity_markets WHERE ticker = ${ticker}
  `;

  if (!market[0]) {
    throw createError({ statusCode: 404, statusMessage: "Market not found." });
  }

  await sql`
    INSERT INTO market_events (ticker, event_type, severity, detail, source_url)
    VALUES (
      ${ticker},
      ${body.reviewType!},
      'reviewed',
      ${`${detail} Reviewed by ${session.user.email}.`},
      ${body.sourceUrl?.trim() || null}
    )
  `;

  return { ok: true };
});