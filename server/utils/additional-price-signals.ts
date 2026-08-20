import { sql } from "./db";
import { celebrityMarkets, type CelebrityMarket } from "./markets";
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

export type SearchDiagnostic = {
  status: SignalStatus;
  detail: string;
  resultsCount: number | null;
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

type SearchCacheRow = {
  result_count: string | null;
  status: "verified" | "unavailable" | "pending";
  detail: string | null;
};

const CACHE_MS = 10 * 60 * 1000;
const SEARCH_DAILY_MARKET_LIMIT = 15;
const SEARCH_DAILY_REQUEST_CAP = 100;
const cache = new Map<string, CacheEntry>();
let tradePressureCache:
  | { values: Map<string, number>; expiresAt: number }
  | undefined;

export function clearAdditionalSignalCache() {
  cache.clear();
  tradePressureCache = undefined;
}

function currentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function stableHash(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}

function isSelectedForDailySearch(ticker: string) {
  const date = currentUtcDate();
  const selected = [...celebrityMarkets]
    .sort(
      (first, second) =>
        stableHash(`${date}:${first.ticker}`) -
        stableHash(`${date}:${second.ticker}`),
    )
    .slice(0, SEARCH_DAILY_MARKET_LIMIT)
    .some((market) => market.ticker === ticker);

  return selected;
}

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
        "user-agent": "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)",
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

async function reserveGoogleSearchRequest(date: string) {
  const usage = await sql`
    INSERT INTO google_search_daily_usage (usage_date, request_count, updated_at)
    VALUES (${date}, 1, now())
    ON CONFLICT (usage_date) DO UPDATE
    SET request_count = google_search_daily_usage.request_count + 1,
        updated_at = now()
    WHERE google_search_daily_usage.request_count < ${SEARCH_DAILY_REQUEST_CAP}
    RETURNING request_count
  `;

  return Boolean(usage[0]);
}

async function getSearchResults(
  name: string,
  ticker: string,
  apiKey: string,
  cx: string,
) {
  if (!apiKey || !cx) {
    return {
      value: null,
      status: "unavailable" as const,
    };
  }

  if (!isSelectedForDailySearch(ticker)) {
    return {
      value: null,
      status: "unavailable" as const,
    };
  }

  const date = currentUtcDate();
  const existing = await sql<SearchCacheRow[]>`
    SELECT result_count, status, detail
    FROM google_search_signal_cache
    WHERE ticker = ${ticker} AND captured_on = ${date}
  `;

  if (existing[0]?.status === "verified") {
    return {
      value: Number(existing[0].result_count),
      status: "verified" as const,
    };
  }

  if (existing[0]) {
    return {
      value: null,
      status: "unavailable" as const,
    };
  }

  const reservation = await sql`
    INSERT INTO google_search_signal_cache (
      ticker, captured_on, result_count, status, detail, updated_at
    )
    VALUES (${ticker}, ${date}, null, 'pending', null, now())
    ON CONFLICT (ticker, captured_on) DO NOTHING
    RETURNING ticker
  `;

  if (!reservation[0]) {
    return {
      value: null,
      status: "unavailable" as const,
    };
  }

  const hasQuota = await reserveGoogleSearchRequest(date);
  if (!hasQuota) {
    await sql`
      UPDATE google_search_signal_cache
      SET status = 'unavailable',
          detail = 'Daily Google Search request budget reached.',
          updated_at = now()
      WHERE ticker = ${ticker} AND captured_on = ${date}
    `;

    return {
      value: null,
      status: "unavailable" as const,
    };
  }

  const diagnostic = await testGoogleSearch(name, apiKey, cx);

  await sql`
    UPDATE google_search_signal_cache
    SET
      result_count = ${diagnostic.resultsCount},
      status = ${diagnostic.status},
      detail = ${diagnostic.detail},
      updated_at = now()
    WHERE ticker = ${ticker} AND captured_on = ${date}
  `;

  return {
    value: diagnostic.resultsCount,
    status: diagnostic.status,
  };
}

export async function testGoogleSearch(
  name: string,
  apiKey: string,
  cx: string,
): Promise<SearchDiagnostic> {
  if (!apiKey) {
    return {
      status: "unavailable",
      resultsCount: null,
      detail: "Google Custom Search API key is not configured.",
    };
  }

  if (!cx) {
    return {
      status: "unavailable",
      resultsCount: null,
      detail: "Google Programmable Search Engine ID is not configured.",
    };
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", name);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const message = data?.error?.message?.replaceAll(apiKey, "").trim();

      return {
        status: "unavailable",
        resultsCount: null,
        detail:
          message ||
          `Google Custom Search returned HTTP ${response.status}. Check API enablement, key restrictions, search engine ID, and quota.`,
      };
    }

    const data = (await response.json()) as {
      searchInformation?: { totalResults?: string };
    };
    const value = Number(data.searchInformation?.totalResults);

    if (!Number.isSafeInteger(value) || value < 0) {
      return {
        status: "unavailable",
        resultsCount: null,
        detail: "Google returned an invalid search-result count.",
      };
    }

    return {
      status: "verified",
      resultsCount: value,
      detail: "Google Custom Search responded successfully.",
    };
  } catch {
    return {
      status: "unavailable",
      resultsCount: null,
      detail: "The Google Custom Search request could not reach Google.",
    };
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
      const volumeStrength = Math.min(1, Math.log10(grossVolume + 1) / 3);
      // Increased order pressure impact from 2.5 to 6.5 STKZ
      const pressure = Number((imbalance * volumeStrength * 6.5).toFixed(4));

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
    getSearchResults(
      market.name,
      market.ticker,
      settings.googleSearchApiKey,
      settings.googleSearchEngineId,
    ),
    getYoutubeStatistics(
      market.ticker,
      settings.youtubeApiKey,
      settings.youtubeChannels,
    ),
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
  // Enhanced boost weights for higher real-time market impact
  const newsBoost =
    signals.newsMentions === null
      ? 0
      : Math.min(9, Math.log10(signals.newsMentions + 1) * 1.5);
  const searchBoost =
    signals.searchResults === null
      ? 0
      : Math.min(5, Math.log10(signals.searchResults + 1) * 0.45);
  const youtubeSubscriberBoost =
    signals.youtubeSubscribers === null
      ? 0
      : Math.min(4, Math.log10(signals.youtubeSubscribers + 1) * 0.35);
  const youtubeViewBoost =
    signals.youtubeViews === null
      ? 0
      : Math.min(2.5, Math.log10(signals.youtubeViews + 1) * 0.12);

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