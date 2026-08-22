import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  BadgePoundSterling,
  Banknote,
  Calculator,
  CircleDollarSign,
  Coins,
  Database,
  Landmark,
  ReceiptPoundSterling,
  RefreshCw,
  Save,
  Scale,
  Server,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { showError, showSuccess } from "@/utils/toast";

type PeriodMetrics = {
  depositsGbp: number;
  depositCount: number;
  packSalesGbp: number;
  packSaleCount: number;
  feeRevenueGbp: number;
  feeStkz: number;
  platformRevenueGbp: number;
  tradeVolumeStkz: number;
  trades: number;
  activeTraders: number;
  paymentProcessingCostsGbp: number;
  fixedOperatingCostsGbp: number;
  riskReserveGbp: number;
  estimatedCostsGbp: number;
  estimatedNetProfitGbp: number;
};

type ProfitabilityModelInputs = {
  paymentProcessingPercent: number;
  paymentProcessingFixedPence: number;
  hostingMonthlyGbp: number;
  dataMonthlyGbp: number;
  complianceMonthlyGbp: number;
  otherMonthlyGbp: number;
  riskReservePercent: number;
};

type ProfitabilityData = {
  assumptions: {
    transactionFeeRate: number;
    gbpPerStkz: number;
    conversionBasis: "catalogue" | "realised-deposits";
    note: string;
  };
  model: ProfitabilityModelInputs & {
    updatedAt: string | null;
  };
  allTime: PeriodMetrics & {
    depositorCount: number;
    operatingMonths: number;
    firstActivityAt: string;
  };
  last30Days: PeriodMetrics & {
    netMarginPercent: number;
    annualisedRevenueRunRateGbp: number;
    annualisedNetProfitRunRateGbp: number;
    feesOnlyAnnualisedRunRateGbp: number;
    sustainableMonthlyCostCeilingGbp: number;
    feesOnlyMonthlyCostCeilingGbp: number;
  };
  daily: Array<{
    day: string;
    trades: number;
    tradeVolumeStkz: number;
    depositsGbp: number;
    feeRevenueGbp: number;
    packSalesGbp: number;
    platformRevenueGbp: number;
    estimatedNetProfitGbp: number;
  }>;
};

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  valueClassName = "text-white",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
  valueClassName?: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#9f90ac]">
          {label}
        </p>
        <Icon size={17} className="text-[#c99bff]" />
      </div>
      <p className={`font-display mt-3 text-2xl font-black ${valueClassName}`}>
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-[#9f90ac]">{detail}</p>
    </article>
  );
}

function ModelInput({
  label,
  value,
  suffix,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/10 bg-[#160c25] p-4">
      <span className="text-xs font-extrabold uppercase tracking-[.1em] text-[#9f90ac]">
        {label}
      </span>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 font-black text-white outline-none focus:border-[#c99bff]/60"
        />
        <span className="shrink-0 text-xs font-bold text-[#c4b4d0]">{suffix}</span>
      </div>
    </label>
  );
}

export default function ProfitabilityDashboard() {
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [modelDraft, setModelDraft] = useState<ProfitabilityModelInputs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/internal/profitability", {
        credentials: "include",
      });
      const payload = (await response.json()) as ProfitabilityData & {
        statusMessage?: string;
      };
      if (!response.ok) {
        throw new Error(payload.statusMessage ?? "Could not load profitability data.");
      }
      setData(payload);
      setModelDraft({
        paymentProcessingPercent: payload.model.paymentProcessingPercent,
        paymentProcessingFixedPence: payload.model.paymentProcessingFixedPence,
        hostingMonthlyGbp: payload.model.hostingMonthlyGbp,
        dataMonthlyGbp: payload.model.dataMonthlyGbp,
        complianceMonthlyGbp: payload.model.complianceMonthlyGbp,
        otherMonthlyGbp: payload.model.otherMonthlyGbp,
        riskReservePercent: payload.model.riskReservePercent,
      });
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not load profitability data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modelDraft) return;
    setIsSaving(true);

    try {
      const response = await fetch("/api/internal/profitability-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(modelDraft),
      });
      const payload = (await response.json()) as { statusMessage?: string };
      if (!response.ok) {
        throw new Error(payload.statusMessage ?? "Could not save profitability assumptions.");
      }
      showSuccess("Profitability assumptions saved. The economics model has been recalculated.");
      await load();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not save profitability assumptions.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const chartData = useMemo(
    () =>
      (data?.daily ?? []).map((point) => ({
        ...point,
        label: new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "short",
        }).format(new Date(point.day)),
      })),
    [data],
  );

  if (isLoading && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <RefreshCw className="animate-spin" />
      </main>
    );
  }

  if (!data || !modelDraft) return null;

  const feePercent = (data.assumptions.transactionFeeRate * 100).toFixed(1);
  const stkzPerPound =
    data.assumptions.gbpPerStkz > 0
      ? Math.round(1 / data.assumptions.gbpPerStkz)
      : 0;
  const profitable30d = data.last30Days.estimatedNetProfitGbp >= 0;

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              to="/"
              className="text-sm font-bold text-[#c99bff] transition hover:text-white"
            >
              ← Back to markets
            </Link>
            <p className="mt-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
              <ShieldCheck size={15} /> Restricted operations
            </p>
            <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
              Market profitability
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c4b4d0]">
              Model what CelebStockz activity could look like as a real-money business: customer cash flow, trading-fee income, payment costs, operating overhead and estimated pre-tax profit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <section className="mt-8 rounded-[28px] border border-[#ffd17b]/25 bg-[#2a1a2d] p-5 sm:p-6">
          <div className="flex gap-3">
            <Landmark className="mt-0.5 shrink-0 text-[#ffd17b]" size={20} />
            <div>
              <h2 className="font-display text-lg font-black text-[#ffe2a3]">
                Deposits are not profit
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#d8c8c1]">
                In a withdrawable real-money market, deposited cash belongs economically to customers. Deposits are therefore shown as capital flowing through the platform. Earned revenue is trading fees plus celebrity-pack sales; estimated profit subtracts the cost model below.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">
            Last 30 days
          </p>
          <h2 className="font-display mt-1 text-2xl font-black">
            Current business run-rate
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Platform revenue"
              value={gbp.format(data.last30Days.platformRevenueGbp)}
              detail={`${gbp.format(data.last30Days.feeRevenueGbp)} fees + ${gbp.format(data.last30Days.packSalesGbp)} pack sales`}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Estimated costs"
              value={gbp.format(data.last30Days.estimatedCostsGbp)}
              detail="Processing + monthly overhead + configured risk reserve"
              icon={ReceiptPoundSterling}
            />
            <MetricCard
              label="Estimated net profit"
              value={gbp.format(data.last30Days.estimatedNetProfitGbp)}
              detail={`${data.last30Days.netMarginPercent.toFixed(1)}% estimated pre-tax margin`}
              icon={Calculator}
              valueClassName={profitable30d ? "text-[#62e7b6]" : "text-[#ff8f9d]"}
            />
            <MetricCard
              label="Annualised net run-rate"
              value={gbp.format(data.last30Days.annualisedNetProfitRunRateGbp)}
              detail="Latest 30-day estimated net result multiplied by 12"
              icon={TrendingUp}
              valueClassName={profitable30d ? "text-[#62e7b6]" : "text-[#ff8f9d]"}
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <article className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">
                  90-day history
                </p>
                <h2 className="font-display mt-1 text-xl font-black">
                  Cash flow, revenue and estimated profit
                </h2>
              </div>
              <Coins className="text-[#c99bff]" />
            </div>
            <div className="mt-5 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9f90ac", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: "#9f90ac", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `£${compact.format(Number(value))}`}
                    width={62}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#160c25",
                      border: "1px solid rgba(255,255,255,.12)",
                      borderRadius: 12,
                    }}
                    formatter={(value: number | string, name: string) => [
                      gbp.format(Number(value)),
                      name,
                    ]}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="depositsGbp"
                    name="Deposits"
                    stroke="#ffd17b"
                    fill="#ffd17b"
                    fillOpacity={0.08}
                  />
                  <Area
                    type="monotone"
                    dataKey="platformRevenueGbp"
                    name="Revenue"
                    stroke="#c99bff"
                    fill="#c99bff"
                    fillOpacity={0.12}
                  />
                  <Area
                    type="monotone"
                    dataKey="estimatedNetProfitGbp"
                    name="Estimated net profit"
                    stroke="#62e7b6"
                    fill="#62e7b6"
                    fillOpacity={0.12}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">
              30-day cost breakdown
            </p>
            <h2 className="font-display mt-1 text-xl font-black">
              Where the money goes
            </h2>
            <div className="mt-5 space-y-3">
              {[
                ["Payment processing", data.last30Days.paymentProcessingCostsGbp, ReceiptPoundSterling],
                ["Fixed operating costs", data.last30Days.fixedOperatingCostsGbp, Server],
                ["Risk reserve", data.last30Days.riskReserveGbp, ShieldAlert],
              ].map(([label, value, Icon]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.035] p-4"
                >
                  <div className="flex items-center gap-3">
                    <Icon size={17} className="text-[#c99bff]" />
                    <span className="text-sm font-bold text-[#c4b4d0]">{String(label)}</span>
                  </div>
                  <span className="font-black">{gbp.format(Number(value))}</span>
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-2xl border p-4 ${profitable30d ? "border-[#62e7b6]/25 bg-[#62e7b6]/[.06]" : "border-[#ff7282]/25 bg-[#ff7282]/[.06]"}`}>
              <p className="text-xs font-bold text-[#c4b4d0]">Current verdict</p>
              <p className={`font-display mt-1 text-xl font-black ${profitable30d ? "text-[#62e7b6]" : "text-[#ff9ca5]"}`}>
                {profitable30d ? "Profitable under this model" : "Not yet break-even"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#9f90ac]">
                Based on the latest 30 days and the assumptions configured below.
              </p>
            </div>
          </article>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#c99bff]/20 bg-[#211230] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                <Calculator size={15} /> Scenario model
              </p>
              <h2 className="font-display mt-1 text-2xl font-black">
                Adjust the real-world cost assumptions
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a99ab7]">
                Change these values to model a lean startup, a regulated launch or a more expensive scaled operation. The saved assumptions apply to this admin profitability view only.
              </p>
            </div>
          </div>

          <form onSubmit={saveModel} className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ModelInput
                label="Card processing"
                value={modelDraft.paymentProcessingPercent}
                suffix="% of payment"
                step={0.1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, paymentProcessingPercent: value } : current)}
              />
              <ModelInput
                label="Fixed card fee"
                value={modelDraft.paymentProcessingFixedPence}
                suffix="p per payment"
                step={1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, paymentProcessingFixedPence: value } : current)}
              />
              <ModelInput
                label="Hosting"
                value={modelDraft.hostingMonthlyGbp}
                suffix="£ / month"
                step={1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, hostingMonthlyGbp: value } : current)}
              />
              <ModelInput
                label="Data & APIs"
                value={modelDraft.dataMonthlyGbp}
                suffix="£ / month"
                step={1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, dataMonthlyGbp: value } : current)}
              />
              <ModelInput
                label="Compliance / legal"
                value={modelDraft.complianceMonthlyGbp}
                suffix="£ / month"
                step={1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, complianceMonthlyGbp: value } : current)}
              />
              <ModelInput
                label="Other operating costs"
                value={modelDraft.otherMonthlyGbp}
                suffix="£ / month"
                step={1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, otherMonthlyGbp: value } : current)}
              />
              <ModelInput
                label="Risk reserve"
                value={modelDraft.riskReservePercent}
                suffix="% of revenue"
                step={1}
                onChange={(value) => setModelDraft((current) => current ? { ...current, riskReservePercent: value } : current)}
              />
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7c3aed] px-5 py-4 text-sm font-black text-white transition hover:bg-[#8b4cf2] disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? "Recalculating…" : "Save & recalculate"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-4 grid gap-3 text-xs text-[#9f90ac] sm:grid-cols-3">
            <div className="flex items-start gap-2 rounded-xl bg-white/[.03] p-3">
              <ReceiptPoundSterling size={15} className="mt-0.5 shrink-0" />
              Default card cost starts at 1.5% + 20p, matching current standard UK Stripe card pricing.
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-white/[.03] p-3">
              <Scale size={15} className="mt-0.5 shrink-0" />
              Compliance is deliberately configurable because a real cash market could require substantially more legal and regulatory spend.
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-white/[.03] p-3">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              The risk reserve is a planning allowance, not customer deposits; deposits remain excluded from profit entirely.
            </div>
          </div>
        </section>

        <section className="mt-6">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">
            Activity drivers
          </p>
          <h2 className="font-display mt-1 text-2xl font-black">
            What is generating the economics?
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Fee revenue"
              value={gbp.format(data.last30Days.feeRevenueGbp)}
              detail={`${feePercent}% fee equivalent across ${data.last30Days.trades.toLocaleString()} completed trades`}
              icon={BadgePoundSterling}
            />
            <MetricCard
              label="Customer deposits"
              value={gbp.format(data.last30Days.depositsGbp)}
              detail={`${data.last30Days.depositCount.toLocaleString()} paid STKZ top-ups · cash inflow, not revenue`}
              icon={Landmark}
            />
            <MetricCard
              label="Pack revenue"
              value={gbp.format(data.last30Days.packSalesGbp)}
              detail={`${data.last30Days.packSaleCount.toLocaleString()} paid celebrity-pack unlocks`}
              icon={Users}
            />
            <MetricCard
              label="Fees-only annualised"
              value={gbp.format(data.last30Days.feesOnlyAnnualisedRunRateGbp)}
              detail="Trading fees alone, before processing and operating costs"
              icon={TrendingUp}
            />
          </div>
        </section>

        <section className="mt-6">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">
            All time
          </p>
          <h2 className="font-display mt-1 text-2xl font-black">
            Lifetime market economics
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Deposited capital"
              value={gbp.format(data.allTime.depositsGbp)}
              detail={`${data.allTime.depositCount.toLocaleString()} top-ups from ${data.allTime.depositorCount.toLocaleString()} depositors`}
              icon={Banknote}
            />
            <MetricCard
              label="Lifetime revenue"
              value={gbp.format(data.allTime.platformRevenueGbp)}
              detail={`${gbp.format(data.allTime.feeRevenueGbp)} trading fees + ${gbp.format(data.allTime.packSalesGbp)} packs`}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Lifetime estimated costs"
              value={gbp.format(data.allTime.estimatedCostsGbp)}
              detail={`Includes ${data.allTime.operatingMonths.toFixed(1)} modeled operating months`}
              icon={ReceiptPoundSterling}
            />
            <MetricCard
              label="Lifetime estimated profit"
              value={gbp.format(data.allTime.estimatedNetProfitGbp)}
              detail="Estimated pre-tax result under the current saved scenario"
              icon={Calculator}
              valueClassName={data.allTime.estimatedNetProfitGbp >= 0 ? "text-[#62e7b6]" : "text-[#ff8f9d]"}
            />
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-6">
          <h2 className="font-display text-lg font-black">Valuation assumptions</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#9f90ac]">Trading fee</p>
              <p className="mt-1 font-black">{feePercent}% per completed trade</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#9f90ac]">STKZ cash equivalent</p>
              <p className="mt-1 font-black">≈ {stkzPerPound.toLocaleString()} STKZ per £1</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#9f90ac]">Conversion basis</p>
              <p className="mt-1 font-black">
                {data.assumptions.conversionBasis === "realised-deposits"
                  ? "Actual paid top-ups"
                  : "Current store catalogue"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#9f90ac]">Monthly modeled overhead</p>
              <p className="mt-1 font-black">{gbp.format(data.last30Days.fixedOperatingCostsGbp)}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#9f90ac]">
            This remains a commercial planning simulation, not an accounting or regulatory assessment. Estimated profit is pre-tax. A real withdrawable celebrity market could also face licensing, authorisation, safeguarding, fraud, chargeback, liquidity, market-making and legal costs beyond the assumptions entered here.
          </p>
        </section>
      </div>
    </main>
  );
}
