import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { syncMarketRegistry } from "../../utils/market-registry";
import { getSnapshotMarkets } from "../../utils/market-snapshots";
import { getLivePriceMap } from "../../utils/live-prices";

const STALE_AFTER_MS = 8 * 60 * 60 * 1000;

type Membership = {
  ticker: string;
  pack_id: number;
  name: string;
  is_standard: boolean;
  unlocked: boolean;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [allMarkets, healthRows, memberships, livePrices] = await Promise.all([
    getSnapshotMarkets(),
    sql`
      SELECT source_key, status, last_checked_at, last_success_at, detail
      FROM market_source_health
      ORDER BY source_key
    `,
    sql<Membership[]>`
      SELECT
        members.ticker,
        members.pack_id,
        packs.name,
        packs.is_standard,
        (packs.is_standard OR unlocks.pack_id IS NOT NULL) AS unlocked
      FROM celebrity_pack_members AS members
      JOIN celebrity_packs AS packs
        ON packs.id = members.pack_id
        AND packs.is_published = true
      LEFT JOIN user_pack_unlocks AS unlocks
        ON unlocks.pack_id = members.pack_id
        AND unlocks.user_id = ${userId}
    `,
    getLivePriceMap(),
    syncMarketRegistry(),
  ]);

  const membershipsByTicker = new Map<
    string,
    Array<{ id: number; name: string; isStandard: boolean; unlocked: boolean }>
  >();

  memberships.forEach((membership) => {
    const current = membershipsByTicker.get(membership.ticker) ?? [];
    current.push({
      id: Number(membership.pack_id),
      name: membership.name,
      isStandard: membership.is_standard,
      unlocked: membership.unlocked,
    });
    membershipsByTicker.set(membership.ticker, current);
  });

  const markets = allMarkets.filter((market) =>
    membershipsByTicker.has(market.ticker),
  );
  const latestRefresh =
    markets
      .map((market) => market.snapshot.capturedAt)
      .filter((capturedAt): capturedAt is string => Boolean(capturedAt))
      .sort()
      .at(-1) ?? null;

  return {
    updatedAt: latestRefresh,
    pricingMethod:
      "STKZ is a game market anchored to permitted public attention signals. Real-world momentum sets direction while bounded gameplay volatility and player trading pressure keep markets active and fun.",
    markets: markets.map((market) => {
      const capturedAt = market.snapshot.capturedAt;
      const isStale =
        !capturedAt ||
        Date.now() - new Date(capturedAt).getTime() > STALE_AFTER_MS;
      const packs = membershipsByTicker.get(market.ticker) ?? [];
      const hasStandardAccess = packs.some((pack) => pack.isStandard);
      const lockedPacks = hasStandardAccess
        ? []
        : packs.filter((pack) => !pack.isStandard && !pack.unlocked);
      const live = livePrices.get(market.ticker);

      return {
        ...market,
        access: {
          isStandard: hasStandardAccess,
          isUnlocked: hasStandardAccess || lockedPacks.length === 0,
          requiredPacks: lockedPacks.map(({ id, name }) => ({ id, name })),
        },
        marketState: live
          ? {
              state: live.heatState,
              heatScore: live.heatScore,
              volatilityMultiplier: live.volatilityMultiplier,
              reason: live.heatReason,
              expiresAt: live.heatExpiresAt,
            }
          : {
              state: "normal" as const,
              heatScore: 0,
              volatilityMultiplier: 1,
              reason: "Real-world attention is within its normal range.",
              expiresAt: null,
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
