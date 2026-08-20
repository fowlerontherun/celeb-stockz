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
      statusMessage: "Enter a valid league invitation code.",
    });
  }

  const joined = await sql`
    WITH usable_invite AS (
      UPDATE league_invites
      SET use_count = use_count + 1
      WHERE code = ${code}
        AND expires_at > now()
        AND use_count < max_uses
      RETURNING league_id
    )
    INSERT INTO league_members (league_id, user_id, role)
    SELECT league_id, ${userId}, 'member' FROM usable_invite
    ON CONFLICT (league_id, user_id) DO NOTHING
    RETURNING league_id
  `;

  if (!joined[0]) {
    throw createError({
      statusCode: 404,
      statusMessage: "That league invitation is invalid, expired, or already used.",
    });
  }

  return { ok: true, leagueId: joined[0].league_id };
});