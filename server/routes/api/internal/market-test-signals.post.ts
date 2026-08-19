import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import {
  checkIsAdmin,
  getSystemSettings,
} from "../../../utils/system-settings";
import { celebrityMarkets } from "../../../utils/markets";
import { getMarketMetadata } from "../../../utils/market-metadata";
import {
  getAdditionalPriceSignals,
  testGoogleSearch,
} from "../../../utils/additional-price-signals";

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
    return "No channel mapping is saved for this ticker. Add a mapping such as \"KSI\": \"UCVtFOytbRpEvzLjvqGG5gxQ\" and save it.";
  }

  if (!channelId.startsWith("UC")) {
    return "The saved mapping is not a YouTube channel ID. Use the channel ID beginning with UC, not a youtube.com URL or @handle.";
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
      const upstreamMessage = payload?.error?.message
        ?.replaceAll(apiKey, "[redacted]")
        .trim();

      return {
        subscribers: null,
        views: null,
        status: "unavailable",
        detail:
          upstreamMessage ||
          `YouTube Data API returned HTTP ${response.status}. Check API enablement, key restrictions, billing, and quota.`,
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
          "YouTube accepted the request but returned no public statistics for this channel. Confirm the channel ID and that its subscriber count is public.",
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
      detail:
        "The server could not reach the YouTube Data API. Check network access and try again.",
    };
  }
}

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  const isAdmin = await checkIsAdmin(session?.user.email);
  if (!session?.user || !isAdmin) {
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
  const settings = await getSystemSettings();

  let wikiViews: number | null = null;
  let wikiViewsStatus: "verified" | "unavailable" = "unavailable";
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = yesterday.toISOString().slice(0, 10).replaceAll("-", "");
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
      metadata.wikipediaTitle,
    )}/daily/${date}/${date}`;

    const response = await fetch(url, {
      headers: { "user-agent": "CelebStockz test-signal diagnostic" },
    });
    if (response.ok) {
      const data = (await response.json()) as {
        items?: Array<{ views?: number }>;
      };
      wikiViews = data.items?.[0]?.views ?? null;
      wikiViewsStatus = wikiViews !== null ? "verified" : "unavailable";
    }
  } catch {
    wikiViewsStatus = "unavailable";
  }

  let wikiEdits: number | null = null;
  let wikiEditsStatus: "verified" | "unavailable" = "unavailable";
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("formatversion", "2");
    url.searchParams.set("prop", "revisions");
    url.searchParams.set("titles", metadata.wikipediaTitle);
    url.searchParams.set("rvprop", "timestamp");
    url.searchParams.set("rvstart", new Date().toISOString());
    url.searchParams.set("rvend", since);
    url.searchParams.set("rvlimit", "25");

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "CelebStockz test-signal diagnostic",
      },
    });
    if (response.ok) {
      const data = (await response.json()) as {
        query?: {
          pages?: Array<{ revisions?: Array<{ timestamp?: string }> }>;
        };
      };
      wikiEdits = (data.query?.pages?.[0]?.revisions ?? []).filter(
        (revision) => {
          const timestamp = revision.timestamp
            ? new Date(revision.timestamp)
            : null;
          return (
            timestamp &&
            Number.isFinite(timestamp.getTime()) &&
            timestamp >= new Date(since)
          );
        },
      ).length;
      wikiEditsStatus = "verified";
    }
  } catch {
    wikiEditsStatus = "unavailable";
  }

  const [additional, searchDiagnostic, youtubeDiagnostic] = await Promise.all([
    getAdditionalPriceSignals(market),
    testGoogleSearch(
      market.name,
      settings.googleSearchApiKey,
      settings.googleSearchEngineId,
    ),
    testYoutubeChannel(
      settings.youtubeApiKey,
      settings.youtubeChannels[market.ticker],
    ),
  ]);

  return {
    ticker: market.ticker,
    name: market.name,
    wikipediaTitle: metadata.wikipediaTitle,
    youtubeConfiguration: {
      apiKeySaved: Boolean(settings.youtubeApiKey),
      mappingSaved: Boolean(settings.youtubeChannels[market.ticker]?.trim()),
      channelId: settings.youtubeChannels[market.ticker]?.trim() ?? null,
    },
    channelMapped: Boolean(settings.youtubeChannels[market.ticker]?.trim()),
    channelId: settings.youtubeChannels[market.ticker]?.trim() ?? null,
    diagnostics: {
      wikipedia: {
        dailyPageviews: wikiViews,
        status: wikiViewsStatus,
        recentRevisions7d: wikiEdits,
        revisionsStatus: wikiEditsStatus,
      },
      news: {
        mentions7d: additional.newsMentions,
        status: additional.statuses.news,
      },
      search: {
        resultsCount: searchDiagnostic.resultsCount,
        status: searchDiagnostic.status,
        detail: searchDiagnostic.detail,
      },
      youtube: youtubeDiagnostic,
      trades: {
        pressure: additional.practiceTradePressure,
        status: additional.statuses.trades,
      },
    },
  };
});