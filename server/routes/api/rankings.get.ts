import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { getLatestVerifiedPrices } from "../../utils/market-snapshots";
import { STARTING_BALANCE_STKZ } from "../../utils/store";

type RankingRow = {
  user_id: string;
  display_name: string | null;
  nickname: string | null;
  balance_stkz: string;
  ticker: string | null;
  quantity: string | null;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [rows, prices] = await Promise.all([
    sql<RankingRow[]>`
      SELECT
        wallets.user_id,
        profiles.display_name,
        profiles.nickname,
        wallets.balance_stkz,
        positions.ticker,
        positions.quantity
      FROM user_wallets AS wallets
      LEFT JOIN user_profiles AS profiles ON profiles.user_id = wallets.user_id
      LEFT JOIN user_positions AS positions
        ON positions.user_id = wallets.user_id
        AND positions.quantity > 0
    `,
    getLatestVerifiedPrices(),
  ]);

  const traders = new Map<string, { name: string; nickname: string | null; netWorth: number }>();

  for (const row of rows) {
    const defaultName = row.display_name?.trim() || `Trader ${row.user_id.slice(-4).toUpperCase()}`;
    const nick = row.nickname?.trim() || null;
    const finalName = nick || defaultName;

    const existing = traders.get(row.user_id) ?? {
      name: finalName,
      nickname: nick,
      netWorth: Number(row.balance_stkz),
    };

    if (row.ticker && row.quantity) {
      existing.netWorth += Number(row.quantity) * (prices.get(row.ticker) ?? 0);
    }

    traders.set(row.user_id, existing);
  }

  return Array.from(traders.entries())
    .map(([traderId, trader]) => ({
      traderId,
      name: trader.name,
      nickname: trader.nickname,
      netWorth: Number(trader.netWorth.toFixed(2)),
      profitLoss: Number((trader.netWorth - STARTING_BALANCE_STKZ).toFixed(2)),
      isCurrentUser: traderId === userId,
    }))
    .sort((first, second) => second.netWorth - first.netWorth)
    .map((trader, index) => ({ ...trader, rank: index + 1 }));
});
