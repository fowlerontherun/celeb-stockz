import { additionalCelebrityMarkets } from "./additional-markets";

export type MarketTicker = string;
export type MarketCategory = "Music" | "Sport" | "Film" | "TV" | "Politics";

export type CelebrityMarket = {
  name: string;
  ticker: MarketTicker;
  category: MarketCategory;
  image: string;
  change: number;
  birthYear: number;
  nationality: string;
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
};

const commonsImage = (fileName: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=900`;

const originalMarkets: CelebrityMarket[] = [
  { name: "Taylor Swift", ticker: "TSWIFT", category: "Music", image: commonsImage("Taylor Swift at the 2023 MTV Video Music Awards (3).png"), change: 12.6, birthYear: 1989, nationality: "American", signals: { socialFollowersMillions: 282, hashtagViewsBillions: 38.4, trendScore: 94, monthlySearchesMillions: 18.6, newsStories: 860 } },
  { name: "Adele", ticker: "ADELE", category: "Music", image: commonsImage("Adele 2016.jpg"), change: 8.4, birthYear: 1988, nationality: "British", signals: { socialFollowersMillions: 58, hashtagViewsBillions: 12.8, trendScore: 85, monthlySearchesMillions: 9.2, newsStories: 430 } },
  { name: "Stormzy", ticker: "STORMZY", category: "Music", image: commonsImage("Stormzy - Openair Frauenfeld 2019 08.jpg"), change: 5.9, birthYear: 1993, nationality: "British", signals: { socialFollowersMillions: 8.2, hashtagViewsBillions: 4.6, trendScore: 82, monthlySearchesMillions: 3.8, newsStories: 280 } },
  { name: "Dua Lipa", ticker: "DUALIPA", category: "Music", image: commonsImage("Dua Lipa at Glastonbury Festival 2024.png"), change: 11.3, birthYear: 1995, nationality: "British", signals: { socialFollowersMillions: 88, hashtagViewsBillions: 29.4, trendScore: 93, monthlySearchesMillions: 12.7, newsStories: 630 } },
  { name: "Ed Sheeran", ticker: "EDSHEERAN", category: "Music", image: commonsImage("Ed Sheeran-6685 (cropped).jpg"), change: 4.8, birthYear: 1991, nationality: "British", signals: { socialFollowersMillions: 146, hashtagViewsBillions: 18.1, trendScore: 78, monthlySearchesMillions: 8.5, newsStories: 370 } },
  { name: "Harry Styles", ticker: "HSTYLES", category: "Music", image: commonsImage("Harry Styles at the 2023 Grammy Awards.jpg"), change: 9.7, birthYear: 1994, nationality: "British", signals: { socialFollowersMillions: 48, hashtagViewsBillions: 24.6, trendScore: 90, monthlySearchesMillions: 9.9, newsStories: 520 } },
  { name: "Cristiano Ronaldo", ticker: "CR7", category: "Sport", image: commonsImage("Cristiano Ronaldo 2018.jpg"), change: 7.8, birthYear: 1985, nationality: "Portuguese", signals: { socialFollowersMillions: 935, hashtagViewsBillions: 95.2, trendScore: 89, monthlySearchesMillions: 15.1, newsStories: 740 } },
  { name: "Jude Bellingham", ticker: "BELLINGHAM", category: "Sport", image: commonsImage("Jude Bellingham 2023.jpg"), change: 14.2, birthYear: 2003, nationality: "British", signals: { socialFollowersMillions: 37, hashtagViewsBillions: 10.1, trendScore: 96, monthlySearchesMillions: 10.8, newsStories: 790 } },
  { name: "Lewis Hamilton", ticker: "HAMILTON", category: "Sport", image: commonsImage("Lewis Hamilton 2016 Malaysia 2.jpg"), change: -1.7, birthYear: 1985, nationality: "British", signals: { socialFollowersMillions: 75, hashtagViewsBillions: 16.9, trendScore: 81, monthlySearchesMillions: 6.7, newsStories: 510 } },
  { name: "Bukayo Saka", ticker: "SAKA", category: "Sport", image: commonsImage("Bukayo Saka 2021.jpg"), change: 13.1, birthYear: 2001, nationality: "British", signals: { socialFollowersMillions: 18, hashtagViewsBillions: 6.7, trendScore: 94, monthlySearchesMillions: 6.2, newsStories: 680 } },
  { name: "Emma Raducanu", ticker: "RADUCANU", category: "Sport", image: commonsImage("Emma Raducanu 2021.jpg"), change: 6.6, birthYear: 2002, nationality: "British", signals: { socialFollowersMillions: 3.1, hashtagViewsBillions: 3.9, trendScore: 84, monthlySearchesMillions: 4.5, newsStories: 310 } },
  { name: "Mo Farah", ticker: "MOFARAH", category: "Sport", image: commonsImage("Mo Farah 2016.jpg"), change: 2.9, birthYear: 1983, nationality: "British", signals: { socialFollowersMillions: 1.7, hashtagViewsBillions: 1.8, trendScore: 71, monthlySearchesMillions: 2.2, newsStories: 190 } },
  { name: "Daniel Kaluuya", ticker: "KALUUYA", category: "Film", image: commonsImage("Daniel Kaluuya by Gage Skidmore.jpg"), change: 4.1, birthYear: 1989, nationality: "British", signals: { socialFollowersMillions: 2.1, hashtagViewsBillions: 1.7, trendScore: 74, monthlySearchesMillions: 2.4, newsStories: 260 } },
  { name: "Olivia Colman", ticker: "OLIVIAC", category: "Film", image: commonsImage("Olivia Colman 2014.jpg"), change: 5.4, birthYear: 1974, nationality: "British", signals: { socialFollowersMillions: 1.4, hashtagViewsBillions: 1.1, trendScore: 79, monthlySearchesMillions: 2.8, newsStories: 350 } },
  { name: "Idris Elba", ticker: "IDRISELBA", category: "Film", image: commonsImage("Idris Elba-6696 (cropped).jpg"), change: 7.2, birthYear: 1972, nationality: "British", signals: { socialFollowersMillions: 7.2, hashtagViewsBillions: 4.8, trendScore: 86, monthlySearchesMillions: 4.9, newsStories: 390 } },
  { name: "Cillian Murphy", ticker: "MURPHY", category: "Film", image: commonsImage("Cillian Murphy-6365.jpg"), change: 10.8, birthYear: 1976, nationality: "Irish", signals: { socialFollowersMillions: 6.1, hashtagViewsBillions: 8.3, trendScore: 92, monthlySearchesMillions: 8.1, newsStories: 610 } },
  { name: "Selena Gomez", ticker: "SELENA", category: "TV", image: commonsImage("Selena Gomez at the 2024 Toronto International Film Festival 01.jpg"), change: -2.4, birthYear: 1992, nationality: "American", signals: { socialFollowersMillions: 490, hashtagViewsBillions: 22.1, trendScore: 77, monthlySearchesMillions: 8.4, newsStories: 390 } },
  { name: "MrBeast", ticker: "MRBEAST", category: "TV", image: commonsImage("MrBeast 2023.jpg"), change: 10.2, birthYear: 1998, nationality: "American", signals: { socialFollowersMillions: 520, hashtagViewsBillions: 41.8, trendScore: 91, monthlySearchesMillions: 11.7, newsStories: 680 } },
  { name: "David Attenborough", ticker: "ATTENBOROUGH", category: "TV", image: commonsImage("David Attenborough 2018.jpg"), change: 3.6, birthYear: 1926, nationality: "British", signals: { socialFollowersMillions: 10.2, hashtagViewsBillions: 2.9, trendScore: 79, monthlySearchesMillions: 3.2, newsStories: 310 } },
  { name: "Maya Jama", ticker: "MAYAJAMA", category: "TV", image: commonsImage("Maya Jama 2022.jpg"), change: 12.2, birthYear: 1994, nationality: "British", signals: { socialFollowersMillions: 3.2, hashtagViewsBillions: 5.4, trendScore: 91, monthlySearchesMillions: 4.6, newsStories: 420 } },
  { name: "Gordon Ramsay", ticker: "GORDONR", category: "TV", image: commonsImage("Gordon Ramsay 2010.jpg"), change: 4.4, birthYear: 1966, nationality: "British", signals: { socialFollowersMillions: 20, hashtagViewsBillions: 8.2, trendScore: 82, monthlySearchesMillions: 5.3, newsStories: 290 } },
  { name: "Ant & Dec", ticker: "ANTDEC", category: "TV", image: commonsImage("Ant and Dec 2014.jpg"), change: 3.7, birthYear: 1975, nationality: "British", signals: { socialFollowersMillions: 4.6, hashtagViewsBillions: 2.2, trendScore: 75, monthlySearchesMillions: 2.9, newsStories: 240 } },
  { name: "Keir Starmer", ticker: "STARMER", category: "Politics", image: commonsImage("Keir Starmer official portrait.jpg"), change: 6.8, birthYear: 1962, nationality: "British", signals: { socialFollowersMillions: 2.3, hashtagViewsBillions: 3.6, trendScore: 88, monthlySearchesMillions: 7.8, newsStories: 960 } },
  { name: "Nigel Farage", ticker: "FARAGE", category: "Politics", image: commonsImage("Nigel Farage 2020.jpg"), change: -4.2, birthYear: 1964, nationality: "British", signals: { socialFollowersMillions: 2.1, hashtagViewsBillions: 2.2, trendScore: 72, monthlySearchesMillions: 4.1, newsStories: 620 } },
  { name: "Rishi Sunak", ticker: "SUNAK", category: "Politics", image: commonsImage("Rishi Sunak official portrait.jpg"), change: 1.8, birthYear: 1980, nationality: "British", signals: { socialFollowersMillions: 1.8, hashtagViewsBillions: 2.5, trendScore: 69, monthlySearchesMillions: 4.8, newsStories: 540 } },
  { name: "Sadiq Khan", ticker: "SADIQ", category: "Politics", image: commonsImage("Sadiq Khan 2016.jpg"), change: 5.1, birthYear: 1970, nationality: "British", signals: { socialFollowersMillions: 1.1, hashtagViewsBillions: 1.6, trendScore: 76, monthlySearchesMillions: 3.1, newsStories: 380 } },
];

export const celebrityMarkets: CelebrityMarket[] = [
  ...originalMarkets,
  ...additionalCelebrityMarkets,
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