import { defineHandler } from "nitro";
import { createError, getRequestHeader, readRawBody } from "nitro/h3";
import { sql } from "../../../utils/db";
import {
  ensureStoreSchema,
  fulfillStripeCheckout,
  verifyStripeSignature,
} from "../../../utils/store";

type StripeCheckoutSession = {
  id: string;
  payment_status?: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeEvent = {
  id: string;
  type: string;
  livemode?: boolean;
  data: { object: Record<string, unknown> };
};

export default defineHandler(async (event) => {
  const rawBody = await readRawBody(event, "utf8");
  const signature = getRequestHeader(event, "stripe-signature");
  if (!rawBody || !verifyStripeSignature(rawBody, signature)) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Stripe signature." });
  }

  let stripeEvent: StripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody) as StripeEvent;
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid webhook payload." });
  }

  await ensureStoreSchema();
  const checkoutTypes = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ]);

  if (checkoutTypes.has(stripeEvent.type)) {
    const session = stripeEvent.data.object as StripeCheckoutSession;
    if (session.payment_status === "paid") {
      const metadata = session.metadata ?? {};
      const userId = metadata.user_id ?? session.client_reference_id ?? "";
      const sku = metadata.sku ?? "";
      const packId = metadata.pack_id ? Number(metadata.pack_id) : null;
      if (!userId || !sku || !session.id) {
        throw createError({ statusCode: 400, statusMessage: "Checkout metadata is incomplete." });
      }

      await fulfillStripeCheckout({
        eventId: stripeEvent.id,
        eventType: stripeEvent.type,
        sessionId: session.id,
        paymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        userId,
        sku,
        packId: Number.isInteger(packId) ? packId : null,
        amountMinor: Number(session.amount_total ?? 0),
        currency: session.currency ?? "gbp",
        payload: stripeEvent,
      });
      return { received: true };
    }
  }

  await sql`
    INSERT INTO payment_events (provider_event_id, event_type, provider_session_id, payload)
    VALUES (${stripeEvent.id}, ${stripeEvent.type}, NULL, ${rawBody}::jsonb)
    ON CONFLICT (provider_event_id) DO NOTHING
  `;

  if (stripeEvent.type === "charge.refunded") {
    const object = stripeEvent.data.object;
    const paymentIntent = typeof object.payment_intent === "string" ? object.payment_intent : null;
    if (paymentIntent) {
      await sql`
        UPDATE payment_orders
        SET status = 'refunded', updated_at = now()
        WHERE provider_payment_id = ${paymentIntent}
      `;
    }
  }

  return { received: true };
});
