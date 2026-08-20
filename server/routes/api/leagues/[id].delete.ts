import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const leagueId = getRouterParam(event, "id");

  if (!userId || !leagueId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const league = await sql`
    SELECT owner_id FROM leagues WHERE id = ${leagueId}
  `;

  if (!league[0]) {
    throw createError({ statusCode: 404, statusMessage: "League not found." });
  }

  if (league[0].owner_id === userId) {
    // Owner deletes league
    await sql`DELETE FROM leagues WHERE id = ${leagueId}`;
    return { ok: true, action: "deleted" };
  } else {
    // Member leaves league
    await sql`DELETE FROM league_members WHERE league_id = ${leagueId} AND user_id = ${userId}`;
    return { ok: true, action: "left" };
  }
});