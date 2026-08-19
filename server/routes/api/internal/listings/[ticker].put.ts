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
  youtubeChannelId?: string;
};

function validWebsiteUrl(value: string) {
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
  const youtubeChannelId = body?.youtubeChannelId?.trim() ?? "";

  if (
    typeof body?.tradingPaused !== "boolean" ||
    !validWebsiteUrl(websiteUrl) ||
    (youtubeChannelId && !youtubeChannelId.startsWith("UC"))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Use a valid website URL and a YouTube channel ID beginning with UC.",
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
        ticker, trading_paused, website_url, updated_at
      )
      VALUES (
        ${ticker},
        ${body.tradingPaused},
        ${websiteUrl || null},
        now()
      )
      ON CONFLICT (ticker) DO UPDATE
      SET
        trading_paused = EXCLUDED.trading_paused,
        website_url = EXCLUDED.website_url,
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
    youtubeChannelId,
  };
});