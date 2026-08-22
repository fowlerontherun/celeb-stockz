import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { getSessionFromCookie } from "../../../utils/session";
import {
  saveProfitabilitySettings,
  type ProfitabilitySettings,
} from "../../../utils/profitability-settings";
import { checkIsAdmin } from "../../../utils/system-settings";

type SettingsBody = Partial<Omit<ProfitabilitySettings, "updatedAt">>;

function numberInRange(
  value: unknown,
  label: string,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw createError({
      statusCode: 400,
      statusMessage: `${label} must be between ${min} and ${max}.`,
    });
  }
  return parsed;
}

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

  const body = await readBody<SettingsBody>(event);

  const settings = await saveProfitabilitySettings({
    paymentProcessingPercent: numberInRange(
      body?.paymentProcessingPercent,
      "Payment processing percentage",
      0,
      20,
    ),
    paymentProcessingFixedPence: numberInRange(
      body?.paymentProcessingFixedPence,
      "Fixed payment processing fee",
      0,
      500,
    ),
    hostingMonthlyGbp: numberInRange(
      body?.hostingMonthlyGbp,
      "Monthly hosting cost",
      0,
      1_000_000,
    ),
    dataMonthlyGbp: numberInRange(
      body?.dataMonthlyGbp,
      "Monthly data/API cost",
      0,
      1_000_000,
    ),
    complianceMonthlyGbp: numberInRange(
      body?.complianceMonthlyGbp,
      "Monthly compliance cost",
      0,
      1_000_000,
    ),
    otherMonthlyGbp: numberInRange(
      body?.otherMonthlyGbp,
      "Other monthly costs",
      0,
      1_000_000,
    ),
    riskReservePercent: numberInRange(
      body?.riskReservePercent,
      "Risk reserve percentage",
      0,
      100,
    ),
  });

  return { settings };
});
