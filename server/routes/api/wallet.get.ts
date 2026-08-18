import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { sql } from "../../utils/db";
import { getSessionFromCookie } from "../../utils/session";

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(getRequestHeader(event, "cookie") ?? null);
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const rows = await sql`
    INSERT INTO user_wallets (user_id)
    VALUES (${session.user.id})
    ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
    RETURNING balance_stkz
  `;

  return { balanceStkz: Number(rows[0].balance_stkz) };
});
