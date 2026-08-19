import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";

type GoalInput = {
  type?: "first_trade" | "watchlist" | "categories";
  targetValue?: number;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<GoalInput>(event);
  const targetValue = Number(body?.targetValue);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (
    !["first_trade", "watchlist", "categories"].includes(body?.type ?? "") ||
    !Number.isInteger(targetValue) ||
    targetValue < 1 ||
    targetValue > 20
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a valid goal and target between 1 and 20.",
    });
  }

  await sql`
    INSERT INTO practice_goals (user_id, goal_type, target_value)
    VALUES (${userId}, ${body.type!}, ${targetValue})
    ON CONFLICT (user_id) DO UPDATE
    SET goal_type = EXCLUDED.goal_type, target_value = EXCLUDED.target_value, updated_at = now()
  `;

  return { ok: true };
});