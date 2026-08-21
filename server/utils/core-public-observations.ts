import { celebrityMarkets, type CelebrityMarket } from "./markets";
import { getMarketMetadata, isEligibleMarket } from "./market-metadata";
import {
  getLatestSignalObservation,
  recordSignalObservation,
  type SignalObservation,
} from "./signal-observations";
import { getStoredMomentumSignal } from "./signal-momentum";

export type CoreSignalStatus = "verified" | "unavailable";

export type CorePublicSignal = {
  value: number | null;
  anchorValue: number | null;
  momentumPercent: number | null;
  status: CoreSignalStatus;
};

export type WikipediaSignals = {
  pageviews: CorePublicSignal;
  revisions: CorePublicSignal;
};

export type GdeltSignal = CorePublicSignal;

export type CorePublicRefreshSummary = {
  pageviews: { requestedCount: number; verifiedCount: number; unavailableCount: number };
  revisions: { requestedCount: number; verifiedCount: number; unavailableCount: number };
  gdelt: { requestedCount: number; verifiedCount: number; unavailableCount: number };
};

const WIKIMEDIA_PROVIDER = "wikimedia";
const PAGEVIEW_METRIC = "daily-pageviews";
const REVISION_METRIC = "edits-7d";
const GDELT_PROVIDER = "gdelt";
const GDELT_METRIC = "news-volume-7d";
const PAGEVIEW_FRESH_MS = 20 * 60 * 60 * 1000;
const REVISION_FRESH_MS = 55 * 60 * 1000;
const GDELT_FRESH_MS = 55 * 60 * 1000;
const PAGEVIEW_MAX_STALE_MS = 3 * 24 * 60 * 60 * 1000;
const REVISION_MAX_STALE_MS = 2 * 24 * 60 * 60 * 1000;
const GDELT_MAX_STALE_MS = 2 * 24 * 60 * 60 * 1000;
const REQUEST_CONCURRENCY = 12;
const USER_AGENT =
  "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)";

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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function formatGdeltDate(date: Date) {
  return date
    .toISOString()
    .replaceAll(/[-:.TZ]/g, "")
    .slice(0, 14);
}

async function fetchWikipediaPageviews(article: string) {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = formatDate(yesterday);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${date}/${date}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const data = (await response.json()) as { items?: Array<{ views?: number }> };
  const views = Number(data.items?.[0]?.views);
  return Number.isSafeInteger(views) && views >= 0 && views <= 1_000_000_000
    ? views
    : null;
}

async function fetchWikipediaRevisions(article: string) {
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "revisions");
  url.searchParams.set("titles", article);
  url.searchParams.set("rvprop", "timestamp");
  url.searchParams.set("rvstart", new Date().toISOString());
  url.searchParams.set("rvend", since);
  url.searchParams.set("rvlimit", "35");

  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    query?: { pages?: Array<{ revisions?: Array<{ timestamp?: string }> }> };
  };
  return (data.query?.pages?.[0]?.revisions ?? []).length;
}

async function fetchGdeltVolume(name: string) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", `"${name}"`);
  url.searchParams.set("mode", "timelinevolraw");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "250");
  url.searchParams.set(
    "startdatetime",
    formatGdeltDate(new Date(Date.now() - 7 * 86400000)),
  );

  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const data = (await response.json()) as { timeline?: Array<{ value?: number }> };
  const value = data.timeline?.reduce(
    (total, point) => total + (Number(point.value) || 0),
    0,
  );
  return Number.isFinite(value) && value !== undefined && value >= 0 ? value : null;
}

async function collectMetric(input: {
  market: CelebrityMarket;
  provider: string;
  metric: string;
  freshnessMs: number;
  fetchValue: () => Promise<number | null>;
  metadata?: Record<string, unknown>;
}) {
  const latest = await getLatestSignalObservation(
    input.market.ticker,
    input.provider,
    input.metric,
  );
  if (latest && observationAgeMs(latest) <= input.freshnessMs) {
    return "fresh" as const;
  }

  try {
    const value = await input.fetchValue();
    const verified = value !== null && Number.isFinite(value) && value >= 0;
    await recordSignalObservation({
      ticker: input.market.ticker,
      provider: input.provider,
      metric: input.metric,
      value: verified ? value : null,
      status: verified ? "verified" : "unavailable",
      metadata: input.metadata,
    });
    return verified ? ("verified" as const) : ("unavailable" as const);
  } catch {
    await recordSignalObservation({
      ticker: input.market.ticker,
      provider: input.provider,
      metric: input.metric,
      value: null,
      status: "unavailable",
      metadata: input.metadata,
    });
    return "unavailable" as const;
  }
}

export async function refreshCorePublicObservations(): Promise<CorePublicRefreshSummary> {
  const markets = celebrityMarkets.filter(isEligibleMarket);
  const summary: CorePublicRefreshSummary = {
    pageviews: { requestedCount: 0, verifiedCount: 0, unavailableCount: 0 },
    revisions: { requestedCount: 0, verifiedCount: 0, unavailableCount: 0 },
    gdelt: { requestedCount: 0, verifiedCount: 0, unavailableCount: 0 },
  };

  for (const wave of chunk(markets, REQUEST_CONCURRENCY)) {
    await Promise.all(
      wave.map(async (market) => {
        const metadata = getMarketMetadata(market);
        const [pageviews, revisions, gdelt] = await Promise.all([
          collectMetric({
            market,
            provider: WIKIMEDIA_PROVIDER,
            metric: PAGEVIEW_METRIC,
            freshnessMs: PAGEVIEW_FRESH_MS,
            fetchValue: () => fetchWikipediaPageviews(metadata.wikipediaTitle),
            metadata: { article: metadata.wikipediaTitle },
          }),
          collectMetric({
            market,
            provider: WIKIMEDIA_PROVIDER,
            metric: REVISION_METRIC,
            freshnessMs: REVISION_FRESH_MS,
            fetchValue: () => fetchWikipediaRevisions(metadata.wikipediaTitle),
            metadata: { article: metadata.wikipediaTitle, windowDays: 7 },
          }),
          collectMetric({
            market,
            provider: GDELT_PROVIDER,
            metric: GDELT_METRIC,
            freshnessMs: GDELT_FRESH_MS,
            fetchValue: () => fetchGdeltVolume(market.name),
            metadata: { windowDays: 7 },
          }),
        ]);

        for (const [key, result] of [
          ["pageviews", pageviews],
          ["revisions", revisions],
          ["gdelt", gdelt],
        ] as const) {
          if (result === "fresh") continue;
          summary[key].requestedCount += 1;
          if (result === "verified") summary[key].verifiedCount += 1;
          else summary[key].unavailableCount += 1;
        }
      }),
    );
  }

  return summary;
}

function unavailable(): CorePublicSignal {
  return {
    value: null,
    anchorValue: null,
    momentumPercent: null,
    status: "unavailable",
  };
}

export async function getStoredWikipediaSignals(
  market: CelebrityMarket,
): Promise<WikipediaSignals> {
  const [pageviews, revisions] = await Promise.all([
    getStoredMomentumSignal({
      ticker: market.ticker,
      provider: WIKIMEDIA_PROVIDER,
      metric: PAGEVIEW_METRIC,
      maxAgeMs: PAGEVIEW_MAX_STALE_MS,
      mode: "level",
    }),
    getStoredMomentumSignal({
      ticker: market.ticker,
      provider: WIKIMEDIA_PROVIDER,
      metric: REVISION_METRIC,
      maxAgeMs: REVISION_MAX_STALE_MS,
      mode: "level",
    }),
  ]);

  return {
    pageviews:
      pageviews.status === "verified"
        ? {
            value: pageviews.value,
            anchorValue: pageviews.anchorValue,
            momentumPercent: pageviews.momentumPercent,
            status: "verified",
          }
        : unavailable(),
    revisions:
      revisions.status === "verified"
        ? {
            value: revisions.value,
            anchorValue: revisions.anchorValue,
            momentumPercent: revisions.momentumPercent,
            status: "verified",
          }
        : unavailable(),
  };
}

export async function getStoredGdeltSignal(
  market: CelebrityMarket,
): Promise<GdeltSignal> {
  const signal = await getStoredMomentumSignal({
    ticker: market.ticker,
    provider: GDELT_PROVIDER,
    metric: GDELT_METRIC,
    maxAgeMs: GDELT_MAX_STALE_MS,
    mode: "level",
  });

  return signal.status === "verified"
    ? {
        value: signal.value,
        anchorValue: signal.anchorValue,
        momentumPercent: signal.momentumPercent,
        status: "verified",
      }
    : unavailable();
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

export function getWikipediaSignalBoost(signals: WikipediaSignals) {
  const pageviewAnchor =
    signals.pageviews.anchorValue && signals.pageviews.anchorValue > 0
      ? Math.min(
          32,
          Math.log10(Math.max(signals.pageviews.anchorValue, 1)) * 4.8,
        )
      : 0;
  const revisionAnchor =
    signals.revisions.anchorValue && signals.revisions.anchorValue > 0
      ? Math.min(
          8,
          Math.sqrt(Math.min(signals.revisions.anchorValue, 35)) * 1.4,
        )
      : 0;
  const pageviewMomentum = boundedMomentumBoost(
    signals.pageviews.momentumPercent,
    22,
    -4,
    6,
  );
  const revisionMomentum = boundedMomentumBoost(
    signals.revisions.momentumPercent,
    40,
    -1.5,
    2.5,
  );

  return Number(
    (pageviewAnchor + revisionAnchor + pageviewMomentum + revisionMomentum).toFixed(4),
  );
}
