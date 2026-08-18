import { defineHandler } from "nitro";
import {
  calculateMarketPrice,
  celebrityMarkets,
} from "../../utils/markets";

export default defineHandler(() => ({
  updatedAt: new Date().toISOString(),
  pricingMethod:
    "Follower reach, hashtag activity, search interest, trend momentum, and news coverage.",
  markets: celebrityMarkets.map((market) => ({
    ...market,
    price: calculateMarketPrice(market.signals),
  })),
}));