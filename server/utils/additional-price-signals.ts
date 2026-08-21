import { sql } from "./db";
import { celebrityMarkets, type CelebrityMarket } from "./markets";
import { getSystemSettings } from "./system-settings";
import { getProviderSettings } from "./provider-settings";
import { fetchSearchTrends } from "./dataforseo-trends";
import {
  getLatestSignalObservation,
  recordSignalObservation,
  type SignalObservation,
} from "./signal-observations";

type SignalStatus = "verified" | "unavailable";

export type AdditionalPriceSignals = {
  newsMentions: number | null;
  /** @deprecated Compatibility alias. This is normalized search interest (0-100), not a result count. */
  searchResults: number | null;
  searchInterest: number | null;
  searchMomentumPercent: number | null;
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

type SearchMomentumResult = {
  interest: number | null;
  baselineInterest: number | null;
  momentumPercent: number | null;
  status: SignalStatus;
};

export type SearchMomentumRefreshSummary = {
  configured: boolean;
  selectedCount: number;
  requestedCount: number;
  verifiedCount: number;
  unavailableCount: number;
};

const CACHE_MS = 10 * 60 * 1000;
const SEARCH_PROVIDER = "dataforseo-trends";
const SEARCH_METRIC = "web-interest-30d";
const SEARCH_FRESH_MS = 20 * 60 * 60 * 1000;
const SEARCH_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_BATCH_SIZE = 5;
const SEARCH_REQUEST_CONCURRENCY = 20;
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

function getDailyTrendMarketLimit() {
  const configured = Number(
    process.env.NITRO_DATAFORSEO_DAILY_MARKET_LIMIT ?? 300,
  );
  if (!Number.isSafeInteger(configured) || configured < 1) return 300;
  return Math.min(1000, configured);
}

function getSelectedDailyTrendMarkets() {
  const date = currentUtcDate();
  return [...celebrityMarkets]
    .sort(
      (first, second) =>
        stableHash(`${date}:${first.ticker}`) -
        stableHash(`${date}:${second.ticker}`),
    )
    .slice(0, getDailyTrendMarketLimit());
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function observationAgeMs(observation: SignalObservation) {
  const timestamp = new Date(observation.capturedAt).getTime();
  return Number.isFinite(timestamp)
    ? Date.now() - timestamp
    : Number.POSITIVE_INFINITY;
}

function metadataNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = Number(metadata[key]);
  return Number.isFinite(value) ? value : null;
}

function fromStoredSearchObservation(
  observation: SignalObservation,
): SearchMomentumResult | null {
  if (observation.status !== "verified" || observation.value === null) return null;

  return {
    interest: observation.value,
    baselineInterest: metadataNumber(observation.metadata, "baselineInterest"),
    momentumPercent: metadataNumber(observation.metadata, "momentumPercent"),
    status: "verified",
  };
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
        "user-agent":
          "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)",
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

async function getSearchMomentum(
  ticker: string,
  configured: boolean,
): Promise<SearchMomentumResult> {
  if (!configured) {
    return {
      interest: null,
      baselineInterest: null,
      momentumPercent: null,
      status: "unavailable",
    };
  }

  const latestObservation = await getLatestSignalObservation(
    ticker,
    SEARCH_PROVIDER,
    SEARCH_METRIC,
  );
  if (!latestObservation || observationAgeMs(latestObservation) > SEARCH_MAX_STALE_MS) {
    return {
      interest: null,
      baselineInterest: null,
      momentumPercent: null,
      status: "unavailable",
    };
  }

  return (
    fromStoredSearchObservation(latestObservation) ?? {
      interest: null,
      baselineInterest: null,
      momentumPercent: null,
      status: "unavailable",
    }
  );
}

export async function refreshSearchMomentumObservations(): Promise<SearchMomentumRefreshSummary> {
  const settings = await getProviderSettings();
  const configured = Boolean(
    settings.dataforseoLogin && settings.dataforseoPassword,
  );
  const selected = getSelectedDailyTrendMarkets();

  if (!configured) {
    return {
      configured: false,
      selectedCount: selected.length,
      requestedCount: 0,
      verifiedCount: 0,
      unavailableCount: selected.length,
    };
  }

  const freshness = await Promise.all(
    selected.map(async (market) => ({
      market,
      observation: await getLatestSignalObservation(
        market.ticker,
        SEARCH_PROVIDER,
        SEARCH_METRIC,
      ),
    })),
  );
  const staleMarkets = freshness
    .filter(
      ({ observation }) =>
        !observation || observationAgeMs(observation) > SEARCH_FRESH_MS,
    )
    .map(({ market }) => market);

  let verifiedCount = 0;
  let unavailableCount = 0;
  const batches = chunk(staleMarkets, SEARCH_BATCH_SIZE);
  const waves = chunk(batches, SEARCH_REQUEST_CONCURRENCY);

  for (const wave of waves) {
    await Promise.all(
      wave.map(async (batch) => {
        const results = await fetchSearchTrends(
          batch.map((market) => market.name),
          settings.dataforseoLogin,
          settings.dataforseoPassword,
        );

        await Promise.all(
          batch.map(async (market) => {
            const result = results.get(market.name);
            if (
              !result ||
              result.status !== "verified" ||
              result.latestInterest === null ||
              result.momentumPercent === null
            ) {
              unavailableCount += 1;
              return;
            }

            const persisted = await recordSignalObservation({
              ticker: market.ticker,
              provider: SEARCH_PROVIDER,
              metric: SEARCH_METRIC,
              value: result.latestInterest,
              status: "verified",
              metadata: {
                baselineInterest: result.baselineInterest,
                momentumPercent: result.momentumPercent,
                points: result.points,
                costUsd: result.costUsd,
              },
            });

            if (persisted) verifiedCount += 1;
            else unavailableCount += 1;
          }),
        );
      }),
    );
  }

  if (verifiedCount > 0) cache.clear();

  return {
    configured: true,
    selectedCount: selected.length,
    requestedCount: staleMarkets.length,
    verifiedCount,
    unavailableCount,
  };
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

  const [systemSettings, providerSettings] = await Promise.all([
    getSystemSettings(),
    getProviderSettings(),
  ]);
  const searchConfigured = Boolean(
    providerSettings.dataforseoLogin && providerSettings.dataforseoPassword,
  );

  const [news, search, youtube, practiceTradePressure] = await Promise.all([
    getNewsMentions(market.name),
    getSearchMomentum(market.ticker, searchConfigured),
    getYoutubeStatistics(
      market.ticker,
      systemSettings.youtubeApiKey,
      systemSettings.youtubeChannels,
    ),
    getPracticeTradePressure(market.ticker),
  ]);

  const value: AdditionalPriceSignals = {
    newsMentions: news.value,
    searchResults: search.interest,
    searchInterest: search.interest,
    searchMomentumPercent: search.momentumPercent,
    youtubeSubscribers: youtube.subscribers,
    youtubeViews: youtube.views,
    practiceTradePressure,
    statuses: {
      news: news.status,
      search: search.status,
      youtube: youtube.status,
      trades: "verified",
    },
  };

  cache.set(market.ticker, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}

export function getAdditionalSignalBoost(signals: AdditionalPriceSignals) {
  const newsBoost =
    signals.newsMentions === null
      ? 0
      : Math.min(9, Math.log10(signals.newsMentions + 1) * 1.5);

  // Search is now a momentum signal instead of an absolute lifetime/index count.
  // Cooling interest can reduce the score; sharp upward interest is capped so a
  // single source cannot dominate the celebrity price.
  const searchBoost =
    signals.searchMomentumPercent === null
      ? 0
      : Math.max(-4, Math.min(6, signals.searchMomentumPercent / 25));

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
