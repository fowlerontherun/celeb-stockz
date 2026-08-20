import { defineHandler } from "nitro";
import { createError } from "nitro/h3";
import { sql } from "../../utils/db";

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;

  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profiles = await sql`
    SELECT display_name, nickname, address, phone_number
    FROM user_profiles
    WHERE user_id = ${userId}
  `;

  return profiles[0] ?? {
    display_name: "",
    nickname: "",
    address: "",
    phone_number: "",
  };
});