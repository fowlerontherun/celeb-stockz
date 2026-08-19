import { sql } from "./db";

export async function isListingTradingPaused(ticker: string) {
  const rows = await sql`
    SELECT trading_paused
    FROM market_listing_settings
    WHERE ticker = ${ticker}
  `;

  return Boolean(rows[0]?.trading_paused);
}