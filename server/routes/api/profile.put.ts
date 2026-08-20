import { defineHandler } from "nitro";
import { createError, readBody } from "nitro/h3";
import { sql } from "../../utils/db";

type ProfileInput = {
  displayName?: string;
  nickname?: string;
  address?: string;
  phoneNumber?: string;
};

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const body = await readBody<ProfileInput>(event);
  const displayName = body?.displayName?.trim() ?? "";
  const nickname = body?.nickname?.trim() ?? "";
  const address = body?.address?.trim() ?? "";
  const phoneNumber = body?.phoneNumber?.trim() ?? "";

  if (displayName.length > 100 || nickname.length > 30 || address.length > 500 || phoneNumber.length > 40) {
    throw createError({
      statusCode: 400,
      statusMessage: "Please keep each profile field within the allowed length (nickname max 30 chars).",
    });
  }

  const profiles = await sql`
    INSERT INTO user_profiles (user_id, display_name, nickname, address, phone_number)
    VALUES (${userId}, ${displayName}, ${nickname}, ${address}, ${phoneNumber})
    ON CONFLICT (user_id) DO UPDATE
    SET
      display_name = EXCLUDED.display_name,
      nickname = EXCLUDED.nickname,
      address = EXCLUDED.address,
      phone_number = EXCLUDED.phone_number,
      updated_at = now()
    RETURNING display_name, nickname, address, phone_number
  `;

  return profiles[0];
});