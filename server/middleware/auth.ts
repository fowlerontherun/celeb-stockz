import { defineHandler } from "nitro";
import { createError, getRequestHeader, getRequestURL } from "nitro/h3";
import { getSessionFromCookie } from "../utils/session";

export default defineHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;
  if (pathname.startsWith("/api/auth/") || !pathname.startsWith("/api/")) return;

  const session = await getSessionFromCookie(getRequestHeader(event, "cookie") ?? null);
  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  event.context.userId = session.user.id;
});
