import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
} from "nitro/h3";
import { getSessionFromCookie } from "../../../../../../../utils/session";
import { checkIsAdmin } from "../../../../../../../utils/system-settings";
import { sql } from "../../../../../../../utils/db";

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
  const ticker = getRouterParam(event, "ticker")?.trim().toUpperCase();

  if (!Number.isInteger(packId) || packId <= 0 || !ticker) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid pack ID or ticker.",
    });
  }

  await sql`
    DELETE FROM celebrity_pack_members
    WHERE pack_id = ${packId} AND ticker = ${ticker}
  `;

  return { ok: true, packId, ticker };
});