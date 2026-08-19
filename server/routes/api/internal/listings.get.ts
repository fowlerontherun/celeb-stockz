import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { celebrityMarkets } from "../../../utils/markets";
import { checkIsAdmin, getSystemSettings } from "../../../utils/system-settings";
import { sql } from "../../../utils/db";

type ListingSetting = {
  ticker: string;
  trading_paused: boolean;
  website_url: string | null;
  official_youtube_url: string | null;
  updated_at: string;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const [settings, systemSettings] = await Promise.all([
    sql<ListingSetting[]>`
      SELECT
        ticker,
        trading_paused,
        website_url,
        official_youtube_url,
        updated_at
      FROM market_listing_settings
    `,
    getSystemSettings(),
  ]);
  const settingsByTicker = new Map(
    settings.map((setting) => [setting.ticker, setting]),
  );

  return {
    listings: celebrityMarkets.map((market) => {
      const setting = settingsByTicker.get(market.ticker);

      return {
        ticker: market.ticker,
        name: market.name,
        category: market.category,
        tradingPaused: setting?.trading_paused ?? false,
        websiteUrl: setting?.website_url ?? "",
        officialYoutubeUrl: setting?.official_youtube_url ?? "",
        youtubeChannelId: systemSettings.youtubeChannels[market.ticker] ?? "",
        updatedAt: setting?.updated_at ?? null,
      };
    }),
  };
});