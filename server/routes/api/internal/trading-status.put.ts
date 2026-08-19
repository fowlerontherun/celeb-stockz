import { defineHandler } from "nitro";
import { createError, getRequestHeader, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";

type TradingStatusInput = {
  paused?: boolean;
};

const adminEmails = new Set(
  [
    ...(process.env.NITRO_MARKET_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    "j.fowler1986@gmail.com",
  ],
);

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  const body = await readBody<TradingStatusInput>(event);

  if (!session?.user || !adminEmails.has(session.user.email.toLowerCase())) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  if (typeof body?.paused !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose whether trading should be paused.",
    });
  }

  const settings = await sql`
    INSERT INTO market_system_settings (id, trading_paused, updated_at)
    VALUES (true, ${body.paused}, now())
    ON CONFLICT (id) DO UPDATE
    SET trading_paused = EXCLUDED.trading_paused, updated_at = now()
    RETURNING trading_paused, updated_at
  `;

  return {
    tradingPaused: settings[0].trading_paused,
    updatedAt: settings[0].updated_at,
  };
});