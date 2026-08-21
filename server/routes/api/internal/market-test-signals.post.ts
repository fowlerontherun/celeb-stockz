import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import {
  checkIsAdmin,
  getSystemSettings,
} from "../../../utils/system-settings";
import { getProviderSettings } from "../../../utils/provider-settings";
import { celebrityMarkets } from "../../../utils/markets";
import { getMarketMetadata } from "../../../utils/market-metadata";
import { getAdditionalPriceSignals } from "../../../utils/additional-price-signals";
import { fetchSearchTrend } from "../../../utils/dataforseo-trends";

type TestRequest = {
  ticker?: string;
};

type YoutubeDiagnostic = {
  subscribers: number | null;
  views: number | null;
  status: "verified" | "unavailable";
  detail: string;
};

function describeYoutubeFailure(
  hasApiKey: boolean,
  channelId: string | undefined,
) {
  if (!hasApiKey) {
    return "No YouTube Data API key is saved. Save the key in Market Control Center, then test again.";
  }
  if (!channelId) {
    return "No channel mapping is saved for this ticker. Add a YouTube channel ID beginning with UC.";
  }
  if (!channelId.startsWith("UC")) {
    return "The saved mapping is not a YouTube channel ID. Use the channel ID beginning with UC, not a URL or @handle.";
  }
  return null;
}

async function testYoutubeChannel(
  apiKey: string,
  rawChannelId: string | undefined,
): Promise<YoutubeDiagnostic> {
  const channelId = rawChannelId?.trim();
  const configurationIssue = describeYoutubeFailure(Boolean(apiKey), channelId);
  if (configurationIssue) {
    return {
      subscribers: null,
      views: null,
      status: "unavailable",
      detail: configurationIssue,
    };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", channelId!);
  url.searchParams.set("part", "statistics");

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return {
        subscribers: null,
        views: null,
        status: "unavailable",
        detail:
          payload?.error?.message?.replaceAll(apiKey, "[redacted]").trim() ||
          `YouTube Data API returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json()) as {
      items?: Array<{
        statistics?: { subscriberCount?: string; viewCount?: string };
      }>;
    };
    const statistics = payload.items?.[0]?.statistics;
    const subscribers = Number(statistics?.subscriberCount);
    const views = Number(statistics?.viewCount);
    if (
      !Number.isSafeInteger(subscribers) ||
      subscribers < 0 ||
      !Number.isSafeInteger(views) ||
      views < 0
    ) {
      return {
        subscribers: null,
        views: null,
        status: "unavailable",
        detail:
          "YouTube accepted the request but returned no usable public statistics for this channel.",
      };
    }

    return {
      subscribers,
      views,
      status: "verified",
      detail: `YouTube returned public statistics for channel ${channelId}.`,
    };
  } catch {
    return {
      subscribers: null,
      views: null,
      status: "unavailable",
      detail: "The server could not reach the YouTube Data API.",
    };
  }
}

async function testWikipediaPageviews(article: string) {
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = yesterday.toISOString().slice(0, 10).replaceAll("-", "");
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
      article,
    )}/daily/${date}/${date}`;
    const response = await fetch(url, {
      headers: { "user-agent": "CelebStockz test-signal diagnostic" },
    });
    if (!response.ok) {
      return { value: null, status: "unavailable" as const };
    }
    const data = (await response.json()) as {
      items?: Array<{ views?: number }>;
    };
    const value = data.items?.[0]?.views ?? null;
    return {
      value,
      status: value !== null ? ("verified" as const) : ("unavailable" as const),
    };
  } catch {
    return { value: null, status: "unavailable" as const };
  }
}

async function testWikipediaEdits(article: string) {
  try {
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
      headers: {
        accept: "application/json",
        "user-agent": "CelebStockz test-signal diagnostic",
      },
    });
    if (!response.ok) {
      return { value: null, status: "unavailable" as const };
    }
    const data = (await response.json()) as {
      query?: { pages?: Array<{ revisions?: Array<{ timestamp?: string }> }> };
    };
    return {
      value: data.query?.pages?.[0]?.revisions?.length ?? 0,
      status: "verified" as const,
    };
  } catch {
    return { value: null, status: "unavailable" as const };
  }
}

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const body = await readBody<TestRequest>(event);
  const ticker = body?.ticker?.trim().toUpperCase();
  const market = celebrityMarkets.find((item) => item.ticker === ticker);
  if (!market) {
    throw createError({
      statusCode: 404,
      statusMessage: "Celebrity market not found.",
    });
  }

  const metadata = getMarketMetadata(market);
  const [systemSettings, providerSettings] = await Promise.all([
    getSystemSettings(),
    getProviderSettings(),
  ]);

  const [wikiViews, wikiEdits, additional, searchDiagnostic, youtubeDiagnostic] =
    await Promise.all([
      testWikipediaPageviews(metadata.wikipediaTitle),
      testWikipediaEdits(metadata.wikipediaTitle),
      getAdditionalPriceSignals(market),
      fetchSearchTrend(
        market.name,
        providerSettings.dataforseoLogin,
        providerSettings.dataforseoPassword,
      ),
      testYoutubeChannel(
        systemSettings.youtubeApiKey,
        systemSettings.youtubeChannels[market.ticker],
      ),
    ]);

  return {
    ticker: market.ticker,
    name: market.name,
    wikipediaTitle: metadata.wikipediaTitle,
    channelMapped: Boolean(systemSettings.youtubeChannels[market.ticker]?.trim()),
    channelId: systemSettings.youtubeChannels[market.ticker]?.trim() ?? null,
    youtubeConfiguration: {
      apiKeySaved: Boolean(systemSettings.youtubeApiKey),
      mappingSaved: Boolean(systemSettings.youtubeChannels[market.ticker]?.trim()),
      channelId: systemSettings.youtubeChannels[market.ticker]?.trim() ?? null,
    },
    diagnostics: {
      wikipedia: {
        dailyPageviews: wikiViews.value,
        status: wikiViews.status,
        recentRevisions7d: wikiEdits.value,
        revisionsStatus: wikiEdits.status,
      },
      news: {
        mentions7d: additional.newsMentions,
        status: additional.statuses.news,
      },
      search: {
        provider: "DataForSEO Google Trends",
        // Compatibility field for the existing admin card. It now represents
        // normalized Google Trends interest (0-100), not a web result count.
        resultsCount: searchDiagnostic.latestInterest,
        latestInterest: searchDiagnostic.latestInterest,
        baselineInterest: searchDiagnostic.baselineInterest,
        momentumPercent: searchDiagnostic.momentumPercent,
        graphPoints: searchDiagnostic.points,
        status: searchDiagnostic.status,
        detail:
          searchDiagnostic.status === "verified"
            ? `${searchDiagnostic.detail} Momentum: ${
                searchDiagnostic.momentumPercent ?? 0
              }% versus its recent baseline.`
            : searchDiagnostic.detail,
      },
      youtube: youtubeDiagnostic,
      trades: {
        pressure: additional.practiceTradePressure,
        status: additional.statuses.trades,
      },
    },
  };
});
