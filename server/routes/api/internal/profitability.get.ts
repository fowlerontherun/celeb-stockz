import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";
import { STKZ_BUNDLES, ensureStoreSchema } from "../../../utils/store";
import { checkIsAdmin } from "../../../utils/system-settings";

const TRANSACTION_FEE_RATE = 0.01;

const catalogue = Object.values(STKZ_BUNDLES);
const catalogueGbpPerStkz =
  catalogue.reduce((sum, bundle) => sum + bundle.pricePence / 100, 0) /
  catalogue.reduce((sum, bundle) => sum + bundle.amount, 0);

function money(value: number) {
  return Number(value.toFixed(2));
}

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );
  const isAdmin = await checkIsAdmin(session?.user.email);

  if (!session?.user || !isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  await ensureStoreSchema();

  const [tradeRows, paymentRows, conversionRows, dailyRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS trades,
        COUNT(DISTINCT user_id)::int AS active_traders,
        COALESCE(SUM(total_stkz), 0) AS trade_volume_stkz,
        COALESCE(SUM(COALESCE(fee_stkz, total_stkz * ${TRANSACTION_FEE_RATE})), 0) AS fee_stkz,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS trades_30d,
        COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days')::int AS active_traders_30d,
        COALESCE(SUM(total_stkz) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS trade_volume_stkz_30d,
        COALESCE(SUM(COALESCE(fee_stkz, total_stkz * ${TRANSACTION_FEE_RATE})) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS fee_stkz_30d
      FROM trade_history
    `,
    sql`
      SELECT
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku LIKE 'STKZ_%'), 0)::bigint AS deposits_minor,
        COUNT(*) FILTER (WHERE status = 'paid' AND sku LIKE 'STKZ_%')::int AS deposits,
        COUNT(DISTINCT user_id) FILTER (WHERE status = 'paid' AND sku LIKE 'STKZ_%')::int AS depositors,
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK'), 0)::bigint AS pack_sales_minor,
        COUNT(*) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK')::int AS pack_sales,
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku LIKE 'STKZ_%' AND created_at >= now() - interval '30 days'), 0)::bigint AS deposits_minor_30d,
        COUNT(*) FILTER (WHERE status = 'paid' AND sku LIKE 'STKZ_%' AND created_at >= now() - interval '30 days')::int AS deposits_30d,
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK' AND created_at >= now() - interval '30 days'), 0)::bigint AS pack_sales_minor_30d,
        COUNT(*) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK' AND created_at >= now() - interval '30 days')::int AS pack_sales_30d
      FROM payment_orders
    `,
    sql`
      SELECT
        COALESCE(SUM(po.amount_minor), 0)::bigint AS paid_minor,
        COALESCE(SUM(wpl.amount_stkz), 0) AS purchased_stkz
      FROM payment_orders po
      JOIN wallet_purchase_ledger wpl ON wpl.payment_order_id = po.id
      WHERE po.status = 'paid' AND po.sku LIKE 'STKZ_%'
    `,
    sql`
      WITH days AS (
        SELECT generate_series(
          current_date - interval '89 days',
          current_date,
          interval '1 day'
        )::date AS day
      ),
      trades AS (
        SELECT
          created_at::date AS day,
          COUNT(*)::int AS trades,
          COALESCE(SUM(total_stkz), 0) AS trade_volume_stkz,
          COALESCE(SUM(COALESCE(fee_stkz, total_stkz * ${TRANSACTION_FEE_RATE})), 0) AS fee_stkz
        FROM trade_history
        WHERE created_at >= current_date - interval '89 days'
        GROUP BY created_at::date
      ),
      payments AS (
        SELECT
          created_at::date AS day,
          COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku LIKE 'STKZ_%'), 0)::bigint AS deposits_minor,
          COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK'), 0)::bigint AS pack_sales_minor
        FROM payment_orders
        WHERE created_at >= current_date - interval '89 days'
        GROUP BY created_at::date
      )
      SELECT
        days.day,
        COALESCE(trades.trades, 0)::int AS trades,
        COALESCE(trades.trade_volume_stkz, 0) AS trade_volume_stkz,
        COALESCE(trades.fee_stkz, 0) AS fee_stkz,
        COALESCE(payments.deposits_minor, 0)::bigint AS deposits_minor,
        COALESCE(payments.pack_sales_minor, 0)::bigint AS pack_sales_minor
      FROM days
      LEFT JOIN trades USING (day)
      LEFT JOIN payments USING (day)
      ORDER BY days.day
    `,
  ]);

  const trade = tradeRows[0] ?? {};
  const payment = paymentRows[0] ?? {};
  const conversion = conversionRows[0] ?? {};
  const paidMinor = Number(conversion.paid_minor ?? 0);
  const purchasedStkz = Number(conversion.purchased_stkz ?? 0);
  const realisedGbpPerStkz =
    paidMinor > 0 && purchasedStkz > 0
      ? paidMinor / 100 / purchasedStkz
      : null;
  const gbpPerStkz = realisedGbpPerStkz ?? catalogueGbpPerStkz;

  const feeStkz = Number(trade.fee_stkz ?? 0);
  const feeStkz30d = Number(trade.fee_stkz_30d ?? 0);
  const feeRevenueGbp = money(feeStkz * gbpPerStkz);
  const feeRevenueGbp30d = money(feeStkz30d * gbpPerStkz);
  const depositsGbp = money(Number(payment.deposits_minor ?? 0) / 100);
  const depositsGbp30d = money(Number(payment.deposits_minor_30d ?? 0) / 100);
  const packSalesGbp = money(Number(payment.pack_sales_minor ?? 0) / 100);
  const packSalesGbp30d = money(Number(payment.pack_sales_minor_30d ?? 0) / 100);
  const platformRevenueGbp = money(feeRevenueGbp + packSalesGbp);
  const platformRevenueGbp30d = money(feeRevenueGbp30d + packSalesGbp30d);

  return {
    assumptions: {
      transactionFeeRate: TRANSACTION_FEE_RATE,
      gbpPerStkz,
      conversionBasis: realisedGbpPerStkz === null ? "catalogue" : "realised-deposits",
      note: "Deposits are customer funds, not platform revenue. Platform revenue is transaction fees plus pack sales.",
    },
    allTime: {
      depositsGbp,
      depositCount: Number(payment.deposits ?? 0),
      depositorCount: Number(payment.depositors ?? 0),
      packSalesGbp,
      packSaleCount: Number(payment.pack_sales ?? 0),
      feeRevenueGbp,
      feeStkz,
      platformRevenueGbp,
      tradeVolumeStkz: Number(trade.trade_volume_stkz ?? 0),
      trades: Number(trade.trades ?? 0),
      activeTraders: Number(trade.active_traders ?? 0),
    },
    last30Days: {
      depositsGbp: depositsGbp30d,
      depositCount: Number(payment.deposits_30d ?? 0),
      packSalesGbp: packSalesGbp30d,
      packSaleCount: Number(payment.pack_sales_30d ?? 0),
      feeRevenueGbp: feeRevenueGbp30d,
      feeStkz: feeStkz30d,
      platformRevenueGbp: platformRevenueGbp30d,
      tradeVolumeStkz: Number(trade.trade_volume_stkz_30d ?? 0),
      trades: Number(trade.trades_30d ?? 0),
      activeTraders: Number(trade.active_traders_30d ?? 0),
      annualisedRevenueRunRateGbp: money(platformRevenueGbp30d * 12),
      feesOnlyAnnualisedRunRateGbp: money(feeRevenueGbp30d * 12),
      sustainableMonthlyCostCeilingGbp: platformRevenueGbp30d,
      feesOnlyMonthlyCostCeilingGbp: feeRevenueGbp30d,
    },
    daily: dailyRows.map((row) => {
      const dailyFeeRevenueGbp = money(Number(row.fee_stkz ?? 0) * gbpPerStkz);
      const dailyPackSalesGbp = money(Number(row.pack_sales_minor ?? 0) / 100);
      return {
        day: row.day,
        trades: Number(row.trades ?? 0),
        tradeVolumeStkz: Number(row.trade_volume_stkz ?? 0),
        depositsGbp: money(Number(row.deposits_minor ?? 0) / 100),
        feeRevenueGbp: dailyFeeRevenueGbp,
        packSalesGbp: dailyPackSalesGbp,
        platformRevenueGbp: money(dailyFeeRevenueGbp + dailyPackSalesGbp),
      };
    }),
  };
});
