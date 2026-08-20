import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

type LeagueInput = {
  name?: string;
  description?: string;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<LeagueInput>(event);
  const name = body?.name?.trim() ?? "";
  const description = body?.description?.trim() ?? "";

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (name.length < 3 || name.length > 60 || description.length > 280) {
    throw createError({
      statusCode: 400,
      statusMessage: "League name must be 3–60 characters, with description up to 280 characters.",
    });
  }

  const leagueId = crypto.randomUUID();

  await sql`
    WITH new_league AS (
      INSERT INTO leagues (id, name, description, owner_id)
      VALUES (${leagueId}, ${name}, ${description}, ${userId})
      RETURNING id
    )
    INSERT INTO league_members (league_id, user_id, role)
    SELECT id, ${userId}, 'commissioner' FROM new_league
  `;

  return { id: leagueId, name, description, isOwner: true };
});