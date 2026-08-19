import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";

type ProviderInput = {
  webzApiKey?: string;
  tmdbApiKey?: string;
  lastfmApiKey?: string;
  sportsdbApiKey?: string;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  const body = await readBody<ProviderInput>(event);

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const fields = [
    body?.webzApiKey,
    body?.tmdbApiKey,
    body?.lastfmApiKey,
    body?.sportsdbApiKey,
  ];

  if (
    fields.some(
      (value) => value !== undefined && value.trim().length > 500,
    )
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provider keys must be 500 characters or fewer.",
    });
  }

  const updated = await sql`
    INSERT INTO market_provider_settings (
      id, webz_api_key, tmdb_api_key, lastfm_api_key, sportsdb_api_key, updated_at
    )
    VALUES (
      true,
      ${body?.webzApiKey?.trim() ?? ""},
      ${body?.tmdbApiKey?.trim() ?? ""},
      ${body?.lastfmApiKey?.trim() ?? ""},
      ${body?.sportsdbApiKey?.trim() ?? ""},
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      webz_api_key = CASE
        WHEN ${body?.webzApiKey?.trim() ?? ""} = '' THEN market_provider_settings.webz_api_key
        ELSE EXCLUDED.webz_api_key
      END,
      tmdb_api_key = CASE
        WHEN ${body?.tmdbApiKey?.trim() ?? ""} = '' THEN market_provider_settings.tmdb_api_key
        ELSE EXCLUDED.tmdb_api_key
      END,
      lastfm_api_key = CASE
        WHEN ${body?.lastfmApiKey?.trim() ?? ""} = '' THEN market_provider_settings.lastfm_api_key
        ELSE EXCLUDED.lastfm_api_key
      END,
      sportsdb_api_key = CASE
        WHEN ${body?.sportsdbApiKey?.trim() ?? ""} = '' THEN market_provider_settings.sportsdb_api_key
        ELSE EXCLUDED.sportsdb_api_key
      END,
      updated_at = now()
  `;

  return { ok: Boolean(updated) };
});