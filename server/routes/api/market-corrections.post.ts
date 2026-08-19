import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";
import { isMarketTicker } from "../../utils/markets";

type CorrectionInput = {
  ticker?: string;
  requestType?:
    | "profile-correction"
    | "source-correction"
    | "eligibility-review"
    | "removal-request";
  detail?: string;
};

const requestTypes = new Set([
  "profile-correction",
  "source-correction",
  "eligibility-review",
  "removal-request",
]);

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  const body = await readBody<CorrectionInput>(event);
  const ticker = body?.ticker?.trim().toUpperCase() ?? "";
  const detail = body?.detail?.trim() ?? "";

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  if (
    !isMarketTicker(ticker) ||
    !body?.requestType ||
    !requestTypes.has(body.requestType) ||
    detail.length < 10 ||
    detail.length > 1500
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Choose a valid market and request type, then add a note of 10–1,500 characters.",
    });
  }

  const requests = await sql`
    INSERT INTO market_correction_requests (
      user_id, ticker, request_type, detail
    )
    VALUES (${userId}, ${ticker}, ${body.requestType}, ${detail})
    RETURNING id, status, created_at
  `;

  return {
    id: Number(requests[0].id),
    status: requests[0].status,
    createdAt: requests[0].created_at,
  };
});