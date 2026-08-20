import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const leagues = await sql`
    SELECT
      l.id,
      l.name,
      l.description,
      l.owner_id,
      lm.role,
      lm.joined_at,
      (SELECT COUNT(*)::int FROM league_members WHERE league_id = l.id) AS member_count,
      (l.owner_id = ${userId}) AS is_owner
    FROM league_members lm
    JOIN leagues l ON l.id = lm.league_id
    WHERE lm.user_id = ${userId}
    ORDER BY lm.joined_at DESC
  `;

  return {
    leagues: leagues.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      ownerId: l.owner_id,
      role: l.role,
      memberCount: Number(l.member_count),
      isOwner: Boolean(l.is_owner),
      joinedAt: l.joined_at,
    })),
  };
});