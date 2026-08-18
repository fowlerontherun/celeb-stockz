import type { CelebrityMarket } from "./markets";

export type MarketMetadata = {
  isLiving: boolean;
  isTradeable: boolean;
  wikipediaTitle: string;
  sourceCategory: CelebrityMarket["category"];
  region: string;
  reviewedAt: string;
};

const reviewedExceptions: Record<string, Pick<MarketMetadata, "isLiving" | "isTradeable">> = {
  BOWIE: { isLiving: false, isTradeable: false },
  AMYWINE: { isLiving: false, isTradeable: false },
  FREDDIE: { isLiving: false, isTradeable: false },
  GMICHAEL: { isLiving: false, isTradeable: false },
  MSMITH: { isLiving: false, isTradeable: false },
};

const toWikipediaTitle = (name: string) => name.replaceAll(" ", "_");

export function getMarketMetadata(market: CelebrityMarket): MarketMetadata {
  const exception = reviewedExceptions[market.ticker];

  return {
    isLiving: exception?.isLiving ?? true,
    isTradeable: exception?.isTradeable ?? true,
    wikipediaTitle: toWikipediaTitle(market.name),
    sourceCategory: market.category,
    region: market.nationality,
    reviewedAt: "2025-02-21",
  };
}

export function isEligibleMarket(market: CelebrityMarket) {
  const metadata = getMarketMetadata(market);
  return metadata.isLiving && metadata.isTradeable;
}