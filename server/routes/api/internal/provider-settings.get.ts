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

  const [settings, systemSettings] = await Promise.all([
    getProviderSettings(),
    getSystemSettings(),
  ]);

  return {
    providers: {
      newsdata: Boolean(settings.newsdataApiKey),
      webz: Boolean(settings.webzApiKey),
      tmdb: Boolean(settings.tmdbApiKey),
      lastfm: Boolean(settings.lastfmApiKey),
      sportsdb: Boolean(settings.sportsdbApiKey),
      gdelt: true,
      wikipedia: true,
      youtube: Boolean(systemSettings.youtubeApiKey),
      googleSearch: Boolean(systemSettings.googleSearchApiKey && systemSettings.googleSearchEngineId),
    },
    updatedAt: settings.updatedAt,
  };
});