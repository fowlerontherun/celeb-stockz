import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const leagueId = getRouterParam(event, "id");

  if (!userId || !leagueId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const membership = await sql`
    SELECT role FROM league_members WHERE league_id = ${leagueId} AND user_id = ${userId}
  `;

  if (!membership[0]) {
    throw createError({
      statusCode: 403,
      statusMessage: "You must be a member of this league to create an invitation.",
    });
  }

  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO league_invites (code, league_id, created_by, expires_at)
    VALUES (${code}, ${leagueId}, ${userId}, ${expiresAt.toISOString()})
  `;

  return { code, expiresAt: expiresAt.toISOString() };
});