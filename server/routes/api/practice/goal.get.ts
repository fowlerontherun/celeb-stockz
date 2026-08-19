import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../../utils/db";
import { celebrityMarkets } from "../../../utils/markets";

type GoalRow = {
  goal_type: "first_trade" | "watchlist" | "categories";
  target_value: number;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [goalRows, tradeRows, followRows, positionRows] = await Promise.all([
    sql<GoalRow[]>`
      SELECT goal_type, target_value
      FROM practice_goals
      WHERE user_id = ${userId}
    `,
    sql`SELECT COUNT(*)::int AS count FROM trade_history WHERE user_id = ${userId}`,
    sql`SELECT COUNT(*)::int AS count FROM market_follows WHERE user_id = ${userId}`,
    sql`SELECT ticker FROM user_positions WHERE user_id = ${userId} AND quantity > 0`,
  ]);

  const goal = goalRows[0] ?? { goal_type: "first_trade", target_value: 1 };
  const heldCategories = new Set(
    positionRows
      .map((position) =>
        celebrityMarkets.find((market) => market.ticker === position.ticker),
      )
      .filter(Boolean)
      .map((market) => market!.category),
  ).size;

  const progressByType = {
    first_trade: Number(tradeRows[0]?.count ?? 0),
    watchlist: Number(followRows[0]?.count ?? 0),
    categories: heldCategories,
  };

  return {
    goal: {
      type: goal.goal_type,
      targetValue: Number(goal.target_value),
      progress: progressByType[goal.goal_type],
    },
  };
});