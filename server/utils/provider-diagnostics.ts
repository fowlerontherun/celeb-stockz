import { fetchSearchTrend } from "./dataforseo-trends";
import { getProviderSettings } from "./provider-settings";
import { getSystemSettings } from "./system-settings";

export const providerDiagnosticKeys = [
  "wikipedia",
  "gdelt",
  "newsdata",
  "webz",
  "youtube",
  "dataforseo",
  "tmdb",
  "lastfm",
  "sportsdb",
] as const;

export type ProviderDiagnosticKey = (typeof providerDiagnosticKeys)[number];

export type ProviderDiagnosticResult = {
  name: string;
  authRequired: boolean;
  status: "ok" | "error" | "unconfigured";
  message: string;
  sampleData?: Record<string, unknown> | null;
};

type DiagnosticContext = {
  providerSettings: Awaited<ReturnType<typeof getProviderSettings>>;
  systemSettings: Awaited<ReturnType<typeof getSystemSettings>>;
};

const USER_AGENT =
  "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function sanitizeMessage(message: string, secrets: string[]) {
  return secrets
    .filter(Boolean)
    .reduce(
      (safeMessage, secret) => safeMessage.replaceAll(secret, "[redacted]"),
      message,
    );
}

async function readJson(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const value = await response.json();
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function providerError(
  response: Response,
  payload: Record<string, unknown> | null,
  secrets: string[] = [],
) {
  const nestedError =
    payload?.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : null;
  const results = Array.isArray(payload?.results) ? payload.results : null;
  const firstResult =
    results?.[0] && typeof results[0] === "object"
      ? (results[0] as Record<string, unknown>)
      : null;
  const message =
    (typeof nestedError?.message === "string" && nestedError.message) ||
    (typeof firstResult?.message === "string" && firstResult.message) ||
    (typeof payload?.message === "string" && payload.message) ||
    `HTTP ${response.status}: ${response.statusText || "Provider request failed"}`;

  return sanitizeMessage(message, secrets);
}

async function testWikipedia(): Promise<ProviderDiagnosticResult> {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = formatDate(yesterday);
  const pageviewsUrl =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Taylor_Swift/daily/${date}/${date}`;

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const revisionsUrl = new URL("https://en.wikipedia.org/w/api.php");
  revisionsUrl.searchParams.set("action", "query");
  revisionsUrl.searchParams.set("format", "json");
  revisionsUrl.searchParams.set("formatversion", "2");
  revisionsUrl.searchParams.set("prop", "revisions");
  revisionsUrl.searchParams.set("titles", "Taylor Swift");
  revisionsUrl.searchParams.set("rvprop", "timestamp");
  revisionsUrl.searchParams.set("rvstart", new Date().toISOString());
  revisionsUrl.searchParams.set("rvend", since);
  revisionsUrl.searchParams.set("rvlimit", "35");

  try {
    const [pageviewsResponse, revisionsResponse] = await Promise.all([
      fetch(pageviewsUrl, { headers: { "user-agent": USER_AGENT } }),
      fetch(revisionsUrl, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
      }),
    ]);

    const pageviewsPayload = await readJson(pageviewsResponse);
    if (!pageviewsResponse.ok) {
      return {
        name: "Wikimedia pageviews & revisions",
        authRequired: false,
        status: "error",
        message: `Pricing pageview endpoint failed: ${providerError(
          pageviewsResponse,
          pageviewsPayload,
        )}`,
      };
    }

    const pageviewItems = Array.isArray(pageviewsPayload?.items)
      ? pageviewsPayload.items
      : [];
    const firstPageview =
      pageviewItems[0] && typeof pageviewItems[0] === "object"
        ? (pageviewItems[0] as Record<string, unknown>)
        : null;
    const views = Number(firstPageview?.views);

    const revisionsPayload = await readJson(revisionsResponse);
    const query =
      revisionsPayload?.query && typeof revisionsPayload.query === "object"
        ? (revisionsPayload.query as Record<string, unknown>)
        : null;
    const pages = Array.isArray(query?.pages) ? query.pages : [];
    const firstPage =
      pages[0] && typeof pages[0] === "object"
        ? (pages[0] as Record<string, unknown>)
        : null;
    const recentEdits = Array.isArray(firstPage?.revisions)
      ? firstPage.revisions.length
      : null;

    return {
      name: "Wikimedia pageviews & revisions",
      authRequired: false,
      status: "ok",
      message: revisionsResponse.ok
        ? "Production pageview and revision endpoints responded successfully."
        : "Production pageview endpoint is healthy; optional revision activity is currently unavailable.",
      sampleData: {
        dailyPageviews: Number.isFinite(views) ? views : null,
        recentEdits: revisionsResponse.ok ? recentEdits : null,
        revisionStatus: revisionsResponse.ok ? "ok" : "unavailable",
      },
    };
  } catch (error) {
    return {
      name: "Wikimedia pageviews & revisions",
      authRequired: false,
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function testGdelt(): Promise<ProviderDiagnosticResult> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", '"Taylor Swift"');
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
      headers: { "user-agent": USER_AGENT },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        name: "GDELT 2.0 Global News API",
        authRequired: false,
        status: "error",
        message: providerError(response, payload),
      };
    }

    const timeline = Array.isArray(payload?.timeline) ? payload.timeline : [];
    const newsVolume = timeline.reduce((total, item) => {
      if (!item || typeof item !== "object") return total;
      return total + (Number((item as Record<string, unknown>).value) || 0);
    }, 0);

    return {
      name: "GDELT 2.0 Global News API",
      authRequired: false,
      status: "ok",
      message: "Production news-volume endpoint responded successfully.",
      sampleData: { timelinePoints: timeline.length, newsVolume },
    };
  } catch (error) {
    return {
      name: "GDELT 2.0 Global News API",
      authRequired: false,
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function testNewsData(apiKey: string): Promise<ProviderDiagnosticResult> {
  if (!apiKey) {
    return {
      name: "NewsData.io (Latest News Feed)",
      authRequired: true,
      status: "unconfigured",
      message: "NewsData.io API key is not configured.",
    };
  }

  const url = new URL("https://newsdata.io/api/1/latest");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("q", '"Taylor Swift"');
  url.searchParams.set("language", "en");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok || payload?.status !== "success") {
      return {
        name: "NewsData.io (Latest News Feed)",
        authRequired: true,
        status: "error",
        message: providerError(response, payload, [apiKey]),
      };
    }

    const results = Array.isArray(payload.results) ? payload.results : [];
    return {
      name: "NewsData.io (Latest News Feed)",
      authRequired: true,
      status: "ok",
      message: "Production /latest endpoint responded successfully.",
      sampleData: {
        totalResults:
          typeof payload.totalResults === "number"
            ? payload.totalResults
            : results.length,
      },
    };
  } catch (error) {
    return {
      name: "NewsData.io (Latest News Feed)",
      authRequired: true,
      status: "error",
      message: sanitizeMessage(
        error instanceof Error ? error.message : "Connection failed",
        [apiKey],
      ),
    };
  }
}

async function testWebz(apiKey: string): Promise<ProviderDiagnosticResult> {
  if (!apiKey) {
    return {
      name: "Webz.io News API Lite",
      authRequired: true,
      status: "unconfigured",
      message: "Webz.io API token is not configured.",
    };
  }

  const url = new URL("https://api.webz.io/newsApiLite");
  url.searchParams.set("token", apiKey);
  url.searchParams.set("q", '"Taylor Swift"');

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        name: "Webz.io News API Lite",
        authRequired: true,
        status: "error",
        message: providerError(response, payload, [apiKey]),
      };
    }

    return {
      name: "Webz.io News API Lite",
      authRequired: true,
      status: "ok",
      message: "Production News API Lite endpoint responded successfully.",
      sampleData: {
        totalResults:
          typeof payload?.totalResults === "number" ? payload.totalResults : null,
      },
    };
  } catch (error) {
    return {
      name: "Webz.io News API Lite",
      authRequired: true,
      status: "error",
      message: sanitizeMessage(
        error instanceof Error ? error.message : "Connection failed",
        [apiKey],
      ),
    };
  }
}

async function testYoutube(apiKey: string): Promise<ProviderDiagnosticResult> {
  if (!apiKey) {
    return {
      name: "YouTube Data API v3",
      authRequired: true,
      status: "unconfigured",
      message: "YouTube Data API key is not configured.",
    };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("id", "UCqECaJ8Gagnn7YCbPEzWH6g");
  url.searchParams.set("part", "statistics");

  try {
    const response = await fetch(url);
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        name: "YouTube Data API v3",
        authRequired: true,
        status: "error",
        message: providerError(response, payload, [apiKey]),
      };
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    const firstItem =
      items[0] && typeof items[0] === "object"
        ? (items[0] as Record<string, unknown>)
        : null;
    const statistics =
      firstItem?.statistics && typeof firstItem.statistics === "object"
        ? (firstItem.statistics as Record<string, unknown>)
        : null;

    return {
      name: "YouTube Data API v3",
      authRequired: true,
      status: "ok",
      message: "Production channel-statistics endpoint responded successfully.",
      sampleData: {
        subscribers: statistics?.subscriberCount ?? null,
        viewCount: statistics?.viewCount ?? null,
      },
    };
  } catch (error) {
    return {
      name: "YouTube Data API v3",
      authRequired: true,
      status: "error",
      message: sanitizeMessage(
        error instanceof Error ? error.message : "Connection failed",
        [apiKey],
      ),
    };
  }
}

async function testDataForSeo(
  login: string,
  password: string,
): Promise<ProviderDiagnosticResult> {
  if (!login || !password) {
    return {
      name: "DataForSEO Google Trends",
      authRequired: true,
      status: "unconfigured",
      message:
        "DataForSEO API login/password are not configured in server environment variables.",
    };
  }

  const result = await fetchSearchTrend("Taylor Swift", login, password);
  return {
    name: "DataForSEO Google Trends",
    authRequired: true,
    status: result.status === "verified" ? "ok" : "error",
    message: result.detail,
    sampleData:
      result.status === "verified"
        ? {
            latestInterest: result.latestInterest,
            baselineInterest: result.baselineInterest,
            momentumPercent: result.momentumPercent,
            graphPoints: result.points,
            taskCostUsd: result.costUsd,
          }
        : null,
  };
}

async function testTmdb(apiKey: string): Promise<ProviderDiagnosticResult> {
  if (!apiKey) {
    return {
      name: "The Movie Database (TMDB)",
      authRequired: true,
      status: "unconfigured",
      message: "TMDB API key is not configured.",
    };
  }

  const url = new URL("https://api.themoviedb.org/3/search/person");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", "Cillian Murphy");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        name: "The Movie Database (TMDB)",
        authRequired: true,
        status: "error",
        message: providerError(response, payload, [apiKey]),
      };
    }

    const results = Array.isArray(payload?.results) ? payload.results : [];
    const match = results.find(
      (item) =>
        item &&
        typeof item === "object" &&
        String((item as Record<string, unknown>).name).toLowerCase() ===
          "cillian murphy",
    ) as Record<string, unknown> | undefined;

    return {
      name: "The Movie Database (TMDB)",
      authRequired: true,
      status: match ? "ok" : "error",
      message: match
        ? "Production person-search endpoint returned an exact match."
        : "TMDB responded but the expected exact person match was not returned.",
      sampleData: match
        ? { matchedPerson: match.name, popularityIndex: match.popularity ?? null }
        : null,
    };
  } catch (error) {
    return {
      name: "The Movie Database (TMDB)",
      authRequired: true,
      status: "error",
      message: sanitizeMessage(
        error instanceof Error ? error.message : "Connection failed",
        [apiKey],
      ),
    };
  }
}

async function testLastFm(apiKey: string): Promise<ProviderDiagnosticResult> {
  if (!apiKey) {
    return {
      name: "Last.fm Music API",
      authRequired: true,
      status: "unconfigured",
      message: "Last.fm API key is not configured.",
    };
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.getinfo");
  url.searchParams.set("artist", "Dua Lipa");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok || payload?.error) {
      return {
        name: "Last.fm Music API",
        authRequired: true,
        status: "error",
        message: providerError(response, payload, [apiKey]),
      };
    }

    const artist =
      payload?.artist && typeof payload.artist === "object"
        ? (payload.artist as Record<string, unknown>)
        : null;
    const stats =
      artist?.stats && typeof artist.stats === "object"
        ? (artist.stats as Record<string, unknown>)
        : null;

    return {
      name: "Last.fm Music API",
      authRequired: true,
      status: "ok",
      message: "Production artist.getinfo endpoint responded successfully.",
      sampleData: {
        artist: artist?.name ?? "Dua Lipa",
        listeners: stats?.listeners ?? null,
        playcount: stats?.playcount ?? null,
      },
    };
  } catch (error) {
    return {
      name: "Last.fm Music API",
      authRequired: true,
      status: "error",
      message: sanitizeMessage(
        error instanceof Error ? error.message : "Connection failed",
        [apiKey],
      ),
    };
  }
}

async function testSportsDb(apiKey: string): Promise<ProviderDiagnosticResult> {
  if (!apiKey) {
    return {
      name: "TheSportsDB API",
      authRequired: true,
      status: "unconfigured",
      message: "TheSportsDB API key is not configured.",
    };
  }

  const url = new URL(
    `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(
      apiKey,
    )}/searchplayers.php`,
  );
  url.searchParams.set("p", "Jude Bellingham");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        name: "TheSportsDB API",
        authRequired: true,
        status: "error",
        message: providerError(response, payload, [apiKey]),
      };
    }

    const players = Array.isArray(payload?.player) ? payload.player : [];
    const match = players.find(
      (item) =>
        item &&
        typeof item === "object" &&
        String((item as Record<string, unknown>).strPlayer).toLowerCase() ===
          "jude bellingham",
    ) as Record<string, unknown> | undefined;

    return {
      name: "TheSportsDB API",
      authRequired: true,
      status: match ? "ok" : "error",
      message: match
        ? "Production player-search endpoint returned an exact match."
        : "TheSportsDB responded but the expected exact player match was not returned.",
      sampleData: match
        ? { player: match.strPlayer, team: match.strTeam ?? null }
        : null,
    };
  } catch (error) {
    return {
      name: "TheSportsDB API",
      authRequired: true,
      status: "error",
      message: sanitizeMessage(
        error instanceof Error ? error.message : "Connection failed",
        [apiKey],
      ),
    };
  }
}

async function loadDiagnosticContext(): Promise<DiagnosticContext> {
  const [providerSettings, systemSettings] = await Promise.all([
    getProviderSettings(),
    getSystemSettings(),
  ]);
  return { providerSettings, systemSettings };
}

async function runWithContext(
  provider: ProviderDiagnosticKey,
  context: DiagnosticContext,
): Promise<ProviderDiagnosticResult> {
  switch (provider) {
    case "wikipedia":
      return testWikipedia();
    case "gdelt":
      return testGdelt();
    case "newsdata":
      return testNewsData(context.providerSettings.newsdataApiKey);
    case "webz":
      return testWebz(context.providerSettings.webzApiKey);
    case "youtube":
      return testYoutube(context.systemSettings.youtubeApiKey);
    case "dataforseo":
      return testDataForSeo(
        context.providerSettings.dataforseoLogin,
        context.providerSettings.dataforseoPassword,
      );
    case "tmdb":
      return testTmdb(context.providerSettings.tmdbApiKey);
    case "lastfm":
      return testLastFm(context.providerSettings.lastfmApiKey);
    case "sportsdb":
      return testSportsDb(context.providerSettings.sportsdbApiKey);
  }
}

export async function runProviderDiagnostic(provider: ProviderDiagnosticKey) {
  const context = await loadDiagnosticContext();
  return runWithContext(provider, context);
}

export async function runAllProviderDiagnostics() {
  const context = await loadDiagnosticContext();
  const entries = await Promise.all(
    providerDiagnosticKeys.map(
      async (provider) =>
        [provider, await runWithContext(provider, context)] as const,
    ),
  );

  return Object.fromEntries(entries) as Record<
    ProviderDiagnosticKey,
    ProviderDiagnosticResult
  >;
}
