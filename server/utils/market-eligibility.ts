import { celebrityMarkets } from "./markets";
import { isEligibleMarket } from "./market-metadata";

export function isTradeableCelebrityMarket(ticker: string) {
  const market = celebrityMarkets.find((item) => item.ticker === ticker);
  return Boolean(market && isEligibleMarket(market));
}