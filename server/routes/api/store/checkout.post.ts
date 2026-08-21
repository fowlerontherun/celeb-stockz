import { defineHandler } from "nitro";
import { createError, getRequestURL, readBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import {
  PACK_PRICE_ID,
  STKZ_BUNDLES,
  ensureStoreSchema,
  recordPendingOrder,
  stripeRequest,
  type StkzSku,
} from "../../../utils/store";

type CheckoutRequest =
  | { type: "pack"; packId: number }
  | { type: "stkz"; sku: StkzSku };

type StripeSession = { id: string; url: string | null };

export default defineHandler(async (event) => {
  const userId = event.context.userId as string | undefined;
  if (!userId) throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  await ensureStoreSchema();
  const body = await readBody<CheckoutRequest>(event);
  const origin = getRequestURL(event).origin;

  let sku: string;
  let priceId: string;
  let amountMinor: number;
  let packId: number | null = null;

  if (body?.type === "pack") {
    packId = Number(body.packId);
    if (!Number.isInteger(packId) || packId <= 0) {
      throw createError({ statusCode: 400, statusMessage: "Invalid celebrity pack." });
    }
    const rows = await sql<{ id: number; is_published: boolean; available_at: string | null; unlocked: boolean }[]>`
      SELECT p.id, p.is_published, p.available_at,
             EXISTS(
               SELECT 1 FROM user_pack_unlocks u
               WHERE u.user_id = ${userId} AND u.pack_id = p.id
             ) AS unlocked
      FROM celebrity_packs p
      WHERE p.id = ${packId}
      LIMIT 1
    `;
    const pack = rows[0];
    if (!pack) throw createError({ statusCode: 404, statusMessage: "Pack not found." });
    const available = pack.is_published && (!pack.available_at || new Date(pack.available_at).getTime() <= Date.now());
    if (!available) throw createError({ statusCode: 400, statusMessage: "This pack is not available yet." });
    if (pack.unlocked) throw createError({ statusCode: 409, statusMessage: "You already own this pack." });
    sku = "PACK_UNLOCK";
    priceId = PACK_PRICE_ID;
    amountMinor = 199;
  } else if (body?.type === "stkz" && body.sku in STKZ_BUNDLES) {
    const bundle = STKZ_BUNDLES[body.sku];
    sku = body.sku;
    priceId = bundle.priceId;
    amountMinor = bundle.pricePence;
  } else {
    throw createError({ statusCode: 400, statusMessage: "Choose a valid store item." });
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${origin}/store?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/store?checkout=cancelled`);
  params.set("client_reference_id", userId);
  params.set("metadata[user_id]", userId);
  params.set("metadata[sku]", sku);
  if (packId) params.set("metadata[pack_id]", String(packId));

  try {
    const session = await stripeRequest<StripeSession>("checkout/sessions", params);
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    await recordPendingOrder({ userId, sessionId: session.id, sku, packId, amountMinor });
    return { checkoutUrl: session.url, sessionId: session.id };
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: error instanceof Error ? error.message : "Checkout could not be started.",
    });
  }
});
