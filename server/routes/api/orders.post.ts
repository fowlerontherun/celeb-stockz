import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { isTradeableCelebrityMarket } from "../../utils/market-eligibility";
import { isMarketTicker } from "../../utils/markets";
import { isTradingPaused } from "../../utils/trading-status";
import { isListingTradingPaused } from "../../utils/listing-settings";

type OrderInput = {
  ticker?: string;
  side?: "buy" | "sell";
  orderType?: "limit" | "stop_market" | "stop_limit";
  amountStkz?: number;
  limitPrice?: number;
  stopPrice?: number;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<OrderInput>(event);
  const ticker = body?.ticker?.toUpperCase();
  const amountStkz = Number(body?.amountStkz);
  const limitPrice =
    body?.limitPrice === undefined ? null : Number(body.limitPrice);
  const stopPrice =
    body?.stopPrice === undefined ? null : Number(body.stopPrice);

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

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

  if (await isListingTradingPaused(ticker)) {
    throw createError({
      statusCode: 423,
      statusMessage: "Trading for this listing is currently paused for review.",
    });
  }

  await sql`
    INSERT INTO trade_orders (
      user_id, ticker, side, order_type, amount_stkz, limit_price, stop_price
    )
    VALUES (
      ${userId}, ${ticker}, ${body.side}, ${body.orderType}, ${amountStkz},
      ${limitPrice}, ${stopPrice}
    )
  `;

  return { ok: true };
});