import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin, getSystemSettings } from "../../../utils/system-settings";
import { getProviderSettings } from "../../../utils/provider-settings";

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const [providerSettings, systemSettings] = await Promise.all([
    getProviderSettings(),
    getSystemSettings(),
  ]);

  const results: Record<string, {
    name: string;
    authRequired: boolean;
    status: "ok" | "error" | "unconfigured";
    message: string;
    sampleData?: Record<string, unknown> | null;
  }> = {};

  // 1. NewsData.io (Latest Endpoint)
  const newsdataKey = providerSettings.newsdataApiKey;
  if (!newsdataKey) {
    results.newsdata = {
      name: "NewsData.io (Latest News Feed)",
      authRequired: true,
      status: "unconfigured",
      message: "NewsData API key is not configured.",
    };
  } else {
    try {
      const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${newsdataKey}&q="Taylor Swift"&language=en`);
      const data = await res.json();
      if (res.ok && data.status === "success") {
        results.newsdata = {
          name: "NewsData.io (Latest News Feed)",
          authRequired: true,
          status: "ok",
          message: "NewsData.io verified via /latest endpoint.",
          sampleData: {
            totalResults: data.totalResults ?? data.results?.length ?? 0,
            latestHeadline: data.results?.[0]?.title ?? "N/A",
            sourceId: data.results?.[0]?.source_id ?? "N/A",
          },
        };
      } else {
        results.newsdata = {
          name: "NewsData.io (Latest News Feed)",
          authRequired: true,
          status: "error",
          message: data.results?.message || data.message || `HTTP ${res.status}`,
        };
      }
    } catch (e) {
      results.newsdata = {
        name: "NewsData.io (Latest News Feed)",
        authRequired: true,
        status: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  // 2. Wikimedia Foundation API
  try {
    const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/Taylor_Swift", {
      headers: { "user-agent": "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)" },
    });
    if (res.ok) {
      const data = await res.json();
      results.wikipedia = {
        name: "Wikimedia REST API (Pageviews & Bio)",
        authRequired: false,
        status: "ok",
        message: "Successfully connected. Verified public biography and media endpoints.",
        sampleData: {
          title: data.title,
          description: data.description,
          hasThumbnail: Boolean(data.thumbnail?.source),
        },
      };
    } else {
      results.wikipedia = {
        name: "Wikimedia REST API",
        authRequired: false,
        status: "error",
        message: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
  } catch (e) {
    results.wikipedia = {
      name: "Wikimedia REST API",
      authRequired: false,
      status: "error",
      message: e instanceof Error ? e.message : "Connection failed",
    };
  }

  // 3. GDELT Project 2.0
  try {
    const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=%22Taylor%20Swift%22&mode=timelinevolraw&format=json&maxrecords=5";
    const res = await fetch(url, {
      headers: { "user-agent": "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)" },
    });
    if (res.ok) {
      const data = await res.json();
      const totalVolume = data.timeline?.reduce((acc: number, pt: { value?: number }) => acc + (Number(pt.value) || 0), 0) ?? 0;
      results.gdelt = {
        name: "GDELT 2.0 Global News API",
        authRequired: false,
        status: "ok",
        message: "Successfully received live worldwide news volume telemetry.",
        sampleData: {
          timelinePoints: data.timeline?.length ?? 0,
          sampleNewsVolume: totalVolume,
        },
      };
    } else {
      results.gdelt = {
        name: "GDELT 2.0 News API",
        authRequired: false,
        status: "error",
        message: `HTTP ${res.status}: ${res.statusText}`,
      };
    }
  } catch (e) {
    results.gdelt = {
      name: "GDELT 2.0 News API",
      authRequired: false,
      status: "error",
      message: e instanceof Error ? e.message : "Connection failed",
    };
  }

  // 4. YouTube Data API
  const youtubeKey = systemSettings.youtubeApiKey;
  if (!youtubeKey) {
    results.youtube = {
      name: "YouTube Data API v3",
      authRequired: true,
      status: "unconfigured",
      message: "No API key configured in System Settings. Fallback modeled statistics are active.",
    };
  } else {
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${youtubeKey}&id=UCqECaJ8Gagnn7YCbPEzWH6g&part=statistics`);
      const data = await res.json();
      if (res.ok) {
        results.youtube = {
          name: "YouTube Data API v3",
          authRequired: true,
          status: "ok",
          message: "API key verified. Creator metrics returning live statistics.",
          sampleData: {
            subscribers: data.items?.[0]?.statistics?.subscriberCount ?? "N/A",
            viewCount: data.items?.[0]?.statistics?.viewCount ?? "N/A",
          },
        };
      } else {
        results.youtube = {
          name: "YouTube Data API v3",
          authRequired: true,
          status: "error",
          message: data.error?.message || `HTTP ${res.status}`,
        };
      }
    } catch (e) {
      results.youtube = {
        name: "YouTube Data API v3",
        authRequired: true,
        status: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  // 5. Google Custom Search
  const googleKey = systemSettings.googleSearchApiKey;
  const googleCx = systemSettings.googleSearchEngineId;
  if (!googleKey || !googleCx) {
    results.googleSearch = {
      name: "Google Programmable Search",
      authRequired: true,
      status: "unconfigured",
      message: "Google Search API key or Search Engine ID (cx) is not yet set.",
    };
  } else {
    try {
      const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=Taylor+Swift`);
      const data = await res.json();
      if (res.ok) {
        results.googleSearch = {
          name: "Google Programmable Search",
          authRequired: true,
          status: "ok",
          message: "Google Custom Search verified and returning indexed results.",
          sampleData: {
            totalResults: data.searchInformation?.totalResults ?? "0",
            searchTime: `${data.searchInformation?.searchTime ?? 0}s`,
          },
        };
      } else {
        results.googleSearch = {
          name: "Google Programmable Search",
          authRequired: true,
          status: "error",
          message: data.error?.message || `HTTP ${res.status}`,
        };
      }
    } catch (e) {
      results.googleSearch = {
        name: "Google Programmable Search",
        authRequired: true,
        status: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  // 6. TMDB API
  const tmdbKey = providerSettings.tmdbApiKey;
  if (!tmdbKey) {
    results.tmdb = {
      name: "The Movie Database (TMDB)",
      authRequired: true,
      status: "unconfigured",
      message: "TMDB API key is not configured. Screen categories use base modeled popularity.",
    };
  } else {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${tmdbKey}&query=Cillian+Murphy`);
      const data = await res.json();
      if (res.ok) {
        results.tmdb = {
          name: "The Movie Database (TMDB)",
          authRequired: true,
          status: "ok",
          message: "TMDB API key verified.",
          sampleData: {
            matchedPerson: data.results?.[0]?.name ?? "None",
            popularityIndex: data.results?.[0]?.popularity ?? 0,
          },
        };
      } else {
        results.tmdb = {
          name: "The Movie Database (TMDB)",
          authRequired: true,
          status: "error",
          message: data.status_message || `HTTP ${res.status}`,
        };
      }
    } catch (e) {
      results.tmdb = {
        name: "The Movie Database (TMDB)",
        authRequired: true,
        status: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  // 7. Last.fm API
  const lastfmKey = providerSettings.lastfmApiKey;
  if (!lastfmKey) {
    results.lastfm = {
      name: "Last.fm Music API",
      authRequired: true,
      status: "unconfigured",
      message: "Last.fm API key is not configured. Music categories use base listener reach.",
    };
  } else {
    try {
      const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=Dua+Lipa&api_key=${lastfmKey}&format=json`);
      const data = await res.json();
      if (res.ok && !data.error) {
        results.lastfm = {
          name: "Last.fm Music API",
          authRequired: true,
          status: "ok",
          message: "Last.fm API key verified.",
          sampleData: {
            artist: data.artist?.name ?? "Dua Lipa",
            listeners: data.artist?.stats?.listeners ?? "N/A",
            playcount: data.artist?.stats?.playcount ?? "N/A",
          },
        };
      } else {
        results.lastfm = {
          name: "Last.fm Music API",
          authRequired: true,
          status: "error",
          message: data.message || `HTTP ${res.status}`,
        };
      }
    } catch (e) {
      results.lastfm = {
        name: "Last.fm Music API",
        authRequired: true,
        status: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  // 8. TheSportsDB
  const sportsdbKey = providerSettings.sportsdbApiKey;
  if (!sportsdbKey) {
    results.sportsdb = {
      name: "TheSportsDB API",
      authRequired: true,
      status: "unconfigured",
      message: "TheSportsDB API key is not configured. Athletes use standard sports baselines.",
    };
  } else {
    try {
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${sportsdbKey}/searchplayers.php?p=Jude+Bellingham`);
      const data = await res.json();
      if (res.ok) {
        results.sportsdb = {
          name: "TheSportsDB API",
          authRequired: true,
          status: "ok",
          message: "TheSportsDB API verified.",
          sampleData: {
            player: data.player?.[0]?.strPlayer ?? "Found",
            team: data.player?.[0]?.strTeam ?? "N/A",
          },
        };
      } else {
        results.sportsdb = {
          name: "TheSportsDB API",
          authRequired: true,
          status: "error",
          message: `HTTP ${res.status}`,
        };
      }
    } catch (e) {
      results.sportsdb = {
        name: "TheSportsDB API",
        authRequired: true,
        status: "error",
        message: e instanceof Error ? e.message : "Connection failed",
      };
    }
  }

  return { results, timestamp: new Date().toISOString() };
});