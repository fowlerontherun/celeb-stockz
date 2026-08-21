import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const orderId = Number(getRouterParam(event, "id"));

  if (!userId || !Number.isInteger(orderId)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid order." });
  }

  const cancelled = await sql`
    UPDATE trade_orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = ${orderId} AND user_id = ${userId} AND status = 'open'
    RETURNING id
  `;

  if (!cancelled[0]) {
    throw createError({ statusCode: 404, statusMessage: "This order is no longer open." });
  }

  return { ok: true };
});