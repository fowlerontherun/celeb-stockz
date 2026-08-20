import { defineHandler } from "nitro";
import { createError, getRequestHeader, getQuery } from "nitro/h3";
import { runMarketRefresh } from "../../../utils/run-market-refresh";
import { getSystemSettings } from "../../../utils/system-settings";

export default defineHandler(async (event) => {
  const settings = await getSystemSettings();
  const validSecrets = new Set(
    [
      settings.marketRefreshSecret,
      process.env.NITRO_MARKET_REFRESH_SECRET,
      process.env.CRON_SECRET,
    ].filter(Boolean),
  );

  const authHeader = getRequestHeader(event, "authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const customHeader = getRequestHeader(event, "x-market-refresh-secret");
  const querySecret = getQuery(event)?.secret as string | undefined;

  const providedSecret = bearerToken || customHeader || querySecret;

  if (validSecrets.size > 0 && (!providedSecret || !validSecrets.has(providedSecret))) {
    throw createError({ statusCode: 401, statusMessage: "Invalid or missing market refresh secret." });
  }

  return runMarketRefresh();
});