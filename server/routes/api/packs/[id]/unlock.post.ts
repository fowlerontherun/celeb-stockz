import { defineHandler } from "nitro";
import { createError, getRouterParam } from "nitro/h3";
import { sql } from "../../../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const packId = Number(getRouterParam(event, "id"));

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (!Number.isInteger(packId) || packId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Invalid pack ID." });
  }

  const packRows = await sql`
    SELECT id, name, is_published, available_at
    FROM celebrity_packs
    WHERE id = ${packId}
  `;

  const pack = packRows[0];
  if (!pack) {
    throw createError({ statusCode: 404, statusMessage: "Pack not found." });
  }

  const isAvailable =
    pack.is_published &&
    (!pack.available_at || new Date(pack.available_at).getTime() <= Date.now());

  if (!isAvailable) {
    throw createError({
      statusCode: 400,
      statusMessage: "This pack is not yet available for unlock.",
    });
  }

  await sql`
    INSERT INTO user_pack_unlocks (user_id, pack_id)
    VALUES (${userId}, ${packId})
    ON CONFLICT (user_id, pack_id) DO NOTHING
  `;

  return { ok: true, packId, name: pack.name };
});