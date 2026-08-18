import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const walletRows = await sql`
    INSERT INTO user_wallets (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING balance_stkz
  `;

  const positions = await sql`
    SELECT ticker, quantity, average_cost
    FROM user_positions
    WHERE user_id = ${userId} AND quantity > 0
    ORDER BY updated_at DESC
  `;

  return {
    balanceStkz: Number(walletRows[0].balance_stkz),
    positions: positions.map((position) => ({
      ticker: position.ticker,
      quantity: Number(position.quantity),
      averageCost: Number(position.average_cost),
    })),
  };
});