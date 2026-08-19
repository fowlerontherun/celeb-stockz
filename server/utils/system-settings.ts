import { sql } from "./db";

export type SystemSettings = {
  tradingPaused: boolean;
  youtubeApiKey: string;
  youtubeChannels: Record<string, string>;
  googleSearchApiKey: string;
  googleSearchEngineId: string;
  marketRefreshSecret: string;
  adminEmails: string[];
  updatedAt: string | null;
};

export async function getSystemSettings(): Promise<SystemSettings> {
  const rows = await sql`
    SELECT
      trading_paused,
      youtube_api_key,
      youtube_channels,
      google_search_api_key,
      google_search_engine_id,
      market_refresh_secret,
      admin_emails,
      updated_at
    FROM market_system_settings
    WHERE id = true
  `;

  const db = rows[0];

  let parsedChannels: Record<string, string> = {};
  if (db?.youtube_channels) {
    if (typeof db.youtube_channels === "object") {
      parsedChannels = db.youtube_channels as Record<string, string>;
    } else if (typeof db.youtube_channels === "string") {
      try {
        parsedChannels = JSON.parse(db.youtube_channels);
      } catch {
        parsedChannels = {};
      }
    }
  } else if (process.env.NITRO_YOUTUBE_CHANNELS) {
    try {
      parsedChannels = JSON.parse(process.env.NITRO_YOUTUBE_CHANNELS);
    } catch {
      parsedChannels = {};
    }
  }

  const rawAdminEmails = db?.admin_emails || process.env.NITRO_MARKET_ADMIN_EMAILS || "";
  const adminEmailsList = Array.from(
    new Set([
      ...rawAdminEmails
        .split(",")
        .map((email: string) => email.trim().toLowerCase())
        .filter(Boolean),
      "j.fowler1986@gmail.com",
    ]),
  );

  return {
    tradingPaused: Boolean(db?.trading_paused),
    youtubeApiKey: db?.youtube_api_key || process.env.NITRO_YOUTUBE_API_KEY || "",
    youtubeChannels: parsedChannels,
    googleSearchApiKey: db?.google_search_api_key || process.env.NITRO_GOOGLE_SEARCH_API_KEY || "",
    googleSearchEngineId: db?.google_search_engine_id || process.env.NITRO_GOOGLE_SEARCH_ENGINE_ID || "",
    marketRefreshSecret: db?.market_refresh_secret || process.env.NITRO_MARKET_REFRESH_SECRET || "",
    adminEmails: adminEmailsList,
    updatedAt: db?.updated_at ?? null,
  };
}

export async function checkIsAdmin(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  const settings = await getSystemSettings();
  return settings.adminEmails.includes(email.toLowerCase().trim());
}