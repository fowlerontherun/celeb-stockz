import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const result = await sql`
    WITH removed_history AS (
      DELETE FROM trade_history WHERE user_id = ${userId}
    ),
    removed_positions AS (
      DELETE FROM user_positions WHERE user_id = ${userId}
    ),
    restored_wallet AS (
      INSERT INTO user_wallets (user_id, balance_stkz)
      VALUES (${userId}, 10000)
      ON CONFLICT (user_id) DO UPDATE
      SET balance_stkz = 10000, updated_at = now()
      RETURNING balance_stkz
    )
    SELECT balance_stkz FROM restored_wallet
  `;

  return { balanceStkz: Number(result[0].balance_stkz) };
});