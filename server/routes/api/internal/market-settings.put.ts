import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";

type SettingsInput = {
  youtubeApiKey?: string;
  youtubeChannels?: Record<string, string> | string;
  googleSearchApiKey?: string;
  googleSearchEngineId?: string;
  marketRefreshSecret?: string;
  adminEmails?: string;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  const isAdmin = await checkIsAdmin(session?.user.email);
  if (!session?.user || !isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const body = await readBody<SettingsInput>(event);

  let formattedChannels = {};
  if (body?.youtubeChannels) {
    if (typeof body.youtubeChannels === "string") {
      try {
        formattedChannels = JSON.parse(body.youtubeChannels);
      } catch {
        throw createError({
          statusCode: 400,
          statusMessage: "YouTube Channel mapping must be valid JSON.",
        });
      }
    } else if (typeof body.youtubeChannels === "object") {
      formattedChannels = body.youtubeChannels;
    }
  }

  const youtubeKey = body?.youtubeApiKey?.trim() ?? "";
  const googleKey = body?.googleSearchApiKey?.trim() ?? "";
  const googleCx = body?.googleSearchEngineId?.trim() ?? "";
  const refreshSecret = body?.marketRefreshSecret?.trim() ?? "";
  const emails = body?.adminEmails?.trim() ?? "";

  const updated = await sql`
    INSERT INTO market_system_settings (
      id,
      youtube_api_key,
      youtube_channels,
      google_search_api_key,
      google_search_engine_id,
      market_refresh_secret,
      admin_emails,
      updated_at
    )
    VALUES (
      true,
      ${youtubeKey},
      ${JSON.stringify(formattedChannels)}::jsonb,
      ${googleKey},
      ${googleCx},
      ${refreshSecret},
      ${emails},
      now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      youtube_api_key = EXCLUDED.youtube_api_key,
      youtube_channels = EXCLUDED.youtube_channels,
      google_search_api_key = EXCLUDED.google_search_api_key,
      google_search_engine_id = EXCLUDED.google_search_engine_id,
      market_refresh_secret = EXCLUDED.market_refresh_secret,
      admin_emails = EXCLUDED.admin_emails,
      updated_at = now()
    RETURNING *
  `;

  return {
    ok: true,
    updatedAt: updated[0]?.updated_at,
  };
});