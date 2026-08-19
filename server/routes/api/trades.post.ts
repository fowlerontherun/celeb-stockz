import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { isTradeableCelebrityMarket } from "../../utils/market-eligibility";
import { isMarketTicker, marketPrices } from "../../utils/markets";
import { getLatestVerifiedPrices } from "../../utils/market-snapshots";
import { isTradingPaused } from "../../utils/trading-status";
import { isListingTradingPaused } from "../../utils/listing-settings";
import { canTradeMarket, getLockedPacksForMarket } from "../../utils/pack-access";

type TradeRequest = {
  ticker?: string;
  side?: "buy" | "sell";
  amountStkz?: number;
};

const TRANSACTION_FEE_RATE = 0.01;

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
  const ticker = body?.ticker?.trim().toUpperCase();
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

  if (!(await canTradeMarket(userId, ticker))) {
    const packs = await getLockedPacksForMarket(userId, ticker);
    throw createError({
      statusCode: 403,
      statusMessage: `Unlock ${packs.map((pack) => pack.name).join(" or ")} to trade this market.`,
    });
  }

  if (await isListingTradingPaused(ticker)) {
    throw createError({
      statusCode: 423,
      statusMessage: "Trading for this listing is currently paused for review.",
    });
  }

  const latestVerifiedPrice = (await getLatestVerifiedPrices()).get(ticker);
  const price = latestVerifiedPrice ?? marketPrices[ticker];

  if (!price || !Number.isFinite(price) || price <= 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "This market price is temporarily unavailable.",
    });
  }

  const quantity = Number((amountStkz / price).toFixed(6));
  const total = Number((quantity * price).toFixed(2));
  const feeStkz = Number((total * TRANSACTION_FEE_RATE).toFixed(2));
  const walletAmount = side === "buy" ? total + feeStkz : total - feeStkz;

  if (quantity <= 0 || total <= 0 || walletAmount <= 0) {
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
            SET balance_stkz = balance_stkz - ${walletAmount}, updated_at = now()
            WHERE user_id = ${userId} AND balance_stkz >= ${walletAmount}
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
            SET balance_stkz = balance_stkz + ${walletAmount}, updated_at = now()
            WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM updated_position)
            RETURNING balance_stkz
          ),
          recorded_trade AS (
            INSERT INTO trade_history (user_id, ticker, side, quantity, price_stkz, total_stkz)
            SELECT ${userId}, ${ticker}, 'sell', ${quantity}, ${price}, ${total}
            FROM updated_wallet
          )
          SELECT updated_wallet.balance_stkz, updated_position.quantity
          FROM updated_wallet CROSS JOIN updated_position
        `;

  if (!result[0]) {
    throw createError({
      statusCode: 400,
      statusMessage:
        side === "buy"
          ? "You do not have enough STKZ for this purchase and its 1% fee."
          : `You do not have enough ${ticker} shares to sell.`,
    });
  }

  return {
    ticker,
    side,
    priceStkz: price,
    quantity,
    totalStkz: total,
    feeStkz,
    balanceStkz: Number(result[0].balance_stkz),
    positionQuantity: Number(result[0].quantity),
  };
});