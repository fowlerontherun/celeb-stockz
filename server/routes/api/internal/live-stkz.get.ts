import { defineHandler } from "nitro";
import { createError, getRequestHeader } from "nitro/h3";
import { sql } from "../../../utils/db";
import { getSessionFromCookie } from "../../../utils/session";
import { checkIsAdmin } from "../../../utils/system-settings";

export default defineHandler(async (event) => {
  const session = await getSessionFromCookie(
    getRequestHeader(event, "cookie") ?? null,
  );

  if (!session?.user || !(await checkIsAdmin(session.user.email))) {
    throw createError({
      statusCode: 403,
      statusMessage: "Administrator access is required.",
    });
  }

  const [checks, totals, entries] = await Promise.all([
    sql`
      SELECT check_key, label, is_complete, completed_at
      FROM live_stkz_launch_checks
      ORDER BY check_key
    `,
    sql`
      SELECT
        COUNT(*)::int AS entry_count,
        COALESCE(SUM(fee_amount_gbp), 0) AS total_fees_gbp
      FROM live_stkz_fee_ledger
      WHERE status = 'settled'
    `,
    sql`
      SELECT entry_type, gross_amount_gbp, fee_amount_gbp, net_amount_gbp, status, reference, created_at
      FROM live_stkz_fee_ledger
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ]);

  return {
    checks: checks.map((check) => ({
      key: check.check_key,
      label: check.label,
      complete: check.is_complete,
      completedAt: check.completed_at,
    })),
    ledger: {
      settledEntries: Number(totals[0]?.entry_count ?? 0),
      totalFeesGbp: Number(totals[0]?.total_fees_gbp ?? 0),
      entries: entries.map((entry) => ({
        type: entry.entry_type,
        grossAmountGbp: Number(entry.gross_amount_gbp),
        feeAmountGbp: Number(entry.fee_amount_gbp),
        netAmountGbp: Number(entry.net_amount_gbp),
        status: entry.status,
        reference: entry.reference,
        createdAt: entry.created_at,
      })),
    },
  };
});