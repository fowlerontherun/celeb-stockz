import { sql } from "./db";

type FreshSnapshot = {
  id: string;
  ticker: string;
  price_stkz: string;
  daily_change: string;
};

const UPDATE_INTERVAL_MS = 60_000;
// Increased from 0.85% to 3.8% max per minute cycle to create real market action
const MAX_INTRACYLCE_MOVE_PERCENT = 3.8;
const DAILY_MOVE_CAP = 35;

function stableHash(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}

function getPracticeMovePercent(ticker: string, timestamp: number) {
  const updateBucket = Math.floor(timestamp / UPDATE_INTERVAL_MS);
  const normalized = (stableHash(`${ticker}:${updateBucket}`) % 10_001) / 10_000;
  // Creates dynamic swings between -3.8% and +3.8%
  return Number(
    ((normalized * 2 - 1) * MAX_INTRACYLCE_MOVE_PERCENT).toFixed(3),
  );
}

export async function applyIntracycleMovements(refreshStartedAt: string) {
  const snapshots = await sql<FreshSnapshot[]>`
    SELECT id, ticker, price_stkz, daily_change
    FROM market_snapshots
    WHERE refresh_status = 'verified'
      AND captured_at >= ${refreshStartedAt}
  `;

  await Promise.all(
    snapshots.map(async (snapshot) => {
      const movementPercent = getPracticeMovePercent(
        snapshot.ticker,
        Date.now(),
      );
      const price = Number(snapshot.price_stkz);
      const updatedPrice = Number(
        Math.max(1, price * (1 + movementPercent / 100)).toFixed(2),
      );
      const dailyChange = Number(
        Math.max(
          -DAILY_MOVE_CAP,
          Math.min(
            DAILY_MOVE_CAP,
            Number(snapshot.daily_change) + movementPercent,
          ),
        ).toFixed(3),
      );

      await sql`
        UPDATE market_snapshots
        SET
          price_stkz = ${updatedPrice},
          daily_change = ${dailyChange},
          source_measurements = source_measurements || ${JSON.stringify({
            intracycleModel: {
              movementPercent,
              intervalMinutes: 1,
              label: "High-volatility practice-market movement",
            },
          })}::jsonb
        WHERE id = ${snapshot.id}
      `;
    }),
  );

  return snapshots.length;
}