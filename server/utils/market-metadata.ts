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
  // K-POP
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

  // FOOTBALL
  BELLINGHAM: "Jude_Bellingham",
  CR7: "Cristiano_Ronaldo",
  MESSI: "Lionel_Messi",
  MBAPPE: "Kylian_Mbappé",
  HAALAND: "Erling_Haaland",
  LAMINE: "Lamine_Yamal",
  VINICIUS: "Vinícius_Júnior",
  SONNY: "Son_Heung-min",
  MOSALAH: "Mohamed_Salah",
  KDB: "Kevin_De_Bruyne",
  RODRI: "Rodri_(footballer)",
  CPALMER: "Cole_Palmer",
  MAINOO: "Kobbie_Mainoo",
  FODEN: "Phil_Foden",
  RICE: "Declan_Rice",
  TAA: "Trent_Alexander-Arnold",
  HKANE: "Harry_Kane",
  SAKA: "Bukayo_Saka",
  RASHFORD: "Marcus_Rashford",

  // BASKETBALL
  LEBRON: "LeBron_James",
  SCURRY: "Stephen_Curry",
  GIANNIS: "Giannis_Antetokounmpo",
  LUKADONCIC: "Luka_Dončić",
  JOKIC: "Nikola_Jokić",
  WEMBY: "Victor_Wembanyama",
  KDURANT: "Kevin_Durant",
  ANTEDWARDS: "Anthony_Edwards_(basketball)",
  JTATUM: "Jayson_Tatum",
  JAMORANT: "Ja_Morant",
  SGA: "Shai_Gilgeous-Alexander",
  JBRUNSON: "Jalen_Brunson",
  DMITCHELLNBA: "Donovan_Mitchell",
  DBOOKER: "Devin_Booker",
  CCLARK: "Caitlin_Clark",
  AREESE: "Angel_Reese",
  SIONESCU: "Sabrina_Ionescu",
  AJAWILSON: "A'ja_Wilson",

  // MOTORSPORT
  HAMILTON: "Lewis_Hamilton",
  LNORRIS: "Lando_Norris",
  GRUSSELL: "George_Russell_(racing_driver)",
  VERSTAPPEN: "Max_Verstappen",
  LECLERC: "Charles_Leclerc",
  PIASTRI: "Oscar_Piastri",
  SAINZ: "Carlos_Sainz_Jr.",
  ALONSO: "Fernando_Alonso",
  OBEARMAN: "Oliver_Bearman",
  KANTONELLI: "Kimi_Antonelli",
  COLAPINTO: "Franco_Colapinto",
  MMARQUEZ: "Marc_Márquez",
  BAGNAIA: "Francesco_Bagnaia",

  // COMBAT
  FURY: "Tyson_Fury",
  AJOSHUA: "Anthony_Joshua",
  USYK: "Oleksandr_Usyk",
  CANELO: "Canelo_Álvarez",
  KTAYLOR: "Katie_Taylor",
  NINOUE: "Naoya_Inoue",
  TANKDAVIS: "Gervonta_Davis",
  MCGREGOR: "Conor_McGregor",
  JONJONES: "Jon_Jones",
  MAKHACHEV: "Islam_Makhachev",
  PEREIRA: "Alex_Pereira",
  SOMALLEY: "Sean_O'Malley_(fighter)",
  ADESANYA: "Israel_Adesanya",
  TOPURIA: "Ilia_Topuria",
  CHIMAEV: "Khamzat_Chimaev",
  PADDYP: "Paddy_Pimblett",
  MHOLLOWAY: "Max_Holloway",

  // TENNIS & GOLF
  ALCARAZ: "Carlos_Alcaraz",
  SINNER: "Jannik_Sinner",
  DJOKOVIC: "Novak_Djokovic",
  AZVEREV: "Alexander_Zverev",
  MEDVEDEV: "Daniil_Medvedev",
  JDRAPER: "Jack_Draper",
  CGAUFF: "Coco_Gauff",
  SWIATEK: "Iga_Świątek",
  SABALENKA: "Aryna_Sabalenka",
  RADUCANU: "Emma_Raducanu",
  MURRAY: "Andy_Murray",
  SCHEFFLER: "Scottie_Scheffler",
  DECHAMBEAU: "Bryson_DeChambeau",
  RMCILROY: "Rory_McIlroy",
  JONRAHM: "Jon_Rahm",
  TWOODS: "Tiger_Woods",

  // NFL / MLB
  MAHOMES: "Patrick_Mahomes",
  TKELCE: "Travis_Kelce",
  LAMARJ: "Lamar_Jackson",
  JOSHALLEN: "Josh_Allen_(quarterback)",
  JBURROW: "Joe_Burrow",
  JJEFFERSON: "Justin_Jefferson",
  SBARKLEY: "Saquon_Barkley",
  CJSTROUD: "C._J._Stroud",
  OHTANI: "Shohei_Ohtani",
  AJUDGE: "Aaron_Judge",
  JUANSOTO: "Juan_Soto",
  MBETTS: "Mookie_Betts",
  EDELACRUZ: "Elly_De_La_Cruz",
  BHARPER: "Bryce_Harper",

  // MUSIC & ENTERTAINMENT
  TSWIFT: "Taylor_Swift",
  ADELE: "Adele",
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