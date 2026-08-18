import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { isMarketTicker } from "../../utils/markets";

type FollowInput = {
  ticker?: string;
  following?: boolean;
  alertsEnabled?: boolean;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<FollowInput>(event);
  const ticker = body?.ticker?.trim().toUpperCase();

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (!ticker || !isMarketTicker(ticker) || typeof body?.following !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a valid market to follow.",
    });
  }

  if (!body.following) {
    await sql`
      DELETE FROM market_follows
      WHERE user_id = ${userId} AND ticker = ${ticker}
    `;
    return { ticker, following: false };
  }

  const alertsEnabled = body.alertsEnabled ?? true;
  await sql`
    INSERT INTO market_follows (user_id, ticker, alerts_enabled)
    VALUES (${userId}, ${ticker}, ${alertsEnabled})
    ON CONFLICT (user_id, ticker) DO UPDATE
    SET alerts_enabled = EXCLUDED.alerts_enabled
  `;

  return { ticker, following: true, alertsEnabled };
});