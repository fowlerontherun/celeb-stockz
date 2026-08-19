import { defineHandler } from "nitro";
import { createError, getRequestHeader, getRequestURL } from "nitro/h3";
import { getSessionFromCookie } from "../utils/session";

const PUBLIC_PREFIXES = ["/api/auth/", "/auth/", "/api/internal/market-refresh"];

function isPublicMarketRead(pathname: string, method: string) {
  if (method !== "GET") {
    return false;
  }

  return (
    pathname === "/api/markets" ||
    pathname.startsWith("/api/markets/") ||
    pathname === "/api/movers"
  );
}

export default defineHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;

  if (
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    isPublicMarketRead(pathname, event.method)
  ) {
    return;
  }

  if (!pathname.startsWith("/api/")) {
    return;
  }

  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  event.context.userId = session.user.id;
});