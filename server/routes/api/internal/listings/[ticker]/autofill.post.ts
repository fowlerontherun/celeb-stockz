import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
} from "nitro/h3";
import { sql } from "../../../../utils/db";
import { getSessionFromCookie } from "../../../../utils/session";
import { celebrityMarkets } from "../../../../utils/markets";
import {
  checkIsAdmin,
  getSystemSettings,
} from "../../../../utils/system-settings";
import { clearAdditionalSignalCache } from "../../../../utils/additional-price-signals";

type WikidataClaim = {
  mainsnak?: {
    datavalue?: {
      value?: string;
    };
  };
};

type WikidataEntity = {
  claims?: Record<string, WikidataClaim[]>;
};

function getClaimValue(entity: WikidataEntity, property: string) {
  return entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.trim() ?? "";
}

function isWebsiteUrl(value: string) {
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

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const market = celebrityMarkets.find((item) => item.ticker === ticker);

  if (!ticker || !market) {
    throw createError({
      statusCode: 404,
      statusMessage: "Listing not found.",
    });
  }

  const summaryResponse = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      market.name.replaceAll(" ", "_"),
    )}`,
    {
      headers: {
        accept: "application/json",
        "user-agent": "CelebStockz listing metadata lookup",
      },
    },
  );

  if (!summaryResponse.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: "Public profile metadata is temporarily unavailable.",
    });
  }

  const summary = (await summaryResponse.json()) as {
    wikibase_item?: string;
  };

  if (!summary.wikibase_item) {
    throw createError({
      statusCode: 404,
      statusMessage: "No Wikidata record is available for this listing.",
    });
  }

  const entityResponse = await fetch(
    `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(
      summary.wikibase_item,
    )}.json`,
    {
      headers: {
        accept: "application/json",
        "user-agent": "CelebStockz listing metadata lookup",
      },
    },
  );

  if (!entityResponse.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: "Public profile metadata is temporarily unavailable.",
    });
  }

  const entityPayload = (await entityResponse.json()) as {
    entities?: Record<string, WikidataEntity>;
  };
  const entity = entityPayload.entities?.[summary.wikibase_item];

  if (!entity) {
    throw createError({
      statusCode: 404,
      statusMessage: "No Wikidata record is available for this listing.",
    });
  }

  const detectedWebsite = getClaimValue(entity, "P856");
  const detectedYoutubeChannelId = getClaimValue(entity, "P2397");
  const websiteUrl = isWebsiteUrl(detectedWebsite) ? detectedWebsite : "";
  const youtubeChannelId = detectedYoutubeChannelId.startsWith("UC")
    ? detectedYoutubeChannelId
    : "";

  const [listingRows, systemSettings] = await Promise.all([
    sql<{ website_url: string | null; trading_paused: boolean }[]>`
      SELECT website_url, trading_paused
      FROM market_listing_settings
      WHERE ticker = ${ticker}
    `,
    getSystemSettings(),
  ]);

  const existingListing = listingRows[0];
  const savedWebsiteUrl = existingListing?.website_url?.trim() || websiteUrl;
  const channels = { ...systemSettings.youtubeChannels };
  const existingChannelId = channels[ticker]?.trim();
  const savedYoutubeChannelId = existingChannelId || youtubeChannelId;

  if (savedYoutubeChannelId) {
    channels[ticker] = savedYoutubeChannelId;
  }

  await Promise.all([
    sql`
      INSERT INTO market_listing_settings (
        ticker, trading_paused, website_url, updated_at
      )
      VALUES (
        ${ticker},
        ${existingListing?.trading_paused ?? false},
        ${savedWebsiteUrl || null},
        now()
      )
      ON CONFLICT (ticker) DO UPDATE
      SET
        website_url = EXCLUDED.website_url,
        updated_at = now()
    `,
    sql`
      INSERT INTO market_system_settings (id, youtube_channels, updated_at)
      VALUES (true, ${JSON.stringify(channels)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE
      SET youtube_channels = EXCLUDED.youtube_channels, updated_at = now()
    `,
  ]);

  clearAdditionalSignalCache();

  return {
    websiteUrl: savedWebsiteUrl,
    youtubeChannelId: savedYoutubeChannelId,
    found: {
      website: Boolean(websiteUrl),
      youtube: Boolean(youtubeChannelId),
    },
    preserved: {
      website: Boolean(existingListing?.website_url?.trim()),
      youtube: Boolean(existingChannelId),
    },
  };
});