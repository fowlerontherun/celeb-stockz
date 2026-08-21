# CelebStockz Stripe Store

CelebStockz uses Stripe-hosted Checkout for web purchases. Stripe is the payment processor; CelebStockz remains the source of truth for game entitlements.

## Live catalogue

- Celebrity Pack — £1.99 — `price_1U6z3lBKNMFFRtauAhPiTcvk`
- 10,000 STKZ — £1.99 — `price_1U6z4CBKNMFFRtauTK6TKnl2`
- 30,000 STKZ — £4.99 — `price_1U6z4PBKNMFFRtauL3iZt6q5`
- 75,000 STKZ — £9.99 — `price_1U6z4ZBKNMFFRtauXfZZGjXD`
- 175,000 STKZ — £19.99 — `price_1U6z4fBKNMFFRtauTFGOBWfZ`

All prices are one-time GBP prices in the connected live Stripe account.

## Required server secrets

Configure these in the production hosting platform. Never expose them through Vite/client environment variables.

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Webhook

Register the production endpoint:

`https://<production-host>/api/stripe/webhook`

Subscribe at minimum to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

The endpoint verifies the `Stripe-Signature` header against the exact raw request body and rejects signatures older than five minutes.

## Fulfilment rules

The browser never grants paid content.

1. An authenticated user requests a Checkout Session from `/api/store/checkout`.
2. The server selects a known Stripe Price ID. The client cannot submit arbitrary prices.
3. User ID, SKU and optional celebrity pack ID are written to server-created Checkout metadata.
4. Stripe hosts payment collection.
5. A verified webhook records the Stripe event and fulfils the corresponding entitlement.
6. `payment_events`, `payment_orders` and `wallet_purchase_ledger` provide idempotency and auditability.

## Paid STKZ and resets

`user_wallets.purchased_stkz_balance` records the portion of the current wallet that came from real-money STKZ purchases and remains unspent.

- Trades spend ordinary/game STKZ first.
- Paid STKZ is consumed only after ordinary funds are exhausted.
- Selling shares adds game STKZ and does not recreate paid STKZ.
- Reset clears holdings, queued orders and trade history.
- Reset returns the account to `10,000 + unspent purchased STKZ`.
- Permanent celebrity-pack unlocks are not reset.

This prevents both accidental loss of paid currency and reset-based duplication.

## Refunds and disputes

Stripe refund events are recorded and payment orders are marked refunded for support/audit purposes. Because purchased STKZ may already have been spent in a simulated market, automatic destructive clawback is deliberately not performed in this first release. Refund/dispute reconciliation can be handled through a follow-up admin workflow.

## Mobile

This is the web payment adapter. A future native iOS/Android release should route StoreKit / Google Play purchases into the same internal fulfilment/ledger model rather than calling Stripe directly for in-app digital goods where platform billing rules apply.
