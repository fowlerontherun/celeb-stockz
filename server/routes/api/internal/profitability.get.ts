import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";
import { GBP_PER_STKZ, ensureStoreSchema } from "../../../utils/store";
import { getProfitabilitySettings } from "../../../utils/profitability-settings";
import { checkIsAdmin } from "../../../utils/system-settings";

const TRANSACTION_FEE_RATE = 0.01;
const DAYS_PER_MONTH = 30.4375;
const DEPOSIT_FILTER = "(sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')";

function money(value: number) {
  return Number(value.toFixed(2));
}

function paymentProcessingCost(
  paymentVolumeGbp: number,
  paymentCount: number,
  percent: number,
  fixedPence: number,
) {
  return money(
    paymentVolumeGbp * (percent / 100) +
      paymentCount * (fixedPence / 100),
  );
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
  const model = await getProfitabilitySettings();

  const [tradeRows, paymentRows, dailyRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS trades,
        COUNT(DISTINCT user_id)::int AS active_traders,
        COALESCE(SUM(total_stkz), 0) AS trade_volume_stkz,
        COALESCE(SUM(COALESCE(fee_stkz, total_stkz * ${TRANSACTION_FEE_RATE})), 0) AS fee_stkz,
        MIN(created_at) AS first_trade_at,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS trades_30d,
        COUNT(DISTINCT user_id) FILTER (WHERE created_at >= now() - interval '30 days')::int AS active_traders_30d,
        COALESCE(SUM(total_stkz) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS trade_volume_stkz_30d,
        COALESCE(SUM(COALESCE(fee_stkz, total_stkz * ${TRANSACTION_FEE_RATE})) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS fee_stkz_30d
      FROM trade_history
    `,
    sql`
      SELECT
        COALESCE(SUM(amount_minor) FILTER (
          WHERE status = 'paid' AND (sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')
        ), 0)::bigint AS deposits_minor,
        COUNT(*) FILTER (
          WHERE status = 'paid' AND (sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')
        )::int AS deposits,
        COUNT(DISTINCT user_id) FILTER (
          WHERE status = 'paid' AND (sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')
        )::int AS depositors,
        COUNT(*) FILTER (
          WHERE status = 'paid' AND sku = 'INITIAL_DEPOSIT'
        )::int AS initial_deposits,
        COALESCE(SUM(amount_minor) FILTER (
          WHERE status = 'paid' AND sku = 'INITIAL_DEPOSIT'
        ), 0)::bigint AS initial_deposits_minor,
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK'), 0)::bigint AS pack_sales_minor,
        COUNT(*) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK')::int AS pack_sales,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_orders,
        MIN(created_at) FILTER (WHERE status = 'paid') AS first_payment_at,
        COALESCE(SUM(amount_minor) FILTER (
          WHERE status = 'paid'
            AND (sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')
            AND created_at >= now() - interval '30 days'
        ), 0)::bigint AS deposits_minor_30d,
        COUNT(*) FILTER (
          WHERE status = 'paid'
            AND (sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')
            AND created_at >= now() - interval '30 days'
        )::int AS deposits_30d,
        COUNT(*) FILTER (
          WHERE status = 'paid'
            AND sku = 'INITIAL_DEPOSIT'
            AND created_at >= now() - interval '30 days'
        )::int AS initial_deposits_30d,
        COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK' AND created_at >= now() - interval '30 days'), 0)::bigint AS pack_sales_minor_30d,
        COUNT(*) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK' AND created_at >= now() - interval '30 days')::int AS pack_sales_30d,
        COUNT(*) FILTER (WHERE status = 'paid' AND created_at >= now() - interval '30 days')::int AS paid_orders_30d
      FROM payment_orders
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
          COALESCE(SUM(amount_minor) FILTER (
            WHERE status = 'paid' AND (sku LIKE 'STKZ_%' OR sku = 'INITIAL_DEPOSIT')
          ), 0)::bigint AS deposits_minor,
          COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid' AND sku = 'PACK_UNLOCK'), 0)::bigint AS pack_sales_minor,
          COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_orders
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
        COALESCE(payments.pack_sales_minor, 0)::bigint AS pack_sales_minor,
        COALESCE(payments.paid_orders, 0)::int AS paid_orders
      FROM days
      LEFT JOIN trades USING (day)
      LEFT JOIN payments USING (day)
      ORDER BY days.day
    `,
  ]);

  const trade = tradeRows[0] ?? {};
  const payment = paymentRows[0] ?? {};
  const gbpPerStkz = GBP_PER_STKZ;

  const feeStkz = Number(trade.fee_stkz ?? 0);
  const feeStkz30d = Number(trade.fee_stkz_30d ?? 0);
  const feeRevenueGbp = money(feeStkz * gbpPerStkz);
  const feeRevenueGbp30d = money(feeStkz30d * gbpPerStkz);
  const depositsGbp = money(Number(payment.deposits_minor ?? 0) / 100);
  const depositsGbp30d = money(Number(payment.deposits_minor_30d ?? 0) / 100);
  const initialDepositsGbp = money(Number(payment.initial_deposits_minor ?? 0) / 100);
  const packSalesGbp = money(Number(payment.pack_sales_minor ?? 0) / 100);
  const packSalesGbp30d = money(Number(payment.pack_sales_minor_30d ?? 0) / 100);
  const platformRevenueGbp = money(feeRevenueGbp + packSalesGbp);
  const platformRevenueGbp30d = money(feeRevenueGbp30d + packSalesGbp30d);

  const monthlyFixedCostsGbp = money(
    model.hostingMonthlyGbp +
      model.dataMonthlyGbp +
      model.complianceMonthlyGbp +
      model.otherMonthlyGbp,
  );
  const paymentVolumeGbp = money(depositsGbp + packSalesGbp);
  const paymentVolumeGbp30d = money(depositsGbp30d + packSalesGbp30d);
  const processingCostsGbp = paymentProcessingCost(
    paymentVolumeGbp,
    Number(payment.paid_orders ?? 0),
    model.paymentProcessingPercent,
    model.paymentProcessingFixedPence,
  );
  const processingCostsGbp30d = paymentProcessingCost(
    paymentVolumeGbp30d,
    Number(payment.paid_orders_30d ?? 0),
    model.paymentProcessingPercent,
    model.paymentProcessingFixedPence,
  );
  const riskReserveGbp = money(
    platformRevenueGbp * (model.riskReservePercent / 100),
  );
  const riskReserveGbp30d = money(
    platformRevenueGbp30d * (model.riskReservePercent / 100),
  );

  const activityDates = [trade.first_trade_at, payment.first_payment_at]
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  const firstActivityAt = activityDates.length
    ? new Date(Math.min(...activityDates))
    : new Date();
  const operatingDays = Math.max(
    1,
    (Date.now() - firstActivityAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  const operatingMonths = Math.max(1, operatingDays / DAYS_PER_MONTH);
  const lifetimeFixedCostsGbp = money(monthlyFixedCostsGbp * operatingMonths);
  const estimatedCostsGbp = money(
    processingCostsGbp + lifetimeFixedCostsGbp + riskReserveGbp,
  );
  const estimatedCostsGbp30d = money(
    processingCostsGbp30d + monthlyFixedCostsGbp + riskReserveGbp30d,
  );
  const estimatedNetProfitGbp = money(platformRevenueGbp - estimatedCostsGbp);
  const estimatedNetProfitGbp30d = money(
    platformRevenueGbp30d - estimatedCostsGbp30d,
  );
  const netMarginPercent30d =
    platformRevenueGbp30d > 0
      ? money((estimatedNetProfitGbp30d / platformRevenueGbp30d) * 100)
      : 0;

  return {
    assumptions: {
      transactionFeeRate: TRANSACTION_FEE_RATE,
      gbpPerStkz,
      conversionBasis: "catalogue",
      note: "1 STKZ is fixed at £1 for the commercial simulation. The initial 100 STKZ is recorded as a £100 customer deposit, not platform revenue.",
    },
    model,
    allTime: {
      depositsGbp,
      depositCount: Number(payment.deposits ?? 0),
      depositorCount: Number(payment.depositors ?? 0),
      initialDepositCount: Number(payment.initial_deposits ?? 0),
      initialDepositsGbp,
      packSalesGbp,
      packSaleCount: Number(payment.pack_sales ?? 0),
      feeRevenueGbp,
      feeStkz,
      platformRevenueGbp,
      tradeVolumeStkz: Number(trade.trade_volume_stkz ?? 0),
      trades: Number(trade.trades ?? 0),
      activeTraders: Number(trade.active_traders ?? 0),
      paymentProcessingCostsGbp: processingCostsGbp,
      fixedOperatingCostsGbp: lifetimeFixedCostsGbp,
      riskReserveGbp,
      estimatedCostsGbp,
      estimatedNetProfitGbp,
      operatingMonths: money(operatingMonths),
      firstActivityAt: firstActivityAt.toISOString(),
    },
    last30Days: {
      depositsGbp: depositsGbp30d,
      depositCount: Number(payment.deposits_30d ?? 0),
      initialDepositCount: Number(payment.initial_deposits_30d ?? 0),
      packSalesGbp: packSalesGbp30d,
      packSaleCount: Number(payment.pack_sales_30d ?? 0),
      feeRevenueGbp: feeRevenueGbp30d,
      feeStkz: feeStkz30d,
      platformRevenueGbp: platformRevenueGbp30d,
      tradeVolumeStkz: Number(trade.trade_volume_stkz_30d ?? 0),
      trades: Number(trade.trades_30d ?? 0),
      activeTraders: Number(trade.active_traders_30d ?? 0),
      paymentProcessingCostsGbp: processingCostsGbp30d,
      fixedOperatingCostsGbp: monthlyFixedCostsGbp,
      riskReserveGbp: riskReserveGbp30d,
      estimatedCostsGbp: estimatedCostsGbp30d,
      estimatedNetProfitGbp: estimatedNetProfitGbp30d,
      netMarginPercent: netMarginPercent30d,
      annualisedRevenueRunRateGbp: money(platformRevenueGbp30d * 12),
      annualisedNetProfitRunRateGbp: money(estimatedNetProfitGbp30d * 12),
      feesOnlyAnnualisedRunRateGbp: money(feeRevenueGbp30d * 12),
      sustainableMonthlyCostCeilingGbp: platformRevenueGbp30d,
      feesOnlyMonthlyCostCeilingGbp: feeRevenueGbp30d,
    },
    daily: dailyRows.map((row) => {
      const dailyFeeRevenueGbp = money(Number(row.fee_stkz ?? 0) * gbpPerStkz);
      const dailyPackSalesGbp = money(Number(row.pack_sales_minor ?? 0) / 100);
      const dailyDepositsGbp = money(Number(row.deposits_minor ?? 0) / 100);
      const dailyRevenueGbp = money(dailyFeeRevenueGbp + dailyPackSalesGbp);
      const dailyProcessingGbp = paymentProcessingCost(
        dailyDepositsGbp + dailyPackSalesGbp,
        Number(row.paid_orders ?? 0),
        model.paymentProcessingPercent,
        model.paymentProcessingFixedPence,
      );
      const dailyReserveGbp = money(
        dailyRevenueGbp * (model.riskReservePercent / 100),
      );
      const dailyFixedCostsGbp = money(monthlyFixedCostsGbp / DAYS_PER_MONTH);
      const dailyEstimatedNetProfitGbp = money(
        dailyRevenueGbp -
          dailyProcessingGbp -
          dailyReserveGbp -
          dailyFixedCostsGbp,
      );

      return {
        day: row.day,
        trades: Number(row.trades ?? 0),
        tradeVolumeStkz: Number(row.trade_volume_stkz ?? 0),
        depositsGbp: dailyDepositsGbp,
        feeRevenueGbp: dailyFeeRevenueGbp,
        packSalesGbp: dailyPackSalesGbp,
        platformRevenueGbp: dailyRevenueGbp,
        estimatedNetProfitGbp: dailyEstimatedNetProfitGbp,
      };
    }),
  };
});
