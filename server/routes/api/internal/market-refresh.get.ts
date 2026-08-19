import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { runMarketRefresh } from "../../../utils/run-market-refresh";

const refreshSecret = process.env.NITRO_MARKET_REFRESH_SECRET;

export default defineHandler(async (event) => {
  if (
    !refreshSecret ||
    getRequestHeader(event, "authorization") !== `Bearer ${refreshSecret}`
  ) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  return runMarketRefresh();
});