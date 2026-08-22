import { sql } from "./db";

const RESET_KEY = "2026-08-22-stkz-gbp-parity-global-reset-v1";

let resetPromise: Promise<void> | null = null;

export async function ensureGlobalParityReset() {
  if (!resetPromise) {
    resetPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS market_economy_migrations (
          migration_key text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now(),
          affected_wallets integer NOT NULL DEFAULT 0,
          notes text
        )
      `;

      await sql`
        DO $$
        DECLARE
          v_wallet_count integer := 0;
        BEGIN
          PERFORM pg_advisory_xact_lock(
            hashtext('2026-08-22-stkz-gbp-parity-global-reset-v1')::bigint
          );

          IF NOT EXISTS (
            SELECT 1
            FROM public.market_economy_migrations
            WHERE migration_key = '2026-08-22-stkz-gbp-parity-global-reset-v1'
          ) THEN
            IF to_regclass('public.trade_orders') IS NOT NULL THEN
              EXECUTE 'DELETE FROM public.trade_orders';
            END IF;

            IF to_regclass('public.trade_history') IS NOT NULL THEN
              EXECUTE 'DELETE FROM public.trade_history';
            END IF;

            IF to_regclass('public.user_positions') IS NOT NULL THEN
              EXECUTE 'DELETE FROM public.user_positions';
            END IF;

            IF to_regclass('public.wallet_purchase_ledger') IS NOT NULL THEN
              EXECUTE 'DELETE FROM public.wallet_purchase_ledger';
            END IF;

            UPDATE public.user_wallets
            SET
              balance_stkz = 100,
              purchased_stkz_balance = 0,
              updated_at = now();

            GET DIAGNOSTICS v_wallet_count = ROW_COUNT;

            INSERT INTO public.market_economy_migrations (
              migration_key,
              affected_wallets,
              notes
            )
            VALUES (
              '2026-08-22-stkz-gbp-parity-global-reset-v1',
              v_wallet_count,
              'Reset every trading wallet to 100 STKZ at £1 parity; cleared holdings, orders, trade history and legacy purchased-STKZ ledger while preserving accounts, packs, payment history and social data.'
            );
          END IF;
        END;
        $$;
      `;
    })().catch((error) => {
      resetPromise = null;
      throw error;
    });
  }

  return resetPromise;
}

export async function getGlobalParityResetStatus() {
  await sql`
    CREATE TABLE IF NOT EXISTS market_economy_migrations (
      migration_key text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      affected_wallets integer NOT NULL DEFAULT 0,
      notes text
    )
  `;

  const rows = await sql`
    SELECT migration_key, applied_at, affected_wallets, notes
    FROM market_economy_migrations
    WHERE migration_key = ${RESET_KEY}
    LIMIT 1
  `;

  const row = rows[0];
  return row
    ? {
        applied: true,
        appliedAt: row.applied_at,
        affectedWallets: Number(row.affected_wallets ?? 0),
        notes: row.notes ?? null,
      }
    : {
        applied: false,
        appliedAt: null,
        affectedWallets: 0,
        notes: null,
      };
}
