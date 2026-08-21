import { sql } from "./db";

export type ProviderSettings = {
  webzApiKey: string;
  tmdbApiKey: string;
  lastfmApiKey: string;
  sportsdbApiKey: string;
  newsdataApiKey: string;
  dataforseoLogin: string;
  dataforseoPassword: string;
  updatedAt: string | null;
};

function resolveCredential(
  databaseValue: unknown,
  environmentVariable: string,
) {
  const stored = typeof databaseValue === "string" ? databaseValue.trim() : "";
  if (stored) return stored;

  return process.env[environmentVariable]?.trim() ?? "";
}

export async function getProviderSettings(): Promise<ProviderSettings> {
  const rows = await sql`
    SELECT
      webz_api_key,
      tmdb_api_key,
      lastfm_api_key,
      sportsdb_api_key,
      newsdata_api_key,
      updated_at
    FROM market_provider_settings
    WHERE id = true
  `;
  const settings = rows[0];

  return {
    webzApiKey: resolveCredential(settings?.webz_api_key, "NITRO_WEBZ_API_KEY"),
    tmdbApiKey: resolveCredential(settings?.tmdb_api_key, "NITRO_TMDB_API_KEY"),
    lastfmApiKey: resolveCredential(settings?.lastfm_api_key, "NITRO_LASTFM_API_KEY"),
    sportsdbApiKey: resolveCredential(settings?.sportsdb_api_key, "NITRO_SPORTSDB_API_KEY"),
    newsdataApiKey: resolveCredential(settings?.newsdata_api_key, "NITRO_NEWSDATA_API_KEY"),
    dataforseoLogin: process.env.NITRO_DATAFORSEO_LOGIN?.trim() ?? "",
    dataforseoPassword: process.env.NITRO_DATAFORSEO_PASSWORD?.trim() ?? "",
    updatedAt: settings?.updated_at ?? null,
  };
}
