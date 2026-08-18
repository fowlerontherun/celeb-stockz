import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { celebrityMarkets, marketPrices } from "../../utils/markets";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [walletRows, positionRows, tradeRows, followRows, inviteRows] =
    await Promise.all([
      sql`SELECT balance_stkz FROM user_wallets WHERE user_id = ${userId}`,
      sql`SELECT ticker, quantity FROM user_positions WHERE user_id = ${userId} AND quantity > 0`,
      sql`SELECT COUNT(*)::int AS count FROM trade_history WHERE user_id = ${userId} AND created_at >= now() - interval '7 days'`,
      sql`SELECT COUNT(*)::int AS count FROM market_follows WHERE user_id = ${userId}`,
      sql`SELECT COUNT(*)::int AS count FROM club_invites WHERE created_by = ${userId}`,
    ]);

  const holdingValue = positionRows.reduce(
    (total, position) =>
      total + Number(position.quantity) * (marketPrices[position.ticker] ?? 0),
    0,
  );
  const heldCategories = new Set(
    positionRows
      .map((position) =>
        celebrityMarkets.find((market) => market.ticker === position.ticker),
      )
      .filter(Boolean)
      .map((market) => market!.category),
  );

  return {
    modeledPortfolioValue: Number(
      (Number(walletRows[0]?.balance_stkz ?? 10000) + holdingValue).toFixed(2),
    ),
    weeklyTradeCount: Number(tradeRows[0]?.count ?? 0),
    heldCategoryCount: heldCategories.size,
    followCount: Number(followRows[0]?.count ?? 0),
    inviteCount: Number(inviteRows[0]?.count ?? 0),
  };
});