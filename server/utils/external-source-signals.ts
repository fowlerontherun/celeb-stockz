import { celebrityMarkets, type CelebrityMarket } from "./markets";
import { getProviderSettings } from "./provider-settings";
import {
  getLatestSignalObservation,
  recordSignalObservation,
  type SignalObservation,
} from "./signal-observations";
import {
  combineMomentum,
  getStoredMomentumSignal,
} from "./signal-momentum";

type ProviderName = "webz" | "tmdb" | "lastfm" | "sportsdb" | "newsdata";
type SignalStatus = "verified" | "unavailable";

export type ExternalSourceSignals = {
  webzNews: number | null;
  webzMomentumPercent: number | null;
  tmdbPopularity: number | null;
  tmdbMomentumPercent: number | null;
  lastfmListeners: number | null;
  lastfmPlaycount: number | null;
  lastfmMomentumPercent: number | null;
  sportsdbMatch: boolean | null;
  newsdataArticles: number | null;
  newsdataMomentumPercent: number | null;
  statuses: Record<ProviderName, SignalStatus>;
};

export type ExternalProviderRefreshSummary = Record<
  ProviderName,
  {
    configured: boolean;
    selectedCount: number;
    requestedCount: number;
    verifiedCount: number;
    unavailableCount: number;
  }
>;

const DAILY_MARKET_LIMIT = 25;
const PROVIDER_FRESH_MS = 20 * 60 * 60 * 1000;
const PROVIDER_MAX_STALE_MS = 21 * 24 * 60 * 60 * 1000;
const REQUEST_CONCURRENCY = 10;

const providerMetrics: Record<ProviderName, string> = {
  webz: "news-results",
  tmdb: "person-popularity",
  lastfm: "listeners",
  sportsdb: "identity-match",
  newsdata: "latest-articles",
};

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function stableHash(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
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

function supportsProvider(provider: ProviderName, market: CelebrityMarket) {
  return !(
    (provider === "tmdb" && !["Film", "TV"].includes(market.category)) ||
    (provider === "lastfm" && market.category !== "Music") ||
    (provider === "sportsdb" && market.category !== "Sport")
  );
}

function selectedMarkets(provider: ProviderName) {
  return celebrityMarkets
    .filter((market) => supportsProvider(provider, market))
    .sort(
      (first, second) =>
        stableHash(`${currentDate()}:${provider}:${first.ticker}`) -
        stableHash(`${currentDate()}:${provider}:${second.ticker}`),
    )
    .slice(0, DAILY_MARKET_LIMIT);
}

function isConfigured(
  provider: ProviderName,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
) {
  switch (provider) {
    case "webz":
      return Boolean(settings.webzApiKey);
    case "tmdb":
      return Boolean(settings.tmdbApiKey);
    case "lastfm":
      return Boolean(settings.lastfmApiKey);
    case "sportsdb":
      return Boolean(settings.sportsdbApiKey);
    case "newsdata":
      return Boolean(settings.newsdataApiKey);
  }
}

async function webzNews(name: string, apiKey: string) {
  const url = new URL("https://api.webz.io/newsApiLite");
  url.searchParams.set("token", apiKey);
  url.searchParams.set("q", `"${name}"`);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const value = Number(
    ((await response.json()) as { totalResults?: number }).totalResults,
  );
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function newsdataLatest(name: string, apiKey: string) {
  const url = new URL("https://newsdata.io/api/1/latest");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("q", `"${name}"`);
  url.searchParams.set("language", "en");

  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    status?: string;
    totalResults?: number;
    results?: unknown[];
  };
  if (data.status !== "success") return null;

  const value =
    typeof data.totalResults === "number"
      ? data.totalResults
      : Array.isArray(data.results)
        ? data.results.length
        : null;
  return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
}

async function tmdbPopularity(name: string, apiKey: string) {
  const url = new URL("https://api.themoviedb.org/3/search/person");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", name);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    results?: Array<{ name?: string; popularity?: number }>;
  };
  const match = data.results?.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase(),
  );
  const value = Number(match?.popularity);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function lastfmStats(name: string, apiKey: string) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.getinfo");
  url.searchParams.set("artist", name);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const stats = (
    (await response.json()) as {
      artist?: { stats?: { listeners?: string; playcount?: string } };
    }
  ).artist?.stats;
  const listeners = Number(stats?.listeners);
  const playcount = Number(stats?.playcount);
  if (!Number.isFinite(listeners) && !Number.isFinite(playcount)) return null;
  return {
    listeners: Number.isFinite(listeners) && listeners >= 0 ? listeners : null,
    playcount: Number.isFinite(playcount) && playcount >= 0 ? playcount : null,
  };
}

async function sportsdbMatch(name: string, apiKey: string) {
  const url = new URL(
    `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchplayers.php`,
  );
  url.searchParams.set("p", name);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    player?: Array<{ strPlayer?: string; strTeam?: string }>;
  };
  const match = data.player?.find(
    (player) => player.strPlayer?.toLowerCase() === name.toLowerCase(),
  );
  return match ? { value: 1, team: match.strTeam ?? null } : null;
}

async function recordUnavailable(
  market: CelebrityMarket,
  provider: ProviderName,
  metric = providerMetrics[provider],
) {
  return recordSignalObservation({
    ticker: market.ticker,
    provider,
    metric,
    value: null,
    status: "unavailable",
    metadata: { reason: "Provider returned no usable signal" },
  });
}

async function refreshProviderMarket(
  provider: ProviderName,
  market: CelebrityMarket,
  settings: Awaited<ReturnType<typeof getProviderSettings>>,
) {
  try {
    if (provider === "webz") {
      const value = await webzNews(market.name, settings.webzApiKey);
      if (value === null) {
        await recordUnavailable(market, provider);
        return false;
      }
      return recordSignalObservation({
        ticker: market.ticker,
        provider,
        metric: providerMetrics.webz,
        value,
        status: "verified",
      });
    }

    if (provider === "newsdata") {
      const value = await newsdataLatest(market.name, settings.newsdataApiKey);
      if (value === null) {
        await recordUnavailable(market, provider);
        return false;
      }
      return recordSignalObservation({
        ticker: market.ticker,
        provider,
        metric: providerMetrics.newsdata,
        value,
        status: "verified",
      });
    }

    if (provider === "tmdb") {
      const value = await tmdbPopularity(market.name, settings.tmdbApiKey);
      if (value === null) {
        await recordUnavailable(market, provider);
        return false;
      }
      return recordSignalObservation({
        ticker: market.ticker,
        provider,
        metric: providerMetrics.tmdb,
        value,
        status: "verified",
      });
    }

    if (provider === "lastfm") {
      const stats = await lastfmStats(market.name, settings.lastfmApiKey);
      if (!stats) {
        await Promise.all([
          recordUnavailable(market, provider, "listeners"),
          recordUnavailable(market, provider, "playcount"),
        ]);
        return false;
      }
      const results = await Promise.all([
        recordSignalObservation({
          ticker: market.ticker,
          provider,
          metric: "listeners",
          value: stats.listeners,
          status: stats.listeners === null ? "unavailable" : "verified",
        }),
        recordSignalObservation({
          ticker: market.ticker,
          provider,
          metric: "playcount",
          value: stats.playcount,
          status: stats.playcount === null ? "unavailable" : "verified",
        }),
      ]);
      return results.some(Boolean) && (stats.listeners !== null || stats.playcount !== null);
    }

    const match = await sportsdbMatch(market.name, settings.sportsdbApiKey);
    if (!match) {
      await recordUnavailable(market, provider);
      return false;
    }
    return recordSignalObservation({
      ticker: market.ticker,
      provider,
      metric: providerMetrics.sportsdb,
      value: match.value,
      status: "verified",
      metadata: {
        team: match.team,
        priceEligible: false,
        reason: "Identity confirmation only; not a hype metric",
      },
    });
  } catch {
    await recordUnavailable(market, provider);
    return false;
  }
}

export async function refreshExternalProviderObservations(): Promise<ExternalProviderRefreshSummary> {
  const settings = await getProviderSettings();
  const providers: ProviderName[] = [
    "newsdata",
    "webz",
    "tmdb",
    "lastfm",
    "sportsdb",
  ];
  const summary = {} as ExternalProviderRefreshSummary;

  for (const provider of providers) {
    const selected = selectedMarkets(provider);
    const configured = isConfigured(provider, settings);
    if (!configured) {
      summary[provider] = {
        configured: false,
        selectedCount: selected.length,
        requestedCount: 0,
        verifiedCount: 0,
        unavailableCount: selected.length,
      };
      continue;
    }

    const freshness = await Promise.all(
      selected.map(async (market) => ({
        market,
        observation: await getLatestSignalObservation(
          market.ticker,
          provider,
          providerMetrics[provider],
        ),
      })),
    );
    const stale = freshness
      .filter(
        ({ observation }) =>
          !observation || observationAgeMs(observation) > PROVIDER_FRESH_MS,
      )
      .map(({ market }) => market);

    let verifiedCount = 0;
    let unavailableCount = 0;
    for (const wave of chunk(stale, REQUEST_CONCURRENCY)) {
      const results = await Promise.all(
        wave.map((market) => refreshProviderMarket(provider, market, settings)),
      );
      for (const result of results) {
        if (result) verifiedCount += 1;
        else unavailableCount += 1;
      }
    }

    summary[provider] = {
      configured: true,
      selectedCount: selected.length,
      requestedCount: stale.length,
      verifiedCount,
      unavailableCount,
    };
  }

  return summary;
}

async function readStoredProviderSignal(
  market: CelebrityMarket,
  provider: ProviderName,
  configured: boolean,
  metric: string,
  mode: "level" | "counter-velocity",
) {
  if (!configured || !supportsProvider(provider, market)) {
    return {
      value: null,
      momentumPercent: null,
      status: "unavailable" as const,
    };
  }
  return getStoredMomentumSignal({
    ticker: market.ticker,
    provider,
    metric,
    maxAgeMs: PROVIDER_MAX_STALE_MS,
    mode,
  });
}

export async function getExternalSourceSignals(
  market: CelebrityMarket,
): Promise<ExternalSourceSignals> {
  const settings = await getProviderSettings();
  const [webz, newsdata, tmdb, listeners, playcount, sportsObservation] =
    await Promise.all([
      readStoredProviderSignal(
        market,
        "webz",
        Boolean(settings.webzApiKey),
        providerMetrics.webz,
        "level",
      ),
      readStoredProviderSignal(
        market,
        "newsdata",
        Boolean(settings.newsdataApiKey),
        providerMetrics.newsdata,
        "level",
      ),
      readStoredProviderSignal(
        market,
        "tmdb",
        Boolean(settings.tmdbApiKey),
        providerMetrics.tmdb,
        "level",
      ),
      readStoredProviderSignal(
        market,
        "lastfm",
        Boolean(settings.lastfmApiKey),
        "listeners",
        "counter-velocity",
      ),
      readStoredProviderSignal(
        market,
        "lastfm",
        Boolean(settings.lastfmApiKey),
        "playcount",
        "counter-velocity",
      ),
      settings.sportsdbApiKey && supportsProvider("sportsdb", market)
        ? getLatestSignalObservation(
            market.ticker,
            "sportsdb",
            providerMetrics.sportsdb,
          )
        : Promise.resolve(null),
    ]);

  const sportsValid = Boolean(
    sportsObservation &&
      sportsObservation.status === "verified" &&
      sportsObservation.value === 1 &&
      observationAgeMs(sportsObservation) <= PROVIDER_MAX_STALE_MS,
  );
  const lastfmStatus =
    listeners.status === "verified" || playcount.status === "verified"
      ? ("verified" as const)
      : ("unavailable" as const);
  const lastfmMomentumPercent = combineMomentum([
    { value: listeners.momentumPercent, weight: 0.35 },
    { value: playcount.momentumPercent, weight: 0.65 },
  ]);

  return {
    webzNews: webz.value,
    webzMomentumPercent: webz.momentumPercent,
    tmdbPopularity: tmdb.value,
    tmdbMomentumPercent: tmdb.momentumPercent,
    lastfmListeners: listeners.value,
    lastfmPlaycount: playcount.value,
    lastfmMomentumPercent,
    sportsdbMatch: sportsValid ? true : null,
    newsdataArticles: newsdata.value,
    newsdataMomentumPercent: newsdata.momentumPercent,
    statuses: {
      webz: webz.status,
      tmdb: tmdb.status,
      lastfm: lastfmStatus,
      sportsdb: sportsValid ? "verified" : "unavailable",
      newsdata: newsdata.status,
    },
  };
}

function boundedMomentumBoost(
  momentumPercent: number | null,
  divisor: number,
  minimum: number,
  maximum: number,
) {
  if (momentumPercent === null) return 0;
  return Math.max(minimum, Math.min(maximum, momentumPercent / divisor));
}

export function getExternalSignalBoost(signals: ExternalSourceSignals) {
  const newsMomentum = combineMomentum([
    { value: signals.newsdataMomentumPercent },
    { value: signals.webzMomentumPercent },
  ]);
  const news = boundedMomentumBoost(newsMomentum, 30, -2.5, 3.5);
  const screen = boundedMomentumBoost(
    signals.tmdbMomentumPercent,
    35,
    -1.5,
    2.5,
  );
  const music = boundedMomentumBoost(
    signals.lastfmMomentumPercent,
    30,
    -1.5,
    2.5,
  );

  // TheSportsDB currently validates identity/team matching only. It is stored for
  // diagnostics and future sports adapters but deliberately contributes no price.
  return Number((news + screen + music).toFixed(4));
}
