import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

type PackRow = {
  id: number;
  name: string;
  price_gbp: string;
  available_at: string | null;
  is_published: boolean;
  member_count: string;
  unlocked: boolean;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const packs = await sql<PackRow[]>`
    SELECT
      packs.id,
      packs.name,
      packs.price_gbp,
      packs.available_at,
      packs.is_published,
      COUNT(members.ticker)::text AS member_count,
      EXISTS(
        SELECT 1 FROM user_pack_unlocks AS unlocks
        WHERE unlocks.pack_id = packs.id AND unlocks.user_id = ${userId}
      ) AS unlocked
    FROM celebrity_packs AS packs
    LEFT JOIN celebrity_pack_members AS members ON members.pack_id = packs.id
    GROUP BY packs.id
    ORDER BY packs.id
  `;

  return {
    packs: packs.map((pack) => ({
      id: Number(pack.id),
      name: pack.name,
      priceGbp: Number(pack.price_gbp),
      availableAt: pack.available_at,
      isPublished: pack.is_published,
      memberCount: Number(pack.member_count),
      unlocked: pack.unlocked,
      isAvailable:
        pack.is_published &&
        (!pack.available_at || new Date(pack.available_at).getTime() <= Date.now()),
    })),
  };
});