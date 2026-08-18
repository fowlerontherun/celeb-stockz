import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const orders = await sql`
    SELECT id, ticker, side, order_type, amount_stkz, limit_price, stop_price, triggered_at, created_at
    FROM trade_orders
    WHERE user_id = ${userId} AND status = 'open'
    ORDER BY created_at DESC
  `;

  return orders.map((order) => ({
    id: Number(order.id),
    ticker: order.ticker,
    side: order.side,
    orderType: order.order_type,
    amountStkz: Number(order.amount_stkz),
    limitPrice: order.limit_price === null ? null : Number(order.limit_price),
    stopPrice: order.stop_price === null ? null : Number(order.stop_price),
    triggeredAt: order.triggered_at,
    createdAt: order.created_at,
  }));
});