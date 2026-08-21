import { sql } from "./db";
import { isTradeableCelebrityMarket } from "./market-eligibility";
import { getLivePriceMap } from "./live-prices";

type OpenOrder = {
  id: number;
  user_id: string;
  ticker: string;
  side: "buy" | "sell";
  order_type: "limit" | "stop_market" | "stop_limit";
  amount_stkz: string;
  limit_price: string | null;
  stop_price: string | null;
  triggered_at: string | null;
};

const TRANSACTION_FEE_RATE = 0.01;
const FRESH_PRICE_MS = 10 * 60 * 1000;

async function fillOrder(order: OpenOrder, price: number) {
  const amount = Number(order.amount_stkz);
  const quantity = Number((amount / price).toFixed(6));
  const total = Number((quantity * price).toFixed(2));
  const feeStkz = Number((total * TRANSACTION_FEE_RATE).toFixed(2));
  const walletAmount =
    order.side === "buy" ? total + feeStkz : total - feeStkz;

  const result =
    order.side === "buy"
      ? await sql`
          WITH wallet AS (
            UPDATE user_wallets
            SET balance_stkz = balance_stkz - ${walletAmount}, updated_at = now()
            WHERE user_id = ${order.user_id} AND balance_stkz >= ${walletAmount}
            RETURNING balance_stkz
          ),
          position AS (
            INSERT INTO user_positions (user_id, ticker, quantity, average_cost)
            SELECT ${order.user_id}, ${order.ticker}, ${quantity}, ${price} FROM wallet
            ON CONFLICT (user_id, ticker) DO UPDATE
            SET quantity = user_positions.quantity + EXCLUDED.quantity,
                average_cost = (
                  (user_positions.quantity * user_positions.average_cost) +
                  (EXCLUDED.quantity * EXCLUDED.average_cost)
                ) / (user_positions.quantity + EXCLUDED.quantity),
                updated_at = now()
            RETURNING quantity
          ),
          history AS (
            INSERT INTO trade_history (user_id, ticker, side, quantity, price_stkz, total_stkz)
            SELECT ${order.user_id}, ${order.ticker}, 'buy', ${quantity}, ${price}, ${total}
            FROM position
          )
          UPDATE trade_orders
          SET status = 'filled', filled_at = now(), updated_at = now()
          WHERE id = ${order.id} AND EXISTS (SELECT 1 FROM position)
          RETURNING id
        `
      : await sql`
          WITH position AS (
            UPDATE user_positions
            SET quantity = quantity - ${quantity}, updated_at = now()
            WHERE user_id = ${order.user_id}
              AND ticker = ${order.ticker}
              AND quantity >= ${quantity}
            RETURNING quantity
          ),
          wallet AS (
            UPDATE user_wallets
            SET balance_stkz = balance_stkz + ${walletAmount}, updated_at = now()
            WHERE user_id = ${order.user_id} AND EXISTS (SELECT 1 FROM position)
            RETURNING balance_stkz
          ),
          history AS (
            INSERT INTO trade_history (user_id, ticker, side, quantity, price_stkz, total_stkz)
            SELECT ${order.user_id}, ${order.ticker}, 'sell', ${quantity}, ${price}, ${total}
            FROM wallet
          )
          UPDATE trade_orders
          SET status = 'filled', filled_at = now(), updated_at = now()
          WHERE id = ${order.id} AND EXISTS (SELECT 1 FROM wallet)
          RETURNING id
        `;

  return Boolean(result[0]);
}

export async function processOpenOrders() {
  const [orders, livePrices, snapshots] = await Promise.all([
    sql<OpenOrder[]>`
      SELECT id, user_id, ticker, side, order_type, amount_stkz, limit_price, stop_price, triggered_at
      FROM trade_orders
      WHERE status = 'open'
      ORDER BY created_at ASC
    `,
    getLivePriceMap(),
    sql<{ ticker: string; price_stkz: string; captured_at: string }[]>`
      SELECT DISTINCT ON (ticker) ticker, price_stkz, captured_at
      FROM market_snapshots
      WHERE refresh_status = 'verified'
        AND captured_at >= now() - interval '10 minutes'
      ORDER BY ticker, captured_at DESC
    `,
  ]);

  const now = Date.now();
  const freshPrices = new Map<string, number>();
  for (const [ticker, live] of livePrices) {
    const updatedAt = new Date(live.updatedAt).getTime();
    if (
      Number.isFinite(updatedAt) &&
      now - updatedAt <= FRESH_PRICE_MS &&
      Number.isFinite(live.price) &&
      live.price > 0
    ) {
      freshPrices.set(ticker, live.price);
    }
  }

  for (const snapshot of snapshots) {
    if (!freshPrices.has(snapshot.ticker)) {
      freshPrices.set(snapshot.ticker, Number(snapshot.price_stkz));
    }
  }

  for (const order of orders) {
    if (!isTradeableCelebrityMarket(order.ticker)) continue;

    const price = freshPrices.get(order.ticker);
    if (!price) continue;

    const limitPrice = Number(order.limit_price);
    const stopPrice = Number(order.stop_price);
    const limitReached =
      order.side === "buy" ? price <= limitPrice : price >= limitPrice;
    const stopReached =
      order.side === "buy" ? price >= stopPrice : price <= stopPrice;

    if (order.order_type === "limit" && limitReached) {
      await fillOrder(order, price);
    }

    if (order.order_type === "stop_market" && stopReached) {
      await fillOrder(order, price);
    }

    if (order.order_type === "stop_limit") {
      if (!order.triggered_at && stopReached) {
        await sql`
          UPDATE trade_orders
          SET triggered_at = now(), updated_at = now()
          WHERE id = ${order.id} AND status = 'open'
        `;
        order.triggered_at = new Date().toISOString();
      }

      if (order.triggered_at && limitReached) {
        await fillOrder(order, price);
      }
    }
  }
}
