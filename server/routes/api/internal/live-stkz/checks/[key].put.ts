import { defineHandler } from "nitro";
import {
  createError,
  getRequestHeader,
  getRouterParam,
  readBody,
} from "nitro/h3";
import { sql } from "../../../../../utils/db";
import { getSessionFromCookie } from "../../../../../utils/session";
import { checkIsAdmin } from "../../../../../utils/system-settings";

type CheckUpdate = {
  complete?: boolean;
};

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  const key = getRouterParam(event, "key");
  const body = await readBody<CheckUpdate>(event);

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  if (!key || typeof body?.complete !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a valid launch-check status.",
    });
  }

  const updated = await sql`
    UPDATE live_stkz_launch_checks
    SET
      is_complete = ${body.complete},
      completed_at = ${body.complete ? new Date().toISOString() : null},
      updated_at = now()
    WHERE check_key = ${key}
    RETURNING check_key, is_complete, completed_at
  `;

  if (!updated[0]) {
    throw createError({ statusCode: 404, statusMessage: "Launch check not found." });
  }

  return {
    key: updated[0].check_key,
    complete: updated[0].is_complete,
    completedAt: updated[0].completed_at,
  };
});