import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const preferences = await sql`
    SELECT market_alerts, weekly_recap, education_tips, onboarding_dismissed
    FROM notification_preferences
    WHERE user_id = ${userId}
  `;

  return preferences[0] ?? {
    market_alerts: true,
    weekly_recap: true,
    education_tips: true,
    onboarding_dismissed: false,
  };
});