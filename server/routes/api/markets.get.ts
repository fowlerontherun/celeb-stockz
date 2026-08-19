import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { syncMarketRegistry } from "../../utils/market-registry";
import { getSnapshotMarkets } from "../../utils/market-snapshots";

const STALE_AFTER_MS = 8 * 60 * 60 * 1000;

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [markets, healthRows, memberships] = await Promise.all([
    getSnapshotMarkets(),
    sql`
      SELECT source_key, status, last_checked_at, last_success_at, detail
      FROM market_source_health
      ORDER BY source_key
    `,
    sql<{ ticker: string; pack_id: number; name: string; unlocked: boolean }[]>`
      SELECT
        members.ticker,
        members.pack_id,
        CASE
          WHEN (packs.is_announced OR packs.is_published OR unlocks.pack_id IS NOT NULL) THEN packs.name
          ELSE 'Classified Pack #' || packs.id
        END AS name,
        (unlocks.pack_id IS NOT NULL) AS unlocked
      FROM celebrity_pack_members AS members
      JOIN celebrity_packs AS packs ON packs.id = members.pack_id
      LEFT JOIN user_pack_unlocks AS unlocks
        ON unlocks.pack_id = members.pack_id AND unlocks.user_id = ${userId}
    `,
    syncMarketRegistry(),
  ]);

  const membershipsByTicker = new Map<
    string,
    Array<{ id: number; name: string; unlocked: boolean }>
  >();
  memberships.forEach((membership) => {
    const current = membershipsByTicker.get(membership.ticker) ?? [];
    current.push({
      id: Number(membership.pack_id),
      name: membership.name,
      unlocked: membership.unlocked,
    });
    membershipsByTicker.set(membership.ticker, current);
  });

  const latestRefresh =
    markets
      .map((market) => market.snapshot.capturedAt)
      .filter((capturedAt): capturedAt is string => Boolean(capturedAt))
      .sort()
      .at(-1) ?? null;

  return {
    updatedAt: latestRefresh,
    pricingMethod:
      "STKZ is a transparent practice-market score built from permitted public signals and stable modeled baselines. It is not an investment valuation.",
    markets: markets.map((market) => {
      const capturedAt = market.snapshot.capturedAt;
      const isStale =
        !capturedAt ||
        Date.now() - new Date(capturedAt).getTime() > STALE_AFTER_MS;
      const packs = membershipsByTicker.get(market.ticker) ?? [];
      const lockedPacks = packs.filter((pack) => !pack.unlocked);

      return {
        ...market,
        access: {
          isStandard: packs.length === 0,
          isUnlocked: lockedPacks.length === 0,
          requiredPacks: lockedPacks.map(({ id, name }) => ({ id, name })),
        },
        snapshot: {
          ...market.snapshot,
          freshness: isStale
            ? "stale"
            : market.snapshot.refreshStatus === "verified"
              ? "verified"
              : "estimated",
        },
      };
    }),
    sourceHealth: healthRows.map((row) => ({
      source: row.source_key,
      status: row.status,
      lastCheckedAt: row.last_checked_at,
      lastSuccessAt: row.last_success_at,
      detail: row.detail,
    })),
  };
});