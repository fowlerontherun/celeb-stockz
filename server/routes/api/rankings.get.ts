import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { marketPrices } from "../../utils/markets";

type RankingRow = {
  user_id: string;
  display_name: string | null;
  balance_stkz: string;
  ticker: string | null;
  quantity: string | null;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const rows = await sql<RankingRow[]>`
    SELECT
      wallets.user_id,
      profiles.display_name,
      wallets.balance_stkz,
      positions.ticker,
      positions.quantity
    FROM user_wallets AS wallets
    LEFT JOIN user_profiles AS profiles ON profiles.user_id = wallets.user_id
    LEFT JOIN user_positions AS positions
      ON positions.user_id = wallets.user_id
      AND positions.quantity > 0
  `;

  const traders = new Map<
    string,
    { name: string; netWorth: number }
  >();

  for (const row of rows) {
    const existing = traders.get(row.user_id) ?? {
      name:
        row.display_name?.trim() ||
        `Trader ${row.user_id.slice(-4).toUpperCase()}`,
      netWorth: Number(row.balance_stkz),
    };

    if (row.ticker && row.quantity) {
      existing.netWorth += Number(row.quantity) * (marketPrices[row.ticker] ?? 0);
    }

    traders.set(row.user_id, existing);
  }

  return Array.from(traders.entries())
    .map(([traderId, trader]) => ({
      traderId,
      name: trader.name,
      netWorth: Number(trader.netWorth.toFixed(2)),
      profitLoss: Number((trader.netWorth - 10000).toFixed(2)),
      isCurrentUser: traderId === userId,
    }))
    .sort((first, second) => second.netWorth - first.netWorth)
    .map((trader, index) => ({ ...trader, rank: index + 1 }));
});