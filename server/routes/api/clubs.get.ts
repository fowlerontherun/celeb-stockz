import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const clubRows = await sql`
    SELECT clubs.id, clubs.name, clubs.description, clubs.owner_id, membership.role
    FROM club_members AS membership
    JOIN clubs ON clubs.id = membership.club_id
    WHERE membership.user_id = ${userId}
  `;

  const club = clubRows[0];
  if (!club) {
    return { club: null };
  }

  const members = await sql`
    SELECT
      membership.user_id,
      membership.role,
      membership.joined_at,
      COALESCE(NULLIF(profiles.nickname, ''), NULLIF(profiles.display_name, ''), 'Club member') AS display_name
    FROM club_members AS membership
    LEFT JOIN user_profiles AS profiles ON profiles.user_id = membership.user_id
    WHERE membership.club_id = ${club.id}
    ORDER BY membership.role DESC, membership.joined_at ASC
  `;

  return {
    club: {
      id: club.id,
      name: club.name,
      description: club.description,
      role: club.role,
      memberCount: members.length,
      members: members.map((member) => ({
        name: member.display_name,
        role: member.role,
        joinedAt: member.joined_at,
      })),
    },
  };
});