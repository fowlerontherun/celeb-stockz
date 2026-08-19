import { sql } from "./db";
import type { CelebrityMarket } from "./markets";
import { getSystemSettings } from "./system-settings";

type SignalStatus = "verified" | "unavailable";

export type AdditionalPriceSignals = {
  newsMentions: number | null;
  searchResults: number | null;
  youtubeSubscribers: number | null;
  youtubeViews: number | null;
  practiceTradePressure: number;
  statuses: {
    news: SignalStatus;
    search: SignalStatus;
    youtube: SignalStatus;
    trades: "verified";
  };
};

type CacheEntry = {
  value: AdditionalPriceSignals;
  expiresAt: number;
};

type TradePressureRow = {
  ticker: string;
  buy_volume: string;
  sell_volume: string;
};

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
let tradePressureCache:
  | { values: Map<string, number>; expiresAt: number }
  | undefined;

async function getNewsMentions(name: string) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `"${name}"`);
  url.searchParams.set("mode", "timelinevolraw");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "250");
  url.searchParams.set(
    "startdatetime",
    new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .replaceAll(/[-:.TZ]/g, "")
      .slice(0, 14),
  );

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "CelebStockz practice-market signal monitor",
      },
    });

    if (!response.ok) {
      return { value: null, status: "unavailable" as const };
    }

    const data = (await response.json()) as {
      timeline?: Array<{ value?: number }>;
    };
    const value = data.timeline?.reduce(
      (total, point) => total + (Number(point.value) || 0),
      0,
    );

    return {
      value: Number.isFinite(value) ? (value ?? 0) : null,
      status: Number.isFinite(value)
        ? ("verified" as const)
        : ("unavailable" as const),
    };
  } catch {
    return { value: null, status: "unavailable" as const };
  }
}

async function getSearchResults(name: string, apiKey: string, cx: string) {
  if (!apiKey || !cx) {
    return { value: null, status: "unavailable" as const };
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", name);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { value: null, status: "unavailable" as const };
    }

    const data = (await response.json()) as {
      searchInformation?: { totalResults?: string };
    };
    const value = Number(data.searchInformation?.totalResults);

    return {
      value: Number.isSafeInteger(value) && value >= 0 ? value : null,
      status:
        Number.isSafeInteger(value) && value >= 0
          ? ("verified" as const)
          : ("unavailable" as const),
    };
  } catch {
    return { value: null, status: "unavailable" as const };
  }
}

async function getYoutubeStatistics(
  ticker: string,
  apiKey: string,
  channelMap: Record<string, string>,
) {
  const channelId = channelMap[ticker];

  if (!apiKey || !channelId) {
    return {
      subscribers: null,
      views: null,
      status: "unavailable" as const,
    };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", channelId);
  url.searchParams.set("part", "statistics");

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        subscribers: null,
        views: null,
        status: "unavailable" as const,
      };
    }

    const data = (await response.json()) as {
      items?: Array<{
        statistics?: { subscriberCount?: string; viewCount?: string };
      }>;
    };
    const statistics = data.items?.[0]?.statistics;
    const subscribers = Number(statistics?.subscriberCount);
    const views = Number(statistics?.viewCount);
    const isValid =
      Number.isSafeInteger(subscribers) &&
      subscribers >= 0 &&
      Number.isSafeInteger(views) &&
      views >= 0;

    return {
      subscribers: isValid ? subscribers : null,
      views: isValid ? views : null,
      status: isValid ? ("verified" as const) : ("unavailable" as const),
    };
  } catch {
    return {
      subscribers: null,
      views: null,
      status: "unavailable" as const,
    };
  }
}

async function getPracticeTradePressure(ticker: string) {
  if (tradePressureCache && tradePressureCache.expiresAt > Date.now()) {
    return tradePressureCache.values.get(ticker) ?? 0;
  }

  const rows = await sql<TradePressureRow[]>`
    SELECT
      ticker,
      COALESCE(SUM(total_stkz) FILTER (WHERE side = 'buy'), 0) AS buy_volume,
      COALESCE(SUM(total_stkz) FILTER (WHERE side = 'sell'), 0) AS sell_volume
    FROM trade_history
    WHERE created_at >= now() - interval '24 hours'
    GROUP BY ticker
  `;

  const values = new Map(
    rows.map((row) => {
      const buyVolume = Number(row.buy_volume);
      const sellVolume = Number(row.sell_volume);
      const grossVolume = buyVolume + sellVolume;

      if (!grossVolume) {
        return [row.ticker, 0] as const;
      }

      const imbalance = (buyVolume - sellVolume) / grossVolume;
      const volumeStrength = Math.min(1, Math.log10(grossVolume + 1) / 4);
      const pressure = Number((imbalance * volumeStrength * 2.5).toFixed(4));

      return [row.ticker, pressure] as const;
    }),
  );

  tradePressureCache = {
    values,
    expiresAt: Date.now() + CACHE_MS,
  };

  return values.get(ticker) ?? 0;
}

export async function getAdditionalPriceSignals(
  market: CelebrityMarket,
): Promise<AdditionalPriceSignals> {
  const cached = cache.get(market.ticker);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const settings = await getSystemSettings();

  const [news, search, youtube, practiceTradePressure] = await Promise.all([
    getNewsMentions(market.name),
    getSearchResults(market.name, settings.googleSearchApiKey, settings.googleSearchEngineId),
    getYoutubeStatistics(market.ticker, settings.youtubeApiKey, settings.youtubeChannels),
    getPracticeTradePressure(market.ticker),
  ]);

  const value = {
    newsMentions: news.value,
    searchResults: search.value,
    youtubeSubscribers: youtube.subscribers,
    youtubeViews: youtube.views,
    practiceTradePressure,
    statuses: {
      news: news.status,
      search: search.status,
      youtube: youtube.status,
      trades: "verified" as const,
    },
  };

  cache.set(market.ticker, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

export function getAdditionalSignalBoost(signals: AdditionalPriceSignals) {
  const newsBoost =
    signals.newsMentions === null
      ? 0
      : Math.min(4, Math.log10(signals.newsMentions + 1) * 0.7);
  const searchBoost =
    signals.searchResults === null
      ? 0
      : Math.min(2, Math.log10(signals.searchResults + 1) * 0.2);
  const youtubeSubscriberBoost =
    signals.youtubeSubscribers === null
      ? 0
      : Math.min(2, Math.log10(signals.youtubeSubscribers + 1) * 0.18);
  const youtubeViewBoost =
    signals.youtubeViews === null
      ? 0
      : Math.min(1, Math.log10(signals.youtubeViews + 1) * 0.06);

  return Number(
    (
      newsBoost +
      searchBoost +
      youtubeSubscriberBoost +
      youtubeViewBoost +
      signals.practiceTradePressure
    ).toFixed(4),
  );
}