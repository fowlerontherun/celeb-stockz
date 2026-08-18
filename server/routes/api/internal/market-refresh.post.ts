import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { refreshMarketSnapshots } from "../../../utils/market-snapshots";
import { processOpenOrders } from "../../../utils/orders";

const refreshSecret = process.env.NITRO_MARKET_REFRESH_SECRET;
const MINIMUM_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
let lastRefreshStartedAt = 0;

export default defineHandler(async (event) => {
  const suppliedSecret = getRequestHeader(event, "x-market-refresh-secret");

  if (!refreshSecret || suppliedSecret !== refreshSecret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (Date.now() - lastRefreshStartedAt < MINIMUM_REFRESH_INTERVAL_MS) {
    throw createError({
      statusCode: 429,
      statusMessage: "A market refresh was started recently. Please wait before trying again.",
    });
  }

  lastRefreshStartedAt = Date.now();
  const refresh = await refreshMarketSnapshots();
  await processOpenOrders();

  return refresh;
});