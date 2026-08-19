import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin, getSystemSettings } from "../../../utils/system-settings";
import { celebrityMarkets } from "../../../utils/markets";
import { getMarketMetadata } from "../../../utils/market-metadata";
import { getAdditionalPriceSignals } from "../../../utils/additional-price-signals";

type TestRequest = {
  ticker?: string;
};

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

  // Test Wikipedia views
  let wikiViews: number | null = null;
  let wikiViewsStatus: "verified" | "unavailable" = "unavailable";
  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const date = yesterday.toISOString().slice(0, 10).replaceAll("-", "");
    const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
      metadata.wikipediaTitle,
    )}/daily/${date}/${date}`;

    const res = await fetch(url, {
      headers: { "user-agent": "CelebStockz test-signal diagnostic" },
    });
    if (res.ok) {
      const data = (await res.json()) as { items?: Array<{ views?: number }> };
      wikiViews = data.items?.[0]?.views ?? null;
      wikiViewsStatus = wikiViews !== null ? "verified" : "unavailable";
    }
  } catch {
    wikiViewsStatus = "unavailable";
  }

  // Test Wikipedia edit activity
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

    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "CelebStockz test-signal diagnostic",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as {
        query?: { pages?: Array<{ revisions?: Array<{ timestamp?: string }> }> };
      };
      wikiEdits = (data.query?.pages?.[0]?.revisions ?? []).filter((rev) => {
        const timestamp = rev.timestamp ? new Date(rev.timestamp) : null;
        return timestamp && Number.isFinite(timestamp.getTime()) && timestamp >= new Date(since);
      }).length;
      wikiEditsStatus = "verified";
    }
  } catch {
    wikiEditsStatus = "unavailable";
  }

  // Test additional signals (GDELT, Custom Search, YouTube API, and Practice Trades)
  const additional = await getAdditionalPriceSignals(market);

  return {
    ticker: market.ticker,
    name: market.name,
    wikipediaTitle: metadata.wikipediaTitle,
    channelMapped: Boolean(settings.youtubeChannels[market.ticker]),
    channelId: settings.youtubeChannels[market.ticker] ?? null,
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
        resultsCount: additional.searchResults,
        status: additional.statuses.search,
      },
      youtube: {
        subscribers: additional.youtubeSubscribers,
        views: additional.youtubeViews,
        status: additional.statuses.youtube,
      },
      trades: {
        pressure: additional.practiceTradePressure,
        status: additional.statuses.trades,
      },
    },
  };
});