import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { isMarketTicker } from "../../../../utils/markets";
import { getRecentSnapshotHistory } from "../../../../utils/market-snapshots";

export default defineHandler(async (event) => {
  const ticker = getRouterParam(event, "ticker")?.toUpperCase();

  if (!ticker || !isMarketTicker(ticker)) {
    throw createError({ statusCode: 404, statusMessage: "Market not found." });
  }

  return {
    ticker,
    history: await getRecentSnapshotHistory(ticker),
  };
});