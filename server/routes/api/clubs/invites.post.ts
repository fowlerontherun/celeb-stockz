import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const membership = await sql`
    SELECT club_id FROM club_members WHERE user_id = ${userId}
  `;
  const clubId = membership[0]?.club_id;

  if (!clubId) {
    throw createError({
      statusCode: 404,
      statusMessage: "Join a club before creating invitations.",
    });
  }

  const code = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO club_invites (code, club_id, created_by, expires_at)
    VALUES (${code}, ${clubId}, ${userId}, ${expiresAt.toISOString()})
  `;

  return { code, expiresAt: expiresAt.toISOString() };
});