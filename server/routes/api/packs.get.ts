import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";
import { getSystemSettings } from "../../utils/system-settings";

type PackRow = {
  id: number;
  name: string;
  price_gbp: string;
  available_at: string | null;
  is_published: boolean;
  is_announced: boolean;
  member_count: string;
  unlocked: boolean;
  members_json: Array<{ ticker: string; name: string }>;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [packs, systemSettings] = await Promise.all([
    sql<PackRow[]>`
      SELECT
        packs.id,
        packs.name,
        packs.price_gbp,
        packs.available_at,
        packs.is_published,
        packs.is_announced,
        COUNT(members.ticker)::text AS member_count,
        EXISTS(
          SELECT 1 FROM user_pack_unlocks AS unlocks
          WHERE unlocks.pack_id = packs.id AND unlocks.user_id = ${userId}
        ) AS unlocked,
        COALESCE(
          json_agg(
            json_build_object(
              'ticker', members.ticker,
              'name', COALESCE(members.display_name, members.ticker)
            )
          ) FILTER (WHERE members.ticker IS NOT NULL),
          '[]'::json
        ) AS members_json
      FROM celebrity_packs AS packs
      LEFT JOIN celebrity_pack_members AS members ON members.pack_id = packs.id
      WHERE packs.is_standard = false
      GROUP BY packs.id
      ORDER BY packs.id
    `,
    getSystemSettings(),
  ]);

  const isSale =
    systemSettings.packSaleActive &&
    systemSettings.packSaleDiscountPercent > 0;
  const discountMultiplier = isSale
    ? 1 - systemSettings.packSaleDiscountPercent / 100
    : 1;

  return {
    sale: {
      active: isSale,
      discountPercent: systemSettings.packSaleDiscountPercent,
      bannerText: systemSettings.packSaleBannerText,
      endsAt: systemSettings.packSaleEndsAt,
    },
    packs: packs.map((pack) => {
      const isAvailable =
        pack.is_published &&
        (!pack.available_at ||
          new Date(pack.available_at).getTime() <= Date.now());
      const isAnnounced = pack.is_announced || pack.is_published || pack.unlocked;
      const basePrice = Number(pack.price_gbp) || 1.99;
      const effectivePrice = isSale
        ? Number(Math.max(0.49, basePrice * discountMultiplier).toFixed(2))
        : basePrice;

      return {
        id: Number(pack.id),
        name: isAnnounced ? pack.name : `Classified Pack #${pack.id}`,
        rawName: isAnnounced ? pack.name : null,
        priceGbp: effectivePrice,
        originalPriceGbp: basePrice,
        isDiscounted: isSale,
        discountPercent: isSale ? systemSettings.packSaleDiscountPercent : 0,
        availableAt: pack.available_at,
        isPublished: pack.is_published,
        isAnnounced: pack.is_announced,
        memberCount: Number(pack.member_count),
        unlocked: pack.unlocked,
        isAvailable,
        members: isAnnounced ? pack.members_json || [] : [],
      };
    }),
  };
});