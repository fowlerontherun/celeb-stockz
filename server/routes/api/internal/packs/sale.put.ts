import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { sql } from "../../../../utils/db";
import { getSessionFromCookie } from "../../../../utils/session";
import { checkIsAdmin } from "../../../../utils/system-settings";

type SaleInput = {
  active?: boolean;
  discountPercent?: number;
  bannerText?: string;
  endsAt?: string | null;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const body = await readBody<SaleInput>(event);
  const active = typeof body?.active === "boolean" ? body.active : false;
  const discountPercent = Number(body?.discountPercent ?? 0);
  const bannerText = (body?.bannerText ?? "").trim() || "🔥 FLASH SALE: Celebrity Packs are currently on sale!";
  const endsAt = body?.endsAt ? new Date(body.endsAt) : null;

  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 99) {
    throw createError({
      statusCode: 400,
      statusMessage: "Discount percentage must be between 0% and 99%.",
    });
  }

  await sql`
    INSERT INTO market_system_settings (
      id, pack_sale_active, pack_sale_discount_percent, pack_sale_banner_text, pack_sale_ends_at, updated_at
    )
    VALUES (
      true, ${active}, ${discountPercent}, ${bannerText}, ${endsAt ? endsAt.toISOString() : null}, now()
    )
    ON CONFLICT (id) DO UPDATE
    SET
      pack_sale_active = EXCLUDED.pack_sale_active,
      pack_sale_discount_percent = EXCLUDED.pack_sale_discount_percent,
      pack_sale_banner_text = EXCLUDED.pack_sale_banner_text,
      pack_sale_ends_at = EXCLUDED.pack_sale_ends_at,
      updated_at = now()
  `;

  return {
    ok: true,
    active,
    discountPercent,
    bannerText,
    endsAt: endsAt ? endsAt.toISOString() : null,
  };
});