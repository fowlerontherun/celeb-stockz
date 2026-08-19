import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { isTradeableCelebrityMarket } from "../../utils/market-eligibility";
import { isMarketTicker } from "../../utils/markets";
import { getLatestVerifiedPrices } from "../../utils/market-snapshots";
import { isTradingPaused } from "../../utils/trading-status";

type TradeRequest = {
  ticker?: string;
  side?: "buy" | "sell";
  amountStkz?: number;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
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

  const body = await readBody<TradeRequest>(event);
  const ticker = body?.ticker?.toUpperCase();
  const side = body?.side;
  const amountStkz = Number(body?.amountStkz);

  if (
    !ticker ||
    !isMarketTicker(ticker) ||
    !isTradeableCelebrityMarket(ticker) ||
    (side !== "buy" && side !== "sell") ||
    !Number.isFinite(amountStkz) ||
    amountStkz <= 0
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose an active market, valid trade side, and STKZ amount.",
    });
  }

  const price = (await getLatestVerifiedPrices()).get(ticker);

  if (!price) {
    throw createError({
      statusCode: 409,
      statusMessage:
        "This market has no verified snapshot yet. Please try again after the next refresh.",
    });
  }

  const quantity = Number((amountStkz / price).toFixed(6));
  const total = Number((quantity * price).toFixed(2));

  if (quantity <= 0 || total <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Trade amount is too small for this market.",
    });
  }

  const result =
    side === "buy"
      ? await sql`
          WITH updated_wallet AS (
            UPDATE user_wallets
            SET balance_stkz = balance_stkz - ${total}, updated_at = now()
            WHERE user_id = ${userId} AND balance_stkz >= ${total}
            RETURNING balance_stkz
          ),
          updated_position AS (
            INSERT INTO user_positions (user_id, ticker, quantity, average_cost)
            SELECT ${userId}, ${ticker}, ${quantity}, ${price}
            FROM updated_wallet
            ON CONFLICT (user_id, ticker) DO UPDATE
            SET
              quantity = user_positions.quantity + EXCLUDED.quantity,
              average_cost = (
                (user_positions.quantity * user_positions.average_cost) +
                (EXCLUDED.quantity * EXCLUDED.average_cost)
              ) / (user_positions.quantity + EXCLUDED.quantity),
              updated_at = now()
            RETURNING quantity
          ),
          recorded_trade AS (
            INSERT INTO trade_history (user_id, ticker, side, quantity, price_stkz, total_stkz)
            SELECT ${userId}, ${ticker}, 'buy', ${quantity}, ${price}, ${total}
            FROM updated_position
            RETURNING id
          )
          SELECT updated_wallet.balance_stkz, updated_position.quantity
          FROM updated_wallet CROSS JOIN updated_position
        `
      : await sql`
          WITH updated_position AS (
            UPDATE user_positions
            SET quantity = quantity - ${quantity}, updated_at = now()
            WHERE user_id = ${userId} AND ticker = ${ticker} AND quantity >= ${quantity}
            RETURNING quantity
          ),
          updated_wallet AS (
            UPDATE user_wallets
            SET balance_stkz = balance_stkz + ${total}, updated_at = now()
            WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM updated_position)
            RETURNING balance_stkz
          ),
          recorded_trade AS (
            INSERT INTO trade_history (user_id, ticker, side, quantity, price_stkz, total_stkz)
            SELECT ${userId}, ${ticker}, 'sell', ${quantity}, ${price}, ${total}
            FROM updated_wallet
            RETURNING id
          )
          SELECT updated_wallet.balance_stkz, updated_position.quantity
          FROM updated_wallet CROSS JOIN updated_position
        `;

  if (!result[0]) {
    throw createError({
      statusCode: 400,
      statusMessage:
        side === "buy"
          ? "You do not have enough STKZ for this purchase."
          : `You do not have enough ${ticker} shares to sell.`,
    });
  }

  return {
    ticker,
    side,
    priceStkz: price,
    quantity,
    totalStkz: total,
    balanceStkz: Number(result[0].balance_stkz),
    positionQuantity: Number(result[0].quantity),
  };
});