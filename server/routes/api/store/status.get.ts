import { defineHandler } from "nitro";

export default defineHandler(() => ({
  checkoutConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  provider: "stripe",
  currency: "gbp",
}));
