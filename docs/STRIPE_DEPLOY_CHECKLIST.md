# Stripe deployment checklist

Before enabling live customer purchases:

1. Add `STRIPE_SECRET_KEY` to the production hosting environment.
2. Register `https://<production-host>/api/stripe/webhook` in Stripe Workbench / Webhooks.
3. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `charge.refunded`.
4. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET` in the production hosting environment.
5. Redeploy the application.
6. Sign in and open `/api/store/status`; both `checkoutConfigured` and `webhookConfigured` should be `true`.
7. Make one low-value live purchase with the account owner, confirm the Stripe payment, the payment order, wallet/pack fulfilment, and receipt.
8. Confirm a second webhook delivery does not duplicate the entitlement.

Do not expose either secret through `VITE_*` variables or client-side code.
