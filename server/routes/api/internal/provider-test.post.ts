import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin, getSystemSettings } from "../../../utils/system-settings";
import { getProviderSettings } from "../../../utils/provider-settings";

type ProviderTestInput = {
  provider: "wikipedia" | "gdelt" | "youtube" | "googleSearch" | "tmdb" | "lastfm" | "sportsdb" | "webz";
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const body = await readBody<ProviderTestInput>(event);
  const provider = body?.provider;

  const [providerSettings, systemSettings] = await Promise.all([
    getProviderSettings(),
    getSystemSettings(),
  ]);

  if (provider === "wikipedia") {
    try {
      const res = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/Taylor_Swift", {
        headers: { "user-agent": "CelebStockz/1.0 (https://celebstockz.app; contact@celebstockz.app)" },
      });
      return { ok: res.ok, status: res.status, message: res.ok ? "Wikimedia API responded successfully (No API key needed)." : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "gdelt") {
    try {
      const url = "https://api.gdeltproject.org/api/v2/doc/doc?query=%22Taylor%20Swift%22&mode=timelinevolraw&format=json&maxrecords=5";
      const res = await fetch(url, {
        headers: { "user-agent": "CelebStockz/1.0" },
      });
      return { ok: res.ok, status: res.status, message: res.ok ? "GDELT News API responded successfully (Open public API)." : `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "youtube") {
    const key = systemSettings.youtubeApiKey;
    if (!key) return { ok: false, message: "YouTube Data API Key is not configured in System Settings." };
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?key=${key}&id=UCqECaJ8Gagnn7YCbPEzWH6g&part=statistics`);
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.error?.message || `HTTP ${res.status}` };
      }
      return { ok: true, message: `YouTube API verified. Sample channel: ${data.items?.[0]?.statistics?.subscriberCount ?? "OK"} subscribers.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "googleSearch") {
    const key = systemSettings.googleSearchApiKey;
    const cx = systemSettings.googleSearchEngineId;
    if (!key || !cx) return { ok: false, message: "Google Custom Search API Key or Search Engine ID (cx) is missing." };
    try {
      const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=Taylor+Swift`);
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.error?.message || `HTTP ${res.status}` };
      }
      return { ok: true, message: `Google Custom Search verified. Found ${data.searchInformation?.totalResults ?? "0"} results.` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "tmdb") {
    const key = providerSettings.tmdbApiKey;
    if (!key) return { ok: false, message: "TMDB API Key is not configured." };
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${key}&query=Cillian+Murphy`);
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.status_message || `HTTP ${res.status}` };
      }
      return { ok: true, message: `TMDB verified. Matched person popularity: ${data.results?.[0]?.popularity ?? "N/A"}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "lastfm") {
    const key = providerSettings.lastfmApiKey;
    if (!key) return { ok: false, message: "Last.fm API Key is not configured." };
    try {
      const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=Dua+Lipa&api_key=${key}&format=json`);
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, message: data.message || `HTTP ${res.status}` };
      }
      return { ok: true, message: `Last.fm verified. Artist listeners: ${data.artist?.stats?.listeners ?? "N/A"}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "sportsdb") {
    const key = providerSettings.sportsdbApiKey;
    if (!key) return { ok: false, message: "TheSportsDB API Key is not configured." };
    try {
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${key}/searchplayers.php?p=Jude+Bellingham`);
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: `HTTP ${res.status}` };
      }
      return { ok: true, message: `TheSportsDB verified. Player match: ${data.player?.[0]?.strPlayer ?? "Found"}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  if (provider === "webz") {
    const key = providerSettings.webzApiKey;
    if (!key) return { ok: false, message: "Webz.io API Token is not configured." };
    try {
      const res = await fetch(`https://api.webz.io/newsApiLite?token=${key}&q="Taylor Swift"`);
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, message: data.message || `HTTP ${res.status}` };
      }
      return { ok: true, message: `Webz.io verified. Total results: ${data.totalResults ?? "N/A"}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  throw createError({ statusCode: 400, statusMessage: "Invalid provider specified." });
});