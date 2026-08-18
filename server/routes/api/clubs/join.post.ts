import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";

type JoinInput = {
  code?: string;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<JoinInput>(event);
  const code = body?.code?.trim().toUpperCase() ?? "";

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Enter a valid club invitation code.",
    });
  }

  const membership = await sql`
    SELECT club_id FROM club_members WHERE user_id = ${userId}
  `;
  if (membership[0]) {
    throw createError({
      statusCode: 409,
      statusMessage: "You are already in a club.",
    });
  }

  const joined = await sql`
    WITH usable_invite AS (
      UPDATE club_invites
      SET use_count = use_count + 1
      WHERE code = ${code}
        AND expires_at > now()
        AND use_count < max_uses
      RETURNING club_id
    )
    INSERT INTO club_members (club_id, user_id, role)
    SELECT club_id, ${userId}, 'member' FROM usable_invite
    RETURNING club_id
  `;

  if (!joined[0]) {
    throw createError({
      statusCode: 404,
      statusMessage: "That invitation is invalid, expired, or fully used.",
    });
  }

  return { ok: true };
});