import { createError } from "nitro/h3";
import { refreshMarketSnapshots } from "./market-snapshots";
import { processOpenOrders } from "./orders";
import { syncMarketRegistry } from "./market-registry";

const minimumRefreshIntervalMs = 5 * 60 * 1000;
let lastRefreshStartedAt = 0;

export async function runMarketRefresh() {
  if (Date.now() - lastRefreshStartedAt < minimumRefreshIntervalMs) {
    throw createError({
      statusCode: 429,
      statusMessage:
        "A market refresh was started recently. Please wait before trying again.",
    });
  }

  lastRefreshStartedAt = Date.now();
  await syncMarketRegistry();
  const refresh = await refreshMarketSnapshots();
  await processOpenOrders();

  return refresh;
}