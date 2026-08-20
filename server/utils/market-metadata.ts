import type { CelebrityMarket } from "./markets";

export type MarketMetadata = {
  isLiving: boolean;
  isTradeable: boolean;
  wikipediaTitle: string;
  sourceCategory: CelebrityMarket["category"];
  region: string;
  reviewedAt: string;
};

const customWikipediaTitles: Record<string, string> = {
  JUNGKOOK: "Jungkook",
  JIMIN: "Jimin",
  V_BTS: "V_(singer)",
  RMBTS: "RM_(musician)",
  SUGA: "Suga_(rapper)",
  JINBTS: "Jin_(singer)",
  JHOPE: "J-Hope",
  JENNIE: "Jennie_(singer)",
  LISAMUSIC: "Lisa_(rapper)",
  JISOO: "Jisoo",
  ROSEPARK: "Rosé_(singer)",
  STRAYKIDS: "Stray_Kids",
  FELIXSKZ: "Felix_(rapper)",
  NEWJEANS: "NewJeans",
  HANNINJ: "Hanni_(singer)",
  AESPA: "Aespa",
  KARINAAESPA: "Karina_(South_Korean_singer)",
  IU_LEE: "IU_(singer)",
  CHAEUNWOO: "Cha_Eun-woo",
  SEVENTEEN: "Seventeen_(South_Korean_band)",
  ENHYPEN: "Enhypen",
  TWICE: "Twice_(group)",
  NAYEON: "Nayeon",
  TSWIFT: "Taylor_Swift",
  ADELE: "Adele",
  BELLINGHAM: "Jude_Bellingham",
  CR7: "Cristiano_Ronaldo",
  MESSI: "Lionel_Messi",
  MBAPPE: "Kylian_Mbappé",
  HAALAND: "Erling_Haaland",
  LAMINE: "Lamine_Yamal",
  VINICIUS: "Vinícius_Júnior",
  SONNY: "Son_Heung-min",
  LEBRON: "LeBron_James",
  SCURRY: "Stephen_Curry",
  OHTANI: "Shohei_Ohtani",
  WEMBY: "Victor_Wembanyama",
  CCLARK: "Caitlin_Clark",
  LNORRIS: "Lando_Norris",
  ALCARAZ: "Carlos_Alcaraz",
  SINNER: "Jannik_Sinner",
  VERSTAPPEN: "Max_Verstappen",
  LECLERC: "Charles_Leclerc",
  MRBEAST: "MrBeast",
  KSI: "KSI",
  SPEED: "IShowSpeed",
  KAICENAT: "Kai_Cenat",
  CHALAMET: "Timothée_Chalamet",
  ZENDAYA: "Zendaya",
  MURPHY: "Cillian_Murphy",
  FPUGH: "Florence_Pugh",
  MROBBIE: "Margot_Robbie",
  PPASCAL: "Pedro_Pascal",
  JAWHITE: "Jeremy_Allen_White",
  SSWEENEY: "Sydney_Sweeney",
  JORTEGA: "Jenna_Ortega",
  MBB: "Millie_Bobby_Brown",
  CHAPPELL: "Chappell_Roan",
  SCARPENTER: "Sabrina_Carpenter",
  ORODRIGO: "Olivia_Rodrigo",
  BEILISH: "Billie_Eilish",
  CHARLI: "Charli_XCX",
  RAYE: "Raye_(singer)",
  DUALIPA: "Dua_Lipa",
  HSTYLES: "Harry_Styles",
  EDSHEERAN: "Ed_Sheeran",
};

const reviewedExceptions: Record<string, Pick<MarketMetadata, "isLiving" | "isTradeable">> = {
  BOWIE: { isLiving: false, isTradeable: false },
  AMYWINE: { isLiving: false, isTradeable: false },
  FREDDIE: { isLiving: false, isTradeable: false },
  GMICHAEL: { isLiving: false, isTradeable: false },
  MSMITH: { isLiving: false, isTradeable: false },
};

const toWikipediaTitle = (market: CelebrityMarket) =>
  customWikipediaTitles[market.ticker] ?? market.name.replaceAll(" ", "_");

export function getMarketMetadata(market: CelebrityMarket): MarketMetadata {
  const exception = reviewedExceptions[market.ticker];

  return {
    isLiving: exception?.isLiving ?? true,
    isTradeable: exception?.isTradeable ?? true,
    wikipediaTitle: toWikipediaTitle(market),
    sourceCategory: market.category,
    region: market.nationality,
    reviewedAt: "2025-02-21",
  };
}

export function isEligibleMarket(market: CelebrityMarket) {
  const metadata = getMarketMetadata(market);
  return metadata.isLiving && metadata.isTradeable;
}