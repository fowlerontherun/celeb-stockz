import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";
import {
  providerDiagnosticKeys,
  runProviderDiagnostic,
  type ProviderDiagnosticKey,
} from "../../../utils/provider-diagnostics";

type ProviderTestInput = {
  provider?: string;
};

function isProviderDiagnosticKey(
  provider: string | undefined,
): provider is ProviderDiagnosticKey {
  return Boolean(
    provider &&
      providerDiagnosticKeys.includes(provider as ProviderDiagnosticKey),
  );
}

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

  const body = await readBody<ProviderTestInput>(event);
  if (!isProviderDiagnosticKey(body?.provider)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid provider specified.",
    });
  }

  const result = await runProviderDiagnostic(body.provider);

  return {
    ok: result.status === "ok",
    status: result.status,
    message: result.message,
    sampleData: result.sampleData ?? null,
  };
});
