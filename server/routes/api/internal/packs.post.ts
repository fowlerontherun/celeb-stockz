import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";
import { sql } from "../../../utils/db";

type NewPackInput = {
  name?: string;
  priceGbp?: number;
  availableAt?: string | null;
  isPublished?: boolean;
  isAnnounced?: boolean;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({ statusCode: 403, statusMessage: "Administrator access is required." });
  }

  const body = await readBody<NewPackInput>(event);
  const name = body?.name?.trim();
  const priceGbp = Number(body?.priceGbp ?? 0);
  const availableAt = body?.availableAt ? new Date(body.availableAt) : null;
  const isPublished = Boolean(body?.isPublished);
  const isAnnounced = Boolean(body?.isAnnounced);

  if (!name || name.length < 2 || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: "Pack name must be between 2 and 80 characters." });
  }

  if (!Number.isFinite(priceGbp) || priceGbp < 0) {
    throw createError({ statusCode: 400, statusMessage: "Price must be a positive number." });
  }

  const inserted = await sql`
    INSERT INTO celebrity_packs (name, price_gbp, available_at, is_published, is_announced, updated_at)
    VALUES (
      ${name},
      ${priceGbp},
      ${availableAt ? availableAt.toISOString() : null},
      ${isPublished},
      ${isAnnounced},
      now()
    )
    RETURNING id, name, price_gbp, available_at, is_published, is_announced
  `;

  return inserted[0];
});