import { defineHandler } from "nitro";
import {
  calculateMarketPrice,
  celebrityMarkets,
} from "../../utils/markets";
import { processOpenOrders } from "../../utils/orders";

export default defineHandler(async () => {
  await processOpenOrders();

  return {
    updatedAt: new Date().toISOString(),
    pricingMethod:
      "Follower reach, hashtag activity, search interest, trend momentum, and news coverage.",
    markets: celebrityMarkets.map((market) => ({
      ...market,
      price: calculateMarketPrice(market.signals),
    })),
  };
});