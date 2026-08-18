import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const follows = await sql`
    SELECT ticker, alerts_enabled
    FROM market_follows
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return {
    follows: follows.map((follow) => ({
      ticker: follow.ticker,
      alertsEnabled: follow.alerts_enabled,
    })),
  };
});