import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
  readBody,
} from "nitro/h3";
import { getSessionFromCookie } from "../../../../../../utils/session";
import { checkIsAdmin } from "../../../../../../utils/system-settings";
import { sql } from "../../../../../../utils/db";
import { celebrityMarkets } from "../../../../../../utils/markets";

type MemberInput = {
  ticker?: string;
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

  const packId = Number(getRouterParam(event, "id"));
  const body = await readBody<MemberInput>(event);
  const ticker = body?.ticker?.trim().toUpperCase();

  if (!Number.isInteger(packId) || packId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid pack ID." });
  }

  const market = celebrityMarkets.find((item) => item.ticker === ticker);

  if (!ticker || !market) {
    throw createError({
      statusCode: 400,
      statusMessage: "Select a valid celebrity market.",
    });
  }

  await sql`
    INSERT INTO celebrity_pack_members (pack_id, ticker, display_name)
    VALUES (${packId}, ${ticker}, ${market.name})
    ON CONFLICT (pack_id, ticker) DO UPDATE
    SET display_name = EXCLUDED.display_name
  `;

  return { ok: true, packId, ticker, displayName: market.name };
});