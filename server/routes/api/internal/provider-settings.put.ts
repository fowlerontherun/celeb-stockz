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
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const values = [
    body?.webzApiKey,
    body?.tmdbApiKey,
    body?.lastfmApiKey,
    body?.sportsdbApiKey,
  ];

  if (values.some((value) => value !== undefined && value.length > 500)) {
    throw createError({ statusCode: 400, statusMessage: "Provider keys must be 500 characters or fewer." });
  }

  await sql`
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
      webz_api_key = EXCLUDED.webz_api_key,
      tmdb_api_key = EXCLUDED.tmdb_api_key,
      lastfm_api_key = EXCLUDED.lastfm_api_key,
      sportsdb_api_key = EXCLUDED.sportsdb_api_key,
      updated_at = now()
  `;

  return { ok: true };
});