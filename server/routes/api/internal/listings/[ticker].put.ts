import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
  readBody,
} from "nitro/h3";
import { sql } from "../../../../utils/db";
import { getSessionFromCookie } from "../../../../utils/session";
import { celebrityMarkets } from "../../../../utils/markets";
import { checkIsAdmin, getSystemSettings } from "../../../../utils/system-settings";
import { clearAdditionalSignalCache } from "../../../../utils/additional-price-signals";

type ListingUpdate = {
  tradingPaused?: boolean;
  websiteUrl?: string;
  officialYoutubeUrl?: string;
  youtubeChannelId?: string;
};

function validUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  const ticker = getRouterParam(event, "ticker")?.toUpperCase();
  const body = await readBody<ListingUpdate>(event);

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  if (!ticker || !celebrityMarkets.some((market) => market.ticker === ticker)) {
    throw createError({ statusCode: 404, statusMessage: "Listing not found." });
  }

  const websiteUrl = body?.websiteUrl?.trim() ?? "";
  const officialYoutubeUrl = body?.officialYoutubeUrl?.trim() ?? "";
  const youtubeChannelId = body?.youtubeChannelId?.trim() ?? "";

  if (
    typeof body?.tradingPaused !== "boolean" ||
    !validUrl(websiteUrl) ||
    !validUrl(officialYoutubeUrl) ||
    (youtubeChannelId && !youtubeChannelId.startsWith("UC"))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Use valid website and YouTube URLs, plus a channel ID beginning with UC when adding signal data.",
    });
  }

  const systemSettings = await getSystemSettings();
  const youtubeChannels = { ...systemSettings.youtubeChannels };

  if (youtubeChannelId) {
    youtubeChannels[ticker] = youtubeChannelId;
  } else {
    delete youtubeChannels[ticker];
  }

  await Promise.all([
    sql`
      INSERT INTO market_listing_settings (
        ticker, trading_paused, website_url, official_youtube_url, updated_at
      )
      VALUES (
        ${ticker},
        ${body.tradingPaused},
        ${websiteUrl || null},
        ${officialYoutubeUrl || null},
        now()
      )
      ON CONFLICT (ticker) DO UPDATE
      SET
        trading_paused = EXCLUDED.trading_paused,
        website_url = EXCLUDED.website_url,
        official_youtube_url = EXCLUDED.official_youtube_url,
        updated_at = now()
    `,
    sql`
      INSERT INTO market_system_settings (id, youtube_channels, updated_at)
      VALUES (true, ${JSON.stringify(youtubeChannels)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE
      SET youtube_channels = EXCLUDED.youtube_channels, updated_at = now()
    `,
  ]);

  clearAdditionalSignalCache();

  return {
    ticker,
    tradingPaused: body.tradingPaused,
    websiteUrl,
    officialYoutubeUrl,
    youtubeChannelId,
  };
});