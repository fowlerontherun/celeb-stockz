import { defineHandler } from "nitro";
import { getSnapshotMarkets } from "../../utils/market-snapshots";
import { sql } from "../../utils/db";

export default defineHandler(async () => {
  const [markets, healthRows] = await Promise.all([
    getSnapshotMarkets(),
    sql`
      SELECT source_key, status, last_checked_at, last_success_at, detail
      FROM market_source_health
      ORDER BY source_key
    `,
  ]);

  const latestRefresh = markets
    .map((market) => market.snapshot.capturedAt)
    .filter((capturedAt): capturedAt is string => Boolean(capturedAt))
    .sort()
    .at(-1) ?? null;

  return {
    updatedAt: latestRefresh,
    pricingMethod:
      "STKZ is a transparent practice-market score built from permitted public signals and stable modeled baselines. It is not an investment valuation.",
    markets,
    sourceHealth: healthRows.map((row) => ({
      source: row.source_key,
      status: row.status,
      lastCheckedAt: row.last_checked_at,
      lastSuccessAt: row.last_success_at,
      detail: row.detail,
    })),
  };
});