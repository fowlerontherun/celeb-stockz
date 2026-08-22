import { sql } from "./db";

export type ProfitabilitySettings = {
  paymentProcessingPercent: number;
  paymentProcessingFixedPence: number;
  hostingMonthlyGbp: number;
  dataMonthlyGbp: number;
  complianceMonthlyGbp: number;
  otherMonthlyGbp: number;
  riskReservePercent: number;
  updatedAt: string | null;
};

const DEFAULTS: Omit<ProfitabilitySettings, "updatedAt"> = {
  paymentProcessingPercent: 1.5,
  paymentProcessingFixedPence: 20,
  hostingMonthlyGbp: 25,
  dataMonthlyGbp: 100,
  complianceMonthlyGbp: 500,
  otherMonthlyGbp: 100,
  riskReservePercent: 10,
};

let schemaPromise: Promise<void> | null = null;

export async function ensureProfitabilitySettingsSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS profitability_model_settings (
          id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
          payment_processing_percent double precision NOT NULL DEFAULT 1.5,
          payment_processing_fixed_pence double precision NOT NULL DEFAULT 20,
          hosting_monthly_gbp double precision NOT NULL DEFAULT 25,
          data_monthly_gbp double precision NOT NULL DEFAULT 100,
          compliance_monthly_gbp double precision NOT NULL DEFAULT 500,
          other_monthly_gbp double precision NOT NULL DEFAULT 100,
          risk_reserve_percent double precision NOT NULL DEFAULT 10,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        INSERT INTO profitability_model_settings (id)
        VALUES (true)
        ON CONFLICT (id) DO NOTHING
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

export async function getProfitabilitySettings(): Promise<ProfitabilitySettings> {
  await ensureProfitabilitySettingsSchema();
  const rows = await sql`
    SELECT
      payment_processing_percent,
      payment_processing_fixed_pence,
      hosting_monthly_gbp,
      data_monthly_gbp,
      compliance_monthly_gbp,
      other_monthly_gbp,
      risk_reserve_percent,
      updated_at
    FROM profitability_model_settings
    WHERE id = true
    LIMIT 1
  `;
  const row = rows[0];

  return {
    paymentProcessingPercent: Number(row?.payment_processing_percent ?? DEFAULTS.paymentProcessingPercent),
    paymentProcessingFixedPence: Number(row?.payment_processing_fixed_pence ?? DEFAULTS.paymentProcessingFixedPence),
    hostingMonthlyGbp: Number(row?.hosting_monthly_gbp ?? DEFAULTS.hostingMonthlyGbp),
    dataMonthlyGbp: Number(row?.data_monthly_gbp ?? DEFAULTS.dataMonthlyGbp),
    complianceMonthlyGbp: Number(row?.compliance_monthly_gbp ?? DEFAULTS.complianceMonthlyGbp),
    otherMonthlyGbp: Number(row?.other_monthly_gbp ?? DEFAULTS.otherMonthlyGbp),
    riskReservePercent: Number(row?.risk_reserve_percent ?? DEFAULTS.riskReservePercent),
    updatedAt: row?.updated_at ?? null,
  };
}

export async function saveProfitabilitySettings(
  input: Omit<ProfitabilitySettings, "updatedAt">,
): Promise<ProfitabilitySettings> {
  await ensureProfitabilitySettingsSchema();

  await sql`
    INSERT INTO profitability_model_settings (
      id,
      payment_processing_percent,
      payment_processing_fixed_pence,
      hosting_monthly_gbp,
      data_monthly_gbp,
      compliance_monthly_gbp,
      other_monthly_gbp,
      risk_reserve_percent,
      updated_at
    )
    VALUES (
      true,
      ${input.paymentProcessingPercent},
      ${input.paymentProcessingFixedPence},
      ${input.hostingMonthlyGbp},
      ${input.dataMonthlyGbp},
      ${input.complianceMonthlyGbp},
      ${input.otherMonthlyGbp},
      ${input.riskReservePercent},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      payment_processing_percent = EXCLUDED.payment_processing_percent,
      payment_processing_fixed_pence = EXCLUDED.payment_processing_fixed_pence,
      hosting_monthly_gbp = EXCLUDED.hosting_monthly_gbp,
      data_monthly_gbp = EXCLUDED.data_monthly_gbp,
      compliance_monthly_gbp = EXCLUDED.compliance_monthly_gbp,
      other_monthly_gbp = EXCLUDED.other_monthly_gbp,
      risk_reserve_percent = EXCLUDED.risk_reserve_percent,
      updated_at = now()
  `;

  return getProfitabilitySettings();
}
