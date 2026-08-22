import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../utils/db";
import {
  celebrityMarkets,
  isMarketTicker,
} from "../../../../utils/markets";
import { getRecentLivePriceHistory } from "../../../../utils/market-live-history";
import { runMarketCycle } from "../../../../utils/market-cycle";

type SnapshotPoint = {
  captured_at: string;
  price_stkz: string;
};

type WikipediaSummary = {
  extract?: string;
  description?: string;
  thumbnail?: { source?: string };
};

const bioCache = new Map<
  string,
  { bio: string; description: string; image: string | null; expiresAt: number }
>();
const CACHE_MS = 6 * 60 * 60 * 1000;

async function getWikipediaBio(name: string) {
  const cached = bioCache.get(name);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const fallback = {
    bio: `A public figure featured in the ${name} STKZ practice market.`,
    description: "Public figure",
    image: null,
    expiresAt: Date.now() + CACHE_MS,
  };

  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        name.replaceAll(" ", "_"),
      )}`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "CelebStockz market biography reader",
        },
      },
    );

    if (!response.ok) {
      return fallback;
    }

    const summary = (await response.json()) as WikipediaSummary;
    const bio = {
      bio: summary.extract?.trim() || fallback.bio,
      description: summary.description?.trim() || fallback.description,
      image: summary.thumbnail?.source ?? null,
      expiresAt: Date.now() + CACHE_MS,
    };

    bioCache.set(name, bio);
    return bio;
  } catch {
    return fallback;
  }
}

export default defineHandler(async (event) => {
  const ticker = getRouterParam(event, "ticker")?.toUpperCase();

  if (!ticker || !isMarketTicker(ticker)) {
    throw createError({ statusCode: 404, statusMessage: "Market not found." });
  }

  const market = celebrityMarkets.find((item) => item.ticker === ticker);
  if (!market) {
    throw createError({ statusCode: 404, statusMessage: "Market not found." });
  }

  await runMarketCycle("tick").catch((error) => {
    console.error("Market detail request tick failed", error);
  });

  const [history, liveHistory, wikipedia] = await Promise.all([
    sql<SnapshotPoint[]>`
      SELECT captured_at, price_stkz
      FROM (
        SELECT DISTINCT ON (date_trunc('hour', captured_at))
          captured_at,
          price_stkz,
          date_trunc('hour', captured_at) AS hour_bucket
        FROM market_snapshots
        WHERE ticker = ${ticker} AND refresh_status = 'verified'
        ORDER BY date_trunc('hour', captured_at), captured_at DESC
      ) AS hourly_snapshots
      ORDER BY captured_at DESC
      LIMIT 1500
    `,
    getRecentLivePriceHistory(ticker, 500),
    getWikipediaBio(market.name),
  ]);

  const mergedHistory = new Map<string, { capturedAt: string; price: number }>();

  history.forEach((point) => {
    mergedHistory.set(point.captured_at, {
      capturedAt: point.captured_at,
      price: Number(point.price_stkz),
    });
  });

  liveHistory.forEach((point) => {
    mergedHistory.set(point.capturedAt, {
      capturedAt: point.capturedAt,
      price: point.price,
    });
  });

  return {
    ticker,
    bio: wikipedia.bio,
    description: wikipedia.description,
    image: wikipedia.image,
    history: [...mergedHistory.values()]
      .sort(
        (left, right) =>
          new Date(left.capturedAt).getTime() -
          new Date(right.capturedAt).getTime(),
      )
      .slice(-1500),
  };
});
