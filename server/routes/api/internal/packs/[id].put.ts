import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
  readBody,
} from "nitro/h3";
import { getSessionFromCookie } from "../../../../../utils/session";
import { checkIsAdmin } from "../../../../../utils/system-settings";
import { sql } from "../../../../../utils/db";

type PackUpdate = {
  priceGbp?: number;
  availableAt?: string | null;
  isPublished?: boolean;
  isAnnounced?: boolean;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  const packId = Number(getRouterParam(event, "id"));
  const body = await readBody<PackUpdate>(event);

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const price = Number(body?.priceGbp);
  const availableAt = body?.availableAt ? new Date(body.availableAt) : null;
  const isPublished = typeof body?.isPublished === "boolean" ? body.isPublished : false;
  const isAnnounced = typeof body?.isAnnounced === "boolean" ? body.isAnnounced : false;

  if (
    !Number.isInteger(packId) ||
    !Number.isFinite(price) ||
    price < 0 ||
    (availableAt && !Number.isFinite(availableAt.getTime()))
  ) {
    throw createError({ statusCode: 400, statusMessage: "Enter a valid price and availability date." });
  }

  const updated = await sql`
    UPDATE celebrity_packs
    SET
      price_gbp = ${price},
      available_at = ${availableAt?.toISOString() ?? null},
      is_published = ${isPublished},
      is_announced = ${isAnnounced},
      updated_at = now()
    WHERE id = ${packId}
    RETURNING id, name, price_gbp, available_at, is_published, is_announced
  `;

  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "Pack not found." });
  }

  return updated[0];
});