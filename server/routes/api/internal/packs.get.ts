import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";
import { sql } from "../../../utils/db";

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const packs = await sql`
    SELECT
      packs.id,
      packs.name,
      packs.price_gbp,
      packs.available_at,
      packs.is_published,
      packs.is_announced,
      COUNT(members.ticker)::int AS member_count,
      COALESCE(
        json_agg(
          json_build_object(
            'ticker', members.ticker,
            'name', COALESCE(cm.display_name, members.ticker),
            'category', COALESCE(cm.category, 'Entertainment')
          )
        ) FILTER (WHERE members.ticker IS NOT NULL),
        '[]'::json
      ) AS members
    FROM celebrity_packs AS packs
    LEFT JOIN celebrity_pack_members AS members ON members.pack_id = packs.id
    LEFT JOIN celebrity_markets AS cm ON cm.ticker = members.ticker
    GROUP BY packs.id
    ORDER BY packs.id
  `;

  return { packs };
});