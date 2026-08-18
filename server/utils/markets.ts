export type MarketTicker = "TSWIFT" | "CR7" | "SELENA" | "MRBEAST";

export type CelebrityMarket = {
  name: string;
  ticker: MarketTicker;
  image: string;
  change: number;
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
};

export const celebrityMarkets: CelebrityMarket[] = [
  {
    name: "Taylor Swift",
    ticker: "TSWIFT",
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=280&q=85",
    change: 12.6,
    signals: {
      socialFollowersMillions: 282,
      hashtagViewsBillions: 38.4,
      trendScore: 94,
      monthlySearchesMillions: 18.6,
      newsStories: 860,
    },
  },
  {
    name: "Cristiano Ronaldo",
    ticker: "CR7",
    image:
      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=280&q=85",
    change: 7.8,
    signals: {
      socialFollowersMillions: 935,
      hashtagViewsBillions: 95.2,
      trendScore: 89,
      monthlySearchesMillions: 15.1,
      newsStories: 740,
    },
  },
  {
    name: "Selena Gomez",
    ticker: "SELENA",
    image:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=280&q=85",
    change: -2.4,
    signals: {
      socialFollowersMillions: 490,
      hashtagViewsBillions: 22.1,
      trendScore: 77,
      monthlySearchesMillions: 8.4,
      newsStories: 390,
    },
  },
  {
    name: "MrBeast",
    ticker: "MRBEAST",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=280&q=85",
    change: 10.2,
    signals: {
      socialFollowersMillions: 520,
      hashtagViewsBillions: 41.8,
      trendScore: 91,
      monthlySearchesMillions: 11.7,
      newsStories: 680,
    },
  },
];

export function calculateMarketPrice(
  signals: CelebrityMarket["signals"],
): number {
  const price =
    4 +
    signals.socialFollowersMillions * 0.12 +
    signals.hashtagViewsBillions * 0.8 +
    signals.trendScore * 0.18 +
    signals.monthlySearchesMillions * 0.45 +
    signals.newsStories * 0.06;

  return Number(price.toFixed(2));
}

export const marketPrices = Object.fromEntries(
  celebrityMarkets.map((market) => [
    market.ticker,
    calculateMarketPrice(market.signals),
  ]),
) as Record<MarketTicker, number>;

export function isMarketTicker(value: string): value is MarketTicker {
  return value in marketPrices;
}