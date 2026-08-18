import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { refreshMarketSnapshots } from "../../../utils/market-snapshots";

const refreshSecret = process.env.NITRO_MARKET_REFRESH_SECRET;

export default defineHandler(async (event) => {
  const suppliedSecret = getRequestHeader(event, "x-market-refresh-secret");

  if (!refreshSecret || suppliedSecret !== refreshSecret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  return refreshMarketSnapshots();
});