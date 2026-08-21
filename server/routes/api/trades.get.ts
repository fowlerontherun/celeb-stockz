import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const trades = await sql`
    SELECT id, ticker, side, quantity, price_stkz, total_stkz, created_at
    FROM trade_history
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return {
    trades: trades.map((trade) => ({
      id: Number(trade.id),
      ticker: trade.ticker,
      side: trade.side,
      quantity: Number(trade.quantity),
      priceStkz: Number(trade.price_stkz),
      totalStkz: Number(trade.total_stkz),
      createdAt: trade.created_at,
    })),
  };
});