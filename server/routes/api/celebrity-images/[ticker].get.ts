import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { celebrityMarkets } from "../../../utils/markets";
import { getMarketMetadata } from "../../../utils/market-metadata";

type WikipediaSummary = {
  thumbnail?: {
    source?: string;
  };
  originalimage?: {
    source?: string;
  };
};

const imageCache = new Map<string, string>();

const categoryColorGradients: Record<string, { bg: string; fg: string }> = {
  Music: { bg: "4a154b", fg: "ff9ca5" },
  Sport: { bg: "12382e", fg: "62e7b6" },
  Film: { bg: "3a2210", fg: "ffd17b" },
  TV: { bg: "1a2a44", fg: "72c8ff" },
  Politics: { bg: "2f183d", fg: "c99bff" },
  Fashion: { bg: "441632", fg: "ff9bc8" },
  Digital: { bg: "113840", fg: "77d7ff" },
  Comedy: { bg: "3f2c12", fg: "ffcb78" },
};

function fallbackImage(name: string, category = "Music") {
  const colors = categoryColorGradients[category] ?? { bg: "2a1740", fg: "fff8f2" };
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=${colors.bg}&color=${colors.fg}&bold=true&size=512&rounded=true&font-size=0.38`;
}

export default defineHandler(async (event) => {
  const ticker = getRouterParam(event, "ticker")?.toUpperCase();
  const market = celebrityMarkets.find((item) => item.ticker === ticker);

  if (!market) {
    return new Response(null, { status: 404 });
  }

  const cachedImage = imageCache.get(market.ticker);
  if (cachedImage) {
    return Response.redirect(cachedImage, 302);
  }

  const metadata = getMarketMetadata(market);
  const titlesToTry = [
    metadata.wikipediaTitle,
    market.name.replaceAll(" ", "_"),
    `${market.name.replaceAll(" ", "_")}_(singer)`,
    `${market.name.replaceAll(" ", "_")}_(actor)`,
    `${market.name.replaceAll(" ", "_")}_(musician)`,
  ];

  for (const title of titlesToTry) {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        {
          headers: {
            accept: "application/json",
            "user-agent": "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)",
          },
        },
      );

      if (response.ok) {
        const summary = (await response.json()) as WikipediaSummary;
        const image = summary.thumbnail?.source || summary.originalimage?.source;

        if (image) {
          imageCache.set(market.ticker, image);
          return Response.redirect(image, 302);
        }
      }
    } catch {
      // Continue to next title attempt
    }
  }

  const fallback = fallbackImage(market.name, market.category);
  imageCache.set(market.ticker, fallback);

  return Response.redirect(fallback, 302);
});