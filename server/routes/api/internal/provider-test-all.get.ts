import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";
import { runAllProviderDiagnostics } from "../../../utils/provider-diagnostics";

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const results = await runAllProviderDiagnostics();
  if (results.dataforseo) {
    results.dataforseo = {
      ...results.dataforseo,
      name: "DataForSEO Trends",
    };
  }

  return {
    results,
    timestamp: new Date().toISOString(),
  };
});
