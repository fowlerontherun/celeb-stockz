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

const categoryPalette: Record<
  string,
  { bg1: string; bg2: string; accent: string; text: string }
> = {
  Music: { bg1: "#4a1236", bg2: "#200818", accent: "#ff7282", text: "#fff0f3" },
  Sport: { bg1: "#0e3a2f", bg2: "#071c17", accent: "#62e7b6", text: "#e8fff6" },
  Film: { bg1: "#3d2508", bg2: "#1f1204", accent: "#ffd17b", text: "#fff9eb" },
  TV: { bg1: "#122a45", bg2: "#081523", accent: "#72c8ff", text: "#edf7ff" },
  Politics: { bg1: "#341348", bg2: "#190823", accent: "#c99bff", text: "#f6edff" },
  Fashion: { bg1: "#451239", bg2: "#21071b", accent: "#ff9bc8", text: "#fff0f7" },
  Digital: { bg1: "#10333d", bg2: "#061a1f", accent: "#77d7ff", text: "#eefaff" },
  Comedy: { bg1: "#3d2b0e", bg2: "#1e1405", accent: "#ffcb78", text: "#fff8ed" },
};

function generateSvgAvatar(name: string, category: string, ticker: string) {
  const palette = categoryPalette[category] ?? {
    bg1: "#291740",
    bg2: "#130920",
    accent: "#c99bff",
    text: "#fff8f2",
  };

  const words = name.trim().split(" ");
  const initials =
    words.length > 1
      ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="grad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${palette.bg1}" />
      <stop offset="100%" stop-color="${palette.bg2}" />
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="${palette.accent}" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#grad)" />
  <circle cx="256" cy="230" r="140" fill="${palette.accent}" fill-opacity="0.12" stroke="${palette.accent}" stroke-opacity="0.3" stroke-width="4" filter="url(#glow)" />
  <text x="256" y="270" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="110" fill="${palette.text}" letter-spacing="-2">
    ${initials}
  </text>
  <rect x="156" y="390" width="200" height="42" rx="21" fill="${palette.accent}" fill-opacity="0.2" stroke="${palette.accent}" stroke-width="1.5" />
  <text x="256" y="417" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="20" fill="${palette.accent}" letter-spacing="3">
    $${ticker}
  </text>
</svg>`.trim();

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
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
    `${market.name.replaceAll(" ", "_")}_(politician)`,
    `${market.name.replaceAll(" ", "_")}_(actor)`,
    `${market.name.replaceAll(" ", "_")}_(actress)`,
    `${market.name.replaceAll(" ", "_")}_(footballer)`,
    `${market.name.replaceAll(" ", "_")}_(presenter)`,
    `${market.name.replaceAll(" ", "_")}_(singer)`,
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

  return generateSvgAvatar(market.name, market.category, market.ticker);
});