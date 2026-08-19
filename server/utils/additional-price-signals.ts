import type { CelebrityMarket } from "./markets";

type SignalStatus = "verified" | "unavailable";

export type AdditionalPriceSignals = {
  newsMentions: number | null;
  searchResults: number | null;
  youtubeSubscribers: number | null;
  statuses: {
    news: SignalStatus;
    search: SignalStatus;
    youtube: SignalStatus;
  };
};

type CacheEntry = {
  value: AdditionalPriceSignals;
  expiresAt: number;
};

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const googleApiKey = process.env.NITRO_GOOGLE_SEARCH_API_KEY;
const googleSearchEngineId = process.env.NITRO_GOOGLE_SEARCH_ENGINE_ID;
const youtubeApiKey = process.env.NITRO_YOUTUBE_API_KEY;

function getChannelMap() {
  try {
    return JSON.parse(
      process.env.NITRO_YOUTUBE_CHANNELS ?? "{}",
    ) as Record<string, string>;
  } catch {
    console.error("NITRO_YOUTUBE_CHANNELS must contain valid JSON.");
    return {};
  }
}

async function getNewsMentions(name: string) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `"${name}"`);
  url.searchParams.set("mode", "timelinevolraw");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "250");
  url.searchParams.set("startdatetime", new Date(Date.now() - 7 * 86400000).toISOString().replaceAll(/[-:.TZ]/g, "").slice(0, 14));

  try {
    const response = await fetch(url, {
      headers: { "user-agent": "CelebStockz practice-market signal monitor" },
    });

    if (!response.ok) return { value: null, status: "unavailable" as const };

    const data = (await response.json()) as {
      timeline?: Array<{ value?: number }>;
    };
    const value = data.timeline?.reduce(
      (total, point) => total + (Number(point.value) || 0),
      0,
    );

    return {
      value: Number.isFinite(value) ? value ?? 0 : null,
      status: Number.isFinite(value) ? ("verified" as const) : ("unavailable" as const),
    };
  } catch {
    return { value: null, status: "unavailable" as const };
  }
}

async function getSearchResults(name: string) {
  if (!googleApiKey || !googleSearchEngineId) {
    return { value: null, status: "unavailable" as const };
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", googleApiKey);
  url.searchParams.set("cx", googleSearchEngineId);
  url.searchParams.set("q", name);

  try {
    const response = await fetch(url);
    if (!response.ok) return { value: null, status: "unavailable" as const };

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

async function getYoutubeSubscribers(ticker: string) {
  const channelId = getChannelMap()[ticker];

  if (!youtubeApiKey || !channelId) {
    return { value: null, status: "unavailable" as const };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("key", youtubeApiKey);
  url.searchParams.set("id", channelId);
  url.searchParams.set("part", "statistics");

  try {
    const response = await fetch(url);
    if (!response.ok) return { value: null, status: "unavailable" as const };

    const data = (await response.json()) as {
      items?: Array<{ statistics?: { subscriberCount?: string } }>;
    };
    const value = Number(data.items?.[0]?.statistics?.subscriberCount);

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

export async function getAdditionalPriceSignals(
  market: CelebrityMarket,
): Promise<AdditionalPriceSignals> {
  const cached = cache.get(market.ticker);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const [news, search, youtube] = await Promise.all([
    getNewsMentions(market.name),
    getSearchResults(market.name),
    getYoutubeSubscribers(market.ticker),
  ]);

  const value = {
    newsMentions: news.value,
    searchResults: search.value,
    youtubeSubscribers: youtube.value,
    statuses: {
      news: news.status,
      search: search.status,
      youtube: youtube.status,
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
  const youtubeBoost =
    signals.youtubeSubscribers === null
      ? 0
      : Math.min(2, Math.log10(signals.youtubeSubscribers + 1) * 0.18);

  return Number((newsBoost + searchBoost + youtubeBoost).toFixed(4));
}