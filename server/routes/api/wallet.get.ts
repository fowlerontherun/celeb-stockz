import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import {
  INITIAL_DEPOSIT_GBP,
  ensureStoreSchema,
} from "../../utils/store";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await ensureStoreSchema();
  const walletRows = await sql`
    INSERT INTO user_wallets (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING balance_stkz, purchased_stkz_balance
  `;

  await sql`
    INSERT INTO payment_orders (
      user_id,
      provider,
      provider_session_id,
      sku,
      amount_minor,
      currency,
      status,
      fulfilled_at
    )
    VALUES (
      ${userId},
      'simulation',
      ${`initial-deposit:${userId}`},
      'INITIAL_DEPOSIT',
      ${INITIAL_DEPOSIT_GBP * 100},
      'gbp',
      'paid',
      now()
    )
    ON CONFLICT (provider_session_id) DO NOTHING
  `;

  const positions = await sql`
    SELECT ticker, quantity, average_cost
    FROM user_positions
    WHERE user_id = ${userId} AND quantity > 0
    ORDER BY updated_at DESC
  `;

  return {
    balanceStkz: Number(walletRows[0].balance_stkz),
    purchasedStkzBalance: Number(walletRows[0].purchased_stkz_balance ?? 0),
    positions: positions.map((position) => ({
      ticker: position.ticker,
      quantity: Number(position.quantity),
      averageCost: Number(position.average_cost),
    })),
  };
});
