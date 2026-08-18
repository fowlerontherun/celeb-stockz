export const marketPrices = {
  AMARA: 38.42,
  LEO: 22.18,
  SIENNA: 51.07,
  DANTE: 17.63,
} as const;

export type MarketTicker = keyof typeof marketPrices;

export function isMarketTicker(value: string): value is MarketTicker {
  return value in marketPrices;
}