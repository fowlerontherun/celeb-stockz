export type MarketTicker =
  | "TSWIFT"
  | "ADELE"
  | "STORMZY"
  | "CR7"
  | "BELLINGHAM"
  | "HAMILTON"
  | "SELENA"
  | "KALUUYA"
  | "MRBEAST"
  | "ATTENBOROUGH"
  | "STARMER"
  | "FARAGE";

export type MarketCategory = "Music" | "Sport" | "Film & TV" | "Politics";

export type CelebrityMarket = {
  name: string;
  ticker: MarketTicker;
  category: MarketCategory;
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

const commonsImage = (fileName: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=600`;

export const celebrityMarkets: CelebrityMarket[] = [
  {
    name: "Taylor Swift",
    ticker: "TSWIFT",
    category: "Music",
    image: commonsImage("Taylor Swift at the 2023 MTV Video Music Awards (3).png"),
    change: 12.6,
    signals: { socialFollowersMillions: 282, hashtagViewsBillions: 38.4, trendScore: 94, monthlySearchesMillions: 18.6, newsStories: 860 },
  },
  {
    name: "Adele",
    ticker: "ADELE",
    category: "Music",
    image: commonsImage("Adele 2016.jpg"),
    change: 8.4,
    signals: { socialFollowersMillions: 58, hashtagViewsBillions: 12.8, trendScore: 85, monthlySearchesMillions: 9.2, newsStories: 430 },
  },
  {
    name: "Stormzy",
    ticker: "STORMZY",
    category: "Music",
    image: commonsImage("Stormzy - Openair Frauenfeld 2019 08.jpg"),
    change: 5.9,
    signals: { socialFollowersMillions: 8.2, hashtagViewsBillions: 4.6, trendScore: 82, monthlySearchesMillions: 3.8, newsStories: 280 },
  },
  {
    name: "Cristiano Ronaldo",
    ticker: "CR7",
    category: "Sport",
    image: commonsImage("Cristiano Ronaldo 2018.jpg"),
    change: 7.8,
    signals: { socialFollowersMillions: 935, hashtagViewsBillions: 95.2, trendScore: 89, monthlySearchesMillions: 15.1, newsStories: 740 },
  },
  {
    name: "Jude Bellingham",
    ticker: "BELLINGHAM",
    category: "Sport",
    image: commonsImage("Jude Bellingham 2023.jpg"),
    change: 14.2,
    signals: { socialFollowersMillions: 37, hashtagViewsBillions: 10.1, trendScore: 96, monthlySearchesMillions: 10.8, newsStories: 790 },
  },
  {
    name: "Lewis Hamilton",
    ticker: "HAMILTON",
    category: "Sport",
    image: commonsImage("Lewis Hamilton 2016 Malaysia 2.jpg"),
    change: -1.7,
    signals: { socialFollowersMillions: 75, hashtagViewsBillions: 16.9, trendScore: 81, monthlySearchesMillions: 6.7, newsStories: 510 },
  },
  {
    name: "Selena Gomez",
    ticker: "SELENA",
    category: "Film & TV",
    image: commonsImage("Selena Gomez at the 2024 Toronto International Film Festival 01.jpg"),
    change: -2.4,
    signals: { socialFollowersMillions: 490, hashtagViewsBillions: 22.1, trendScore: 77, monthlySearchesMillions: 8.4, newsStories: 390 },
  },
  {
    name: "Daniel Kaluuya",
    ticker: "KALUUYA",
    category: "Film & TV",
    image: commonsImage("Daniel Kaluuya by Gage Skidmore.jpg"),
    change: 4.1,
    signals: { socialFollowersMillions: 2.1, hashtagViewsBillions: 1.7, trendScore: 74, monthlySearchesMillions: 2.4, newsStories: 260 },
  },
  {
    name: "MrBeast",
    ticker: "MRBEAST",
    category: "Film & TV",
    image: commonsImage("MrBeast 2023.jpg"),
    change: 10.2,
    signals: { socialFollowersMillions: 520, hashtagViewsBillions: 41.8, trendScore: 91, monthlySearchesMillions: 11.7, newsStories: 680 },
  },
  {
    name: "David Attenborough",
    ticker: "ATTENBOROUGH",
    category: "Film & TV",
    image: commonsImage("David Attenborough 2018.jpg"),
    change: 3.6,
    signals: { socialFollowersMillions: 10.2, hashtagViewsBillions: 2.9, trendScore: 79, monthlySearchesMillions: 3.2, newsStories: 310 },
  },
  {
    name: "Keir Starmer",
    ticker: "STARMER",
    category: "Politics",
    image: commonsImage("Keir Starmer official portrait.jpg"),
    change: 6.8,
    signals: { socialFollowersMillions: 2.3, hashtagViewsBillions: 3.6, trendScore: 88, monthlySearchesMillions: 7.8, newsStories: 960 },
  },
  {
    name: "Nigel Farage",
    ticker: "FARAGE",
    category: "Politics",
    image: commonsImage("Nigel Farage 2020.jpg"),
    change: -4.2,
    signals: { socialFollowersMillions: 2.1, hashtagViewsBillions: 2.2, trendScore: 72, monthlySearchesMillions: 4.1, newsStories: 620 },
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