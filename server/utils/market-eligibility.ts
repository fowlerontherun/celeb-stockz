const retiredCelebrityTickers = new Set([
  "BOWIE",
  "AMYWINE",
  "FREDDIE",
  "GMICHAEL",
  "MSMITH",
]);

export function isTradeableCelebrityMarket(ticker: string) {
  return !retiredCelebrityTickers.has(ticker);
}