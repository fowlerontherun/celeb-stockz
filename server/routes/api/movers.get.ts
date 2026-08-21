import { defineHandler } from "nitro";
import { sql } from "../../utils/db";
import { getSnapshotMarkets } from "../../utils/market-snapshots";

type SnapshotPair = {
  ticker: string;
  latest_price: string;
  baseline_price: string | null;
};

export default defineHandler(async () => {
  const [markets, snapshots, publishedPackMembers] = await Promise.all([
    getSnapshotMarkets(),
    sql<SnapshotPair[]>`
      WITH ranked_snapshots AS (
        SELECT
          ticker,
          price_stkz,
          captured_at,
          row_number() OVER (
            PARTITION BY ticker
            ORDER BY captured_at DESC
          ) AS newest_rank,
          row_number() OVER (
            PARTITION BY ticker
            ORDER BY
              CASE
                WHEN captured_at <= now() - interval '24 hours' THEN captured_at
              END DESC NULLS LAST
          ) AS day_baseline_rank
        FROM market_snapshots
        WHERE refresh_status = 'verified'
      )
      SELECT
        ticker,
        MAX(price_stkz) FILTER (WHERE newest_rank = 1) AS latest_price,
        MAX(price_stkz) FILTER (WHERE day_baseline_rank = 1) AS baseline_price
      FROM ranked_snapshots
      GROUP BY ticker
    `,
    sql<{ ticker: string }[]>`
      SELECT DISTINCT members.ticker
      FROM celebrity_pack_members AS members
      JOIN celebrity_packs AS packs
        ON packs.id = members.pack_id
      WHERE packs.is_published = true
    `,
  ]);

  const visibleTickers = new Set(
    publishedPackMembers.map((member) => member.ticker),
  );
  const pricesByTicker = new Map(
    snapshots.map((snapshot) => [snapshot.ticker, snapshot]),
  );

  return {
    movers: markets
      .filter((market) => visibleTickers.has(market.ticker))
      .map((market) => {
        const snapshot = pricesByTicker.get(market.ticker);
        const latestPrice = Number(snapshot?.latest_price ?? market.price);
        const baselinePrice = snapshot?.baseline_price
          ? Number(snapshot.baseline_price)
          : null;
        const change =
          baselinePrice && baselinePrice > 0
            ? Number(
                (((latestPrice - baselinePrice) / baselinePrice) * 100).toFixed(
                  2,
                ),
              )
            : null;

        return {
          ...market,
          price: latestPrice,
          change,
          hasDayComparison: change !== null,
        };
      }),
  };
});