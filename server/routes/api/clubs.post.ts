import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

type ClubInput = {
  name?: string;
  description?: string;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<ClubInput>(event);
  const name = body?.name?.trim() ?? "";
  const description = body?.description?.trim() ?? "";

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (name.length < 3 || name.length > 60 || description.length > 240) {
    throw createError({
      statusCode: 400,
      statusMessage: "Use a club name of 3–60 characters and a short description.",
    });
  }

  const existingMembership = await sql`
    SELECT club_id FROM club_members WHERE user_id = ${userId}
  `;
  if (existingMembership[0]) {
    throw createError({
      statusCode: 409,
      statusMessage: "You are already in a club.",
    });
  }

  const clubId = crypto.randomUUID();

  try {
    await sql`
      WITH new_club AS (
        INSERT INTO clubs (id, name, description, owner_id)
        VALUES (${clubId}, ${name}, ${description}, ${userId})
        RETURNING id
      )
      INSERT INTO club_members (club_id, user_id, role)
      SELECT id, ${userId}, 'owner' FROM new_club
    `;
  } catch {
    throw createError({
      statusCode: 409,
      statusMessage: "That club name is already taken.",
    });
  }

  return { ok: true };
});