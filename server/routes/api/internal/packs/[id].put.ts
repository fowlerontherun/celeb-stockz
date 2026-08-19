import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
  readBody,
} from "nitro/h3";
import { getSessionFromCookie } from "../../../../utils/session";
import { checkIsAdmin } from "../../../../utils/system-settings";
import { sql } from "../../../../utils/db";

type PackUpdate = {
  priceGbp?: number;
  availableAt?: string | null;
  isPublished?: boolean;
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

  if (
    !Number.isInteger(packId) ||
    !Number.isFinite(price) ||
    price < 0 ||
    typeof body?.isPublished !== "boolean" ||
    (availableAt && !Number.isFinite(availableAt.getTime()))
  ) {
    throw createError({ statusCode: 400, statusMessage: "Enter a valid price, availability date, and publication status." });
  }

  const updated = await sql`
    UPDATE celebrity_packs
    SET
      price_gbp = ${price},
      available_at = ${availableAt?.toISOString() ?? null},
      is_published = ${body.isPublished},
      updated_at = now()
    WHERE id = ${packId}
    RETURNING id, name, price_gbp, available_at, is_published
  `;

  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "Pack not found." });
  }

  return updated[0];
});