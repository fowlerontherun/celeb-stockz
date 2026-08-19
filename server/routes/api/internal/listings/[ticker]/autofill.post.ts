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
      value?: unknown;
    };
  };
};

type WikidataEntity = {
  claims?: Record<string, WikidataClaim[]>;
};

type WikidataSearchResponse = {
  search?: Array<{ id?: string }>;
};

type WikidataEntitiesResponse = {
  entities?: Record<string, WikidataEntity>;
};

type PublicMetadata = {
  websiteUrl: string;
  youtubeChannelId: string;
  lookupAvailable: boolean;
};

function getClaimValue(entity: WikidataEntity, property: string) {
  const value = entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" ? value.trim() : "";
}

function isWebsiteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

async function fetchPublicJson<T>(url: URL | string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "CelebStockz listing metadata lookup",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function findWikidataId(name: string) {
  const wikipediaUrl = new URL("https://en.wikipedia.org/w/api.php");
  wikipediaUrl.searchParams.set("action", "query");
  wikipediaUrl.searchParams.set("format", "json");
  wikipediaUrl.searchParams.set("formatversion", "2");
  wikipediaUrl.searchParams.set("prop", "pageprops");
  wikipediaUrl.searchParams.set("titles", name);

  const wikipedia = await fetchPublicJson<{
    query?: {
      pages?: Array<{
        pageprops?: {
          wikibase_item?: string;
        };
      }>;
    };
  }>(wikipediaUrl);

  const linkedId = wikipedia?.query?.pages?.[0]?.pageprops?.wikibase_item;
  if (linkedId?.startsWith("Q")) {
    return linkedId;
  }

  const searchUrl = new URL("https://www.wikidata.org/w/api.php");
  searchUrl.searchParams.set("action", "wbsearchentities");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("language", "en");
  searchUrl.searchParams.set("limit", "5");
  searchUrl.searchParams.set("search", name);

  const result = await fetchPublicJson<WikidataSearchResponse>(searchUrl);
  return result?.search?.find((item) => item.id?.startsWith("Q"))?.id ?? null;
}

async function lookupPublicMetadata(name: string): Promise<PublicMetadata> {
  const wikidataId = await findWikidataId(name);

  if (!wikidataId) {
    return {
      websiteUrl: "",
      youtubeChannelId: "",
      lookupAvailable: false,
    };
  }

  const entityUrl = new URL("https://www.wikidata.org/w/api.php");
  entityUrl.searchParams.set("action", "wbgetentities");
  entityUrl.searchParams.set("format", "json");
  entityUrl.searchParams.set("ids", wikidataId);
  entityUrl.searchParams.set("props", "claims");

  const payload = await fetchPublicJson<WikidataEntitiesResponse>(entityUrl);
  const entity = payload?.entities?.[wikidataId];

  if (!entity) {
    return {
      websiteUrl: "",
      youtubeChannelId: "",
      lookupAvailable: false,
    };
  }

  const website = getClaimValue(entity, "P856");
  const youtubeChannel = getClaimValue(entity, "P2397");

  return {
    websiteUrl: isWebsiteUrl(website) ? website : "",
    youtubeChannelId: youtubeChannel.startsWith("UC") ? youtubeChannel : "",
    lookupAvailable: true,
  };
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

  const [metadata, listingRows, systemSettings] = await Promise.all([
    lookupPublicMetadata(market.name),
    sql<{ website_url: string | null; trading_paused: boolean }[]>`
      SELECT website_url, trading_paused
      FROM market_listing_settings
      WHERE ticker = ${ticker}
    `,
    getSystemSettings(),
  ]);

  const existingListing = listingRows[0];
  const existingWebsiteUrl = existingListing?.website_url?.trim() ?? "";
  const channels = { ...systemSettings.youtubeChannels };
  const existingChannelId = channels[ticker]?.trim() ?? "";
  const savedWebsiteUrl = existingWebsiteUrl || metadata.websiteUrl;
  const savedYoutubeChannelId = existingChannelId || metadata.youtubeChannelId;

  if (savedYoutubeChannelId) {
    channels[ticker] = savedYoutubeChannelId;
  }

  if (savedWebsiteUrl || savedYoutubeChannelId) {
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
  }

  return {
    websiteUrl: savedWebsiteUrl,
    youtubeChannelId: savedYoutubeChannelId,
    found: {
      website: Boolean(metadata.websiteUrl),
      youtube: Boolean(metadata.youtubeChannelId),
    },
    preserved: {
      website: Boolean(existingWebsiteUrl),
      youtube: Boolean(existingChannelId),
    },
    lookupAvailable: metadata.lookupAvailable,
  };
});