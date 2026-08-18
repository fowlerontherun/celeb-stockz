import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

type PreferenceInput = {
  marketAlerts?: boolean;
  weeklyRecap?: boolean;
  educationTips?: boolean;
  onboardingDismissed?: boolean;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<PreferenceInput>(event);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const values = [
    body?.marketAlerts,
    body?.weeklyRecap,
    body?.educationTips,
    body?.onboardingDismissed,
  ];

  if (values.some((value) => typeof value !== "boolean")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose valid notification preferences.",
    });
  }

  const preferences = await sql`
    INSERT INTO notification_preferences (
      user_id, market_alerts, weekly_recap, education_tips, onboarding_dismissed
    )
    VALUES (
      ${userId},
      ${body.marketAlerts!},
      ${body.weeklyRecap!},
      ${body.educationTips!},
      ${body.onboardingDismissed!}
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      market_alerts = EXCLUDED.market_alerts,
      weekly_recap = EXCLUDED.weekly_recap,
      education_tips = EXCLUDED.education_tips,
      onboarding_dismissed = EXCLUDED.onboarding_dismissed,
      updated_at = now()
    RETURNING market_alerts, weekly_recap, education_tips, onboarding_dismissed
  `;

  return preferences[0];
});