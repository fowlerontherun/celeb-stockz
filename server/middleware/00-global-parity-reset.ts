import { defineHandler } from "nitro";
import { getRequestURL } from "nitro/h3";
import { ensureGlobalParityReset } from "../utils/economy-reset";
import { ensureStoreSchema } from "../utils/store";

export default defineHandler(async (event) => {
  const pathname = getRequestURL(event).pathname;

  if (!pathname.startsWith("/api/")) {
    return;
  }

  await ensureStoreSchema();
  await ensureGlobalParityReset();
});
