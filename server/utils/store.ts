import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

export const PACK_PRICE_ID = "price_1U6z3lBKNMFFRtauAhPiTcvk";
export const GBP_PER_STKZ = 0.01;
export const STARTING_BALANCE_STKZ = 100;
export const INITIAL_DEPOSIT_GBP = 1;

export const STKZ_BUNDLES = {
  STKZ_10000: { amount: 199, priceId: "price_1U6z4CBKNMFFRtauTK6TKnl2", pricePence: 199 },
  STKZ_30000: { amount: 499, priceId: "price_1U6z4PBKNMFFRtauL3iZt6q5", pricePence: 499 },
  STKZ_75000: { amount: 999, priceId: "price_1U6z4ZBKNMFFRtauXfZZGjXD", pricePence: 999 },
  STKZ_175000: { amount: 1999, priceId: "price_1U6z4fBKNMFFRtauTFGOBWfZ", pricePence: 1999 },
} as const;

export type StkzSku = keyof typeof STKZ_BUNDLES;

let schemaPromise: Promise<void> | null = null;

export async function ensureStoreSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        ALTER TABLE user_wallets
        ADD COLUMN IF NOT EXISTS purchased_stkz_balance double precision NOT NULL DEFAULT 0
      `;
      await sql`
        ALTER TABLE user_wallets
        ALTER COLUMN balance_stkz SET DEFAULT 100
      `;
      await sql`
        DO $$
        BEGIN
          IF to_regclass('public.trade_orders') IS NOT NULL THEN
            ALTER TABLE public.trade_orders
            ADD COLUMN IF NOT EXISTS quantity double precision;
          END IF;
        END;
        $$;
      `;
      await sql`
        DO $$
        BEGIN
          IF to_regclass('public.trade_history') IS NOT NULL THEN
            ALTER TABLE public.trade_history
            ADD COLUMN IF NOT EXISTS fee_stkz double precision;

            UPDATE public.trade_history
            SET fee_stkz = ROUND((total_stkz * 0.01)::numeric, 2)::double precision
            WHERE fee_stkz IS NULL;
          END IF;
        END;
        $$;
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS payment_orders (
          id bigserial PRIMARY KEY,
          user_id text NOT NULL,
          provider text NOT NULL DEFAULT 'stripe',
          provider_session_id text UNIQUE,
          provider_payment_id text,
          sku text NOT NULL,
          pack_id bigint,
          amount_minor integer NOT NULL,
          currency text NOT NULL DEFAULT 'gbp',
          status text NOT NULL DEFAULT 'pending',
          fulfilled_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS payment_orders_user_idx
        ON payment_orders (user_id, created_at DESC)
      `;
      await sql`
        INSERT INTO payment_orders (
          user_id,
          provider,
          provider_session_id,
          sku,
          amount_minor,
          currency,
          status,
          fulfilled_at,
          created_at,
          updated_at
        )
        SELECT
          user_id,
          'simulation',
          'initial-deposit:' || user_id,
          'INITIAL_DEPOSIT',
          ${INITIAL_DEPOSIT_GBP * 100},
          'gbp',
          'paid',
          now(),
          now(),
          now()
        FROM user_wallets
        WHERE true
        ON CONFLICT (provider_session_id) DO NOTHING
      `;
      await sql`
        UPDATE payment_orders
        SET amount_minor = ${INITIAL_DEPOSIT_GBP * 100},
            updated_at = now()
        WHERE provider = 'simulation'
          AND sku = 'INITIAL_DEPOSIT'
          AND provider_session_id LIKE 'initial-deposit:%'
          AND amount_minor <> ${INITIAL_DEPOSIT_GBP * 100}
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS payment_events (
          provider_event_id text PRIMARY KEY,
          event_type text NOT NULL,
          provider_session_id text,
          payload jsonb NOT NULL,
          processed_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS wallet_purchase_ledger (
          id bigserial PRIMARY KEY,
          user_id text NOT NULL,
          payment_order_id bigint REFERENCES payment_orders(id),
          amount_stkz double precision NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (payment_order_id)
        )
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

export function getStripeSecret() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("Stripe checkout is not configured.");
  return secret;
}

export async function stripeRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getStripeSecret()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "Stripe request failed.");
  return data;
}

export function verifyStripeSignature(rawBody: string, signatureHeader: string | undefined) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !signatureHeader) return false;
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((candidate) => {
    try {
      const candidateBuffer = Buffer.from(candidate, "hex");
      return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
    } catch {
      return false;
    }
  });
}

export async function recordPendingOrder(input: {
  userId: string;
  sessionId: string;
  sku: string;
  packId?: number | null;
  amountMinor: number;
}) {
  await ensureStoreSchema();
  await sql`
    INSERT INTO payment_orders (user_id, provider_session_id, sku, pack_id, amount_minor, currency, status)
    VALUES (${input.userId}, ${input.sessionId}, ${input.sku}, ${input.packId ?? null}, ${input.amountMinor}, 'gbp', 'pending')
    ON CONFLICT (provider_session_id) DO NOTHING
  `;
}

export async function fulfillStripeCheckout(input: {
  eventId: string;
  eventType: string;
  sessionId: string;
  paymentId: string | null;
  userId: string;
  sku: string;
  packId: number | null;
  amountMinor: number;
  currency: string;
  payload: unknown;
}) {
  await ensureStoreSchema();
  const bundle = input.sku in STKZ_BUNDLES ? STKZ_BUNDLES[input.sku as StkzSku] : null;
  const rows = await sql<{ fulfilled: boolean }[]>`
    WITH inserted_event AS (
      INSERT INTO payment_events (provider_event_id, event_type, provider_session_id, payload)
      VALUES (${input.eventId}, ${input.eventType}, ${input.sessionId}, ${JSON.stringify(input.payload)}::jsonb)
      ON CONFLICT (provider_event_id) DO NOTHING
      RETURNING provider_event_id
    ),
    upserted_order AS (
      INSERT INTO payment_orders (
        user_id, provider_session_id, provider_payment_id, sku, pack_id,
        amount_minor, currency, status, fulfilled_at
      )
      SELECT
        ${input.userId}, ${input.sessionId}, ${input.paymentId}, ${input.sku}, ${input.packId},
        ${input.amountMinor}, ${input.currency}, 'paid', now()
      FROM inserted_event
      ON CONFLICT (provider_session_id) DO UPDATE
      SET provider_payment_id = EXCLUDED.provider_payment_id,
          status = 'paid', fulfilled_at = COALESCE(payment_orders.fulfilled_at, now()), updated_at = now()
      RETURNING id, (xmax = 0 OR fulfilled_at IS NOT NULL) AS eligible
    ),
    grant_currency AS (
      INSERT INTO wallet_purchase_ledger (user_id, payment_order_id, amount_stkz)
      SELECT ${input.userId}, id, ${bundle?.amount ?? 0}
      FROM upserted_order
      WHERE ${bundle !== null}
      ON CONFLICT (payment_order_id) DO NOTHING
      RETURNING amount_stkz
    ),
    credit_wallet AS (
      INSERT INTO user_wallets (user_id, balance_stkz, purchased_stkz_balance)
      SELECT ${input.userId}, ${STARTING_BALANCE_STKZ} + amount_stkz, amount_stkz FROM grant_currency
      ON CONFLICT (user_id) DO UPDATE
      SET balance_stkz = user_wallets.balance_stkz + EXCLUDED.purchased_stkz_balance,
          purchased_stkz_balance = user_wallets.purchased_stkz_balance + EXCLUDED.purchased_stkz_balance,
          updated_at = now()
      RETURNING user_id
    ),
    grant_pack AS (
      INSERT INTO user_pack_unlocks (user_id, pack_id)
      SELECT ${input.userId}, ${input.packId}
      FROM upserted_order
      WHERE ${input.sku === "PACK_UNLOCK"} AND ${input.packId} IS NOT NULL
      ON CONFLICT (user_id, pack_id) DO NOTHING
      RETURNING pack_id
    )
    SELECT EXISTS(SELECT 1 FROM inserted_event) AS fulfilled
  `;
  return Boolean(rows[0]?.fulfilled);
}
