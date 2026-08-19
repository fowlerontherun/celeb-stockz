import { sql } from "./db";

export type ProviderSettings = {
  webzApiKey: string;
  tmdbApiKey: string;
  lastfmApiKey: string;
  sportsdbApiKey: string;
  updatedAt: string | null;
};

export async function getProviderSettings(): Promise<ProviderSettings> {
  const rows = await sql`
    SELECT
      webz_api_key,
      tmdb_api_key,
      lastfm_api_key,
      sportsdb_api_key,
      updated_at
    FROM market_provider_settings
    WHERE id = true
  `;
  const settings = rows[0];

  return {
    webzApiKey: settings?.webz_api_key ?? "",
    tmdbApiKey: settings?.tmdb_api_key ?? "",
    lastfmApiKey: settings?.lastfm_api_key ?? "",
    sportsdbApiKey: settings?.sportsdb_api_key ?? "",
    updatedAt: settings?.updated_at ?? null,
  };
}