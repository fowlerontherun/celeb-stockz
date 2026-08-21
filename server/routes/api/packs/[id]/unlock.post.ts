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

  const rows = await sql<{ unlocked: boolean }[]>`
    SELECT EXISTS(
      SELECT 1 FROM user_pack_unlocks
      WHERE user_id = ${userId} AND pack_id = ${packId}
    ) AS unlocked
  `;

  if (rows[0]?.unlocked) {
    return { ok: true, packId, alreadyUnlocked: true };
  }

  throw createError({
    statusCode: 402,
    statusMessage:
      "This is a paid celebrity pack. Open the CelebStockz Store to complete the £1.99 Stripe checkout.",
    data: { storePath: "/store", packId },
  });
});
