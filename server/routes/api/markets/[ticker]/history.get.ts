import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { isMarketTicker } from "../../../../utils/markets";
import { getRecentSnapshotHistory } from "../../../../utils/market-snapshots";
import { getRecentLivePriceHistory } from "../../../../utils/market-live-history";
import { runMarketCycle } from "../../../../utils/market-cycle";

export default defineHandler(async (event) => {
  const ticker = getRouterParam(event, "ticker")?.toUpperCase();

  if (!ticker || !isMarketTicker(ticker)) {
    throw createError({ statusCode: 404, statusMessage: "Market not found." });
  }

  await runMarketCycle("tick").catch((error) => {
    console.error("History request market tick failed", error);
  });

  const [snapshotHistory, liveHistory] = await Promise.all([
    getRecentSnapshotHistory(ticker),
    getRecentLivePriceHistory(ticker, 300),
  ]);

  const merged = new Map<
    string,
    { capturedAt: string; price: number; change: number; pageviews: number | null }
  >();

  snapshotHistory.forEach((point) => {
    merged.set(point.capturedAt, {
      capturedAt: point.capturedAt,
      price: point.price,
      change: point.change,
      pageviews: point.pageviews,
    });
  });

  liveHistory.forEach((point) => {
    merged.set(point.capturedAt, {
      capturedAt: point.capturedAt,
      price: point.price,
      change: point.change,
      pageviews: null,
    });
  });

  return {
    ticker,
    history: [...merged.values()]
      .sort(
        (left, right) =>
          new Date(left.capturedAt).getTime() -
          new Date(right.capturedAt).getTime(),
      )
      .slice(-320),
  };
});
