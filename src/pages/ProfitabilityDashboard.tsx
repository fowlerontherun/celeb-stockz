import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgePoundSterling,
  Banknote,
  CircleDollarSign,
  Coins,
  Landmark,
  RefreshCw,
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
import { showError } from "@/utils/toast";

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
};

type ProfitabilityData = {
  assumptions: {
    transactionFeeRate: number;
    gbpPerStkz: number;
    conversionBasis: "catalogue" | "realised-deposits";
    note: string;
  };
  allTime: PeriodMetrics & {
    depositorCount: number;
  };
  last30Days: PeriodMetrics & {
    annualisedRevenueRunRateGbp: number;
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
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Banknote;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[.045] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#9f90ac]">
          {label}
        </p>
        <Icon size={17} className="text-[#c99bff]" />
      </div>
      <p className="font-display mt-3 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#9f90ac]">{detail}</p>
    </article>
  );
}

export default function ProfitabilityDashboard() {
  const [data, setData] = useState<ProfitabilityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (!data) return null;

  const feePercent = (data.assumptions.transactionFeeRate * 100).toFixed(1);
  const stkzPerPound = data.assumptions.gbpPerStkz > 0
    ? Math.round(1 / data.assumptions.gbpPerStkz)
    : 0;

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link to="/" className="text-sm font-bold text-[#c99bff] transition hover:text-white">
              ← Back to markets
            </Link>
            <p className="mt-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
              <ShieldCheck size={15} /> Restricted operations
            </p>
            <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
              Market profitability
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c4b4d0]">
              See what CelebStockz activity would look like as a real-money business: customer deposits, trading volume, transaction-fee revenue and the revenue run-rate available to cover operating costs.
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
                In a withdrawable real-money market, deposited cash belongs economically to customers. This dashboard therefore reports deposits as capital flowing through the platform, while platform revenue is transaction fees plus celebrity-pack sales.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">Last 30 days</p>
              <h2 className="font-display mt-1 text-2xl font-black">Current business run-rate</h2>
            </div>
          </div>
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
              label="Platform revenue"
              value={gbp.format(data.last30Days.platformRevenueGbp)}
              detail={`${gbp.format(data.last30Days.feeRevenueGbp)} fees + ${gbp.format(data.last30Days.packSalesGbp)} pack sales`}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Annualised run-rate"
              value={gbp.format(data.last30Days.annualisedRevenueRunRateGbp)}
              detail="30-day platform revenue multiplied by 12; before tax, processing and operating costs"
              icon={TrendingUp}
            />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <article className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">90-day history</p>
                <h2 className="font-display mt-1 text-xl font-black">Cash flow and earned revenue</h2>
              </div>
              <Coins className="text-[#c99bff]" />
            </div>
            <div className="mt-5 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#9f90ac", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tick={{ fill: "#9f90ac", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `£${compact.format(Number(value))}`} width={62} />
                  <Tooltip
                    contentStyle={{ background: "#160c25", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}
                    formatter={(value: number | string, name: string) => [gbp.format(Number(value)), name]}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="depositsGbp" name="Deposits" stroke="#ffd17b" fill="#ffd17b" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="feeRevenueGbp" name="Trading fees" stroke="#62e7b6" fill="#62e7b6" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="packSalesGbp" name="Pack sales" stroke="#c99bff" fill="#c99bff" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">Profitability lens</p>
            <h2 className="font-display mt-1 text-xl font-black">What can the market support?</h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[#62e7b6]/20 bg-[#62e7b6]/[.06] p-4">
                <p className="text-xs font-bold text-[#8cefc9]">Monthly cost ceiling</p>
                <p className="font-display mt-1 text-2xl font-black">{gbp.format(data.last30Days.sustainableMonthlyCostCeilingGbp)}</p>
                <p className="mt-1 text-xs leading-5 text-[#a9cdbf]">Maximum monthly costs the current 30-day fee + pack revenue could cover before profit turns negative.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
                <p className="text-xs font-bold text-[#c4b4d0]">Fees-only cost ceiling</p>
                <p className="font-display mt-1 text-xl font-black">{gbp.format(data.last30Days.feesOnlyMonthlyCostCeilingGbp)}</p>
                <p className="mt-1 text-xs leading-5 text-[#9f90ac]">The stricter real-market view if pack sales are ignored and deposits remain customer money.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
                <p className="text-xs font-bold text-[#c4b4d0]">Fees-only annualised</p>
                <p className="font-display mt-1 text-xl font-black">{gbp.format(data.last30Days.feesOnlyAnnualisedRunRateGbp)}</p>
                <p className="mt-1 text-xs leading-5 text-[#9f90ac]">Useful baseline for judging whether trading activity alone can fund the platform.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-6">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#9f90ac]">All time</p>
          <h2 className="font-display mt-1 text-2xl font-black">Lifetime market economics</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Deposited capital" value={gbp.format(data.allTime.depositsGbp)} detail={`${data.allTime.depositCount.toLocaleString()} top-ups from ${data.allTime.depositorCount.toLocaleString()} depositors`} icon={Banknote} />
            <MetricCard label="Fee revenue equivalent" value={gbp.format(data.allTime.feeRevenueGbp)} detail={`${compact.format(data.allTime.feeStkz)} STKZ collected in trading fees`} icon={BadgePoundSterling} />
            <MetricCard label="Trade volume" value={`${compact.format(data.allTime.tradeVolumeStkz)} STKZ`} detail={`${data.allTime.trades.toLocaleString()} trades from ${data.allTime.activeTraders.toLocaleString()} traders`} icon={TrendingUp} />
            <MetricCard label="Pack revenue" value={gbp.format(data.allTime.packSalesGbp)} detail={`${data.allTime.packSaleCount.toLocaleString()} paid celebrity-pack unlocks`} icon={Users} />
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/[.035] p-5 sm:p-6">
          <h2 className="font-display text-lg font-black">Valuation assumptions</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
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
              <p className="mt-1 font-black">{data.assumptions.conversionBasis === "realised-deposits" ? "Actual paid top-ups" : "Current store catalogue"}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#9f90ac]">
            This is a commercial simulation, not an accounting statement. It does not yet subtract payment-processing charges, tax, compliance, chargebacks, customer withdrawals, market-making exposure, hosting or data-provider costs.
          </p>
        </section>
      </div>
    </main>
  );
}
