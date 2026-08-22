import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { STARTING_BALANCE_STKZ, ensureStoreSchema } from "../../utils/store";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await ensureStoreSchema();

  const result = await sql`
    WITH removed_orders AS (
      DELETE FROM trade_orders WHERE user_id = ${userId}
    ),
    removed_history AS (
      DELETE FROM trade_history WHERE user_id = ${userId}
    ),
    removed_positions AS (
      DELETE FROM user_positions WHERE user_id = ${userId}
    ),
    restored_wallet AS (
      INSERT INTO user_wallets (user_id, balance_stkz, purchased_stkz_balance)
      VALUES (${userId}, ${STARTING_BALANCE_STKZ}, 0)
      ON CONFLICT (user_id) DO UPDATE
      SET
        balance_stkz = ${STARTING_BALANCE_STKZ} + user_wallets.purchased_stkz_balance,
        updated_at = now()
      RETURNING balance_stkz, purchased_stkz_balance
    )
    SELECT balance_stkz, purchased_stkz_balance FROM restored_wallet
  `;

  return {
    balanceStkz: Number(result[0].balance_stkz),
    preservedPurchasedStkz: Number(result[0].purchased_stkz_balance),
  };
});
