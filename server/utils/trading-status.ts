import { sql } from "./db";

export async function isTradingPaused() {
  const settings = await sql`
    SELECT trading_paused
    FROM market_system_settings
    WHERE id = true
  `;

  return Boolean(settings[0]?.trading_paused);
}