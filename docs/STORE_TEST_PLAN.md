# Stripe store smoke test

- `/store` loads available packs and all four STKZ bundles.
- Clicking a bundle creates a hosted Stripe Checkout Session and redirects to Stripe.
- Clicking a pack creates a Checkout Session using the fixed pack price and internal pack metadata.
- Cancelling Checkout returns to `/store?checkout=cancelled` without granting anything.
- Successful paid Checkout returns to `/store?checkout=success` and webhook fulfilment updates wallet/pack ownership.
- Re-delivering the same Stripe event does not duplicate STKZ or pack ownership.
- Reset removes positions, open orders and trade history, restores 10,000 base STKZ, preserves unspent paid STKZ and all pack unlocks.
- Direct and queued buys spend ordinary STKZ before paid STKZ.
