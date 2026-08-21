import { defineHandler } from "nitro";
import { createError, getRequestHeader, getQuery } from "nitro/h3";
import { getSystemSettings } from "../../../utils/system-settings";
import {
  runMarketCycle,
  type MarketCycleMode,
} from "../../../utils/market-cycle";
import { clearMarketResponseCache } from "../../../utils/market-response-cache";

function parseMode(value: unknown): MarketCycleMode {
  return value === "collect" || value === "tick" || value === "cycle"
    ? value
    : "cycle";
}

export default defineHandler(async (event) => {
  const settings = await getSystemSettings();
  const validSecrets = new Set(
    [
      settings.marketRefreshSecret,
      process.env.NITRO_MARKET_REFRESH_SECRET,
      process.env.CRON_SECRET,
    ].filter(Boolean),
  );

  if (validSecrets.size === 0) {
    throw createError({
      statusCode: 503,
      statusMessage:
        "Market refresh scheduling is disabled until a server-side refresh secret is configured.",
    });
  }

  const authHeader = getRequestHeader(event, "authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const customHeader = getRequestHeader(event, "x-market-refresh-secret");
  const providedSecret = bearerToken || customHeader;

  if (!providedSecret || !validSecrets.has(providedSecret)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or missing market refresh secret.",
    });
  }

  const mode = parseMode(getQuery(event)?.mode);
  const result = await runMarketCycle(mode);
  clearMarketResponseCache();
  return result;
});
