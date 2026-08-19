import { defineHandler } from "nitro";
import { getRouterParam } from "nitro/h3";
import { celebrityMarkets } from "../../../utils/markets";

type WikipediaSummary = {
  thumbnail?: {
    source?: string;
  };
  originalimage?: {
    source?: string;
  };
};

const imageCache = new Map<string, string>();

function fallbackImage(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=2a1740&color=fff8f2&bold=true&size=512`;
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

  const title = market.name.replaceAll(" ", "_");

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "CelebStockz public-profile image loader",
        },
      },
    );

    if (response.ok) {
      const summary = (await response.json()) as WikipediaSummary;
      const image = summary.originalimage?.source ?? summary.thumbnail?.source;

      if (image) {
        imageCache.set(market.ticker, image);
        return Response.redirect(image, 302);
      }
    }
  } catch (error) {
    console.error("Could not load a public celebrity profile image", {
      ticker: market.ticker,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const fallback = fallbackImage(market.name);
  imageCache.set(market.ticker, fallback);

  return Response.redirect(fallback, 302);
});