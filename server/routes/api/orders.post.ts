import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { isTradeableCelebrityMarket } from "../../utils/market-eligibility";
import { isMarketTicker } from "../../utils/markets";
import { isTradingPaused } from "../../utils/trading-status";
import { isListingTradingPaused } from "../../utils/listing-settings";
import { canTradeMarket, getLockedPacksForMarket } from "../../utils/pack-access";
import { ensureStoreSchema } from "../../utils/store";

type OrderInput = {
  ticker?: string;
  side?: "buy" | "sell";
  orderType?: "limit" | "stop_market" | "stop_limit";
  amountStkz?: number;
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
};

const QUANTITY_PRECISION = 1_000_000;

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<OrderInput>(event);
  const ticker = body?.ticker?.toUpperCase();
  const amountStkz = Number(body?.amountStkz);
  const requestedQuantity =
    body?.quantity === undefined ? null : Number(body.quantity);
  const limitPrice =
    body?.limitPrice === undefined ? null : Number(body.limitPrice);
  const stopPrice =
    body?.stopPrice === undefined ? null : Number(body.stopPrice);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  await ensureStoreSchema();

  if (await isTradingPaused()) {
    throw createError({
      statusCode: 423,
      statusMessage:
        "Practice trading is temporarily paused while the market is reviewed.",
    });
  }

  if (
    !ticker ||
    !isMarketTicker(ticker) ||
    !isTradeableCelebrityMarket(ticker) ||
    (body?.side !== "buy" && body?.side !== "sell") ||
    !["limit", "stop_market", "stop_limit"].includes(
      body?.orderType ?? "",
    ) ||
    !Number.isFinite(amountStkz) ||
    amountStkz <= 0 ||
    (body.side === "sell" &&
      (requestedQuantity === null ||
        !Number.isFinite(requestedQuantity) ||
        requestedQuantity <= 0)) ||
    (body.orderType !== "stop_market" &&
      (!Number.isFinite(limitPrice) || limitPrice! <= 0)) ||
    (body.orderType !== "limit" &&
      (!Number.isFinite(stopPrice) || stopPrice! <= 0))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Enter valid active-market order details and positive trigger prices.",
    });
  }

  if (!(await canTradeMarket(userId, ticker))) {
    const packs = await getLockedPacksForMarket(userId, ticker);
    throw createError({
      statusCode: 403,
      statusMessage: `Unlock ${packs.map((pack) => pack.name).join(" or ")} to place an order for this market.`,
    });
  }

  if (await isListingTradingPaused(ticker)) {
    throw createError({
      statusCode: 423,
      statusMessage: "Trading for this listing is currently paused for review.",
    });
  }

  const quantity =
    body.side === "sell" && requestedQuantity !== null
      ? Math.floor(requestedQuantity * QUANTITY_PRECISION) / QUANTITY_PRECISION
      : null;

  if (body.side === "sell") {
    const positions = await sql<{ quantity: string }[]>`
      SELECT quantity
      FROM user_positions
      WHERE user_id = ${userId} AND ticker = ${ticker}
      LIMIT 1
    `;
    const heldQuantity = Number(positions[0]?.quantity ?? 0);
    if (!quantity || heldQuantity + 1 / QUANTITY_PRECISION < quantity) {
      throw createError({
        statusCode: 400,
        statusMessage: `You do not have enough ${ticker} shares for this sell order.`,
      });
    }
  }

  await sql`
    INSERT INTO trade_orders (
      user_id, ticker, side, order_type, amount_stkz, quantity, limit_price, stop_price
    )
    VALUES (
      ${userId}, ${ticker}, ${body.side}, ${body.orderType}, ${amountStkz},
      ${quantity}, ${limitPrice}, ${stopPrice}
    )
  `;

  return { ok: true };
});