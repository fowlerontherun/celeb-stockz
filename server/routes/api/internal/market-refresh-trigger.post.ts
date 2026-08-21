import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";
import { runMarketCycle } from "../../../utils/market-cycle";
import { clearMarketResponseCache } from "../../../utils/market-response-cache";

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  const isAdmin = await checkIsAdmin(session?.user.email);
  if (!session?.user || !isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const result = await runMarketCycle("collect");
  clearMarketResponseCache();
  return result;
});
