import { defineHandler } from "nitro";
import {
  calculateMarketPrice,
  celebrityMarkets,
} from "../../utils/markets";
import { isTradeableCelebrityMarket } from "../../utils/market-eligibility";
import { processOpenOrders } from "../../utils/orders";

export default defineHandler(async () => {
  await processOpenOrders();

  return {
    updatedAt: new Date().toISOString(),
    pricingMethod:
      "Follower reach, hashtag activity, search interest, trend momentum, and news coverage.",
    markets: celebrityMarkets
      .filter((market) => isTradeableCelebrityMarket(market.ticker))
      .map((market) => ({
        ...market,
        price: calculateMarketPrice(market.signals),
      })),
  };
});