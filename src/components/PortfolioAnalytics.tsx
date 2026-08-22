import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Gauge,
  Layers3,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";

export type PortfolioHolding = {
  ticker: string;
  quantity: number;
  averageCost: number;
  market: CategorizedCelebrity;
};

type HistoryPoint = {
  capturedAt: string;
  price: number;
};

type RangeKey = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";
type ChartMode = "value" | "return";

const ranges: Array<{ key: RangeKey; ms: number | null }> = [
  { key: "1D", ms: 24 * 60 * 60 * 1000 },
  { key: "1W", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "1M", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "3M", ms: 90 * 24 * 60 * 60 * 1000 },
  { key: "1Y", ms: 365 * 24 * 60 * 60 * 1000 },
  { key: "ALL", ms: null },
];

const pieColors = ["#00d4a0", "#4da3ff", "#20d997", "#f4c95d", "#7bb8ff", "#49e0bd", "#87a6ff", "#8be3ff"];

function money(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function compact(value: number) {
  return value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
}

export function PortfolioAnalytics({ holdings, balanceStkz }: { holdings: PortfolioHolding[]; balanceStkz: number }) {
  const [range, setRange] = useState<RangeKey>("1M");
  const [chartMode, setChartMode] = useState<ChartMode>("value");
  const [historyByTicker, setHistoryByTicker] = useState<Record<string, HistoryPoint[]>>({});

  useEffect(() => {
    if (holdings.length === 0) {
      setHistoryByTicker({});
      return;
    }

    let active = true;
    void Promise.all(
      holdings.map(async ({ ticker }) => {
        try {
          const response = await fetch(`/api/markets/${ticker}/history`, { credentials: "include" });
          if (!response.ok) return [ticker, []] as const;
          const data = (await response.json()) as { history?: HistoryPoint[] };
          return [ticker, data.history ?? []] as const;
        } catch {
          return [ticker, []] as const;
        }
      }),
    ).then((entries) => {
      if (active) setHistoryByTicker(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [holdings]);

  const investedValue = useMemo(() => holdings.reduce((sum, holding) => sum + holding.quantity * holding.market.price, 0), [holdings]);
  const costBasis = useMemo(() => holdings.reduce((sum, holding) => sum + holding.quantity * holding.averageCost, 0), [holdings]);
  const totalPnl = investedValue - costBasis;
  const totalPnlPct = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;
  const netWorth = balanceStkz + investedValue;

  const dailyPnl = useMemo(
    () => holdings.reduce((sum, holding) => {
      const move = holding.market.change / 100;
      const previousPrice = move <= -1 ? holding.market.price : holding.market.price / (1 + move);
      return sum + holding.quantity * (holding.market.price - previousPrice);
    }, 0),
    [holdings],
  );
  const previousPortfolioValue = investedValue - dailyPnl;
  const dailyPnlPct = previousPortfolioValue > 0 ? (dailyPnl / previousPortfolioValue) * 100 : 0;

  const holdingStats = useMemo(
    () => holdings
      .map((holding) => {
        const value = holding.quantity * holding.market.price;
        const pnl = holding.quantity * (holding.market.price - holding.averageCost);
        const pnlPct = holding.averageCost > 0 ? ((holding.market.price - holding.averageCost) / holding.averageCost) * 100 : 0;
        return { ...holding, value, pnl, pnlPct };
      })
      .sort((a, b) => b.value - a.value),
    [holdings],
  );

  const best = holdingStats.length ? [...holdingStats].sort((a, b) => b.pnlPct - a.pnlPct)[0] : null;
  const worst = holdingStats.length ? [...holdingStats].sort((a, b) => a.pnlPct - b.pnlPct)[0] : null;
  const topContributor = holdingStats.length ? [...holdingStats].sort((a, b) => b.pnl - a.pnl)[0] : null;
  const allocation = holdingStats.map((holding) => ({ name: holding.ticker, value: holding.value }));

  const categoryExposure = useMemo(() => {
    const grouped = new Map<string, number>();
    holdingStats.forEach((holding) => grouped.set(holding.market.category, (grouped.get(holding.market.category) ?? 0) + holding.value));
    return [...grouped.entries()].map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
  }, [holdingStats]);

  const pnlBars = holdingStats.map((holding) => ({ ticker: holding.ticker, pnl: Number(holding.pnl.toFixed(2)) })).sort((a, b) => b.pnl - a.pnl);

  const performanceData = useMemo(() => {
    const selected = ranges.find((item) => item.key === range);
    const cutoff = selected?.ms ? Date.now() - selected.ms : Number.NEGATIVE_INFINITY;
    const timestampSet = new Set<number>();

    Object.values(historyByTicker).forEach((series) => {
      series.forEach((point) => {
        const timestamp = new Date(point.capturedAt).getTime();
        if (Number.isFinite(timestamp) && timestamp >= cutoff) timestampSet.add(timestamp);
      });
    });

    const timestamps = [...timestampSet].sort((a, b) => a - b);
    if (timestamps.length === 0) return [];
    const step = Math.max(1, Math.ceil(timestamps.length / 90));
    const sampled = timestamps.filter((_, index) => index % step === 0 || index === timestamps.length - 1);

    const rawPoints = sampled.map((timestamp) => {
      const invested = holdings.reduce((sum, holding) => {
        const series = historyByTicker[holding.ticker] ?? [];
        let historicalPrice = holding.market.price;
        for (let index = series.length - 1; index >= 0; index -= 1) {
          if (new Date(series[index].capturedAt).getTime() <= timestamp) {
            historicalPrice = series[index].price;
            break;
          }
        }
        return sum + holding.quantity * historicalPrice;
      }, 0);

      return {
        timestamp,
        label: new Intl.DateTimeFormat([], {
          month: "short",
          day: "numeric",
          ...(range === "1D" ? { hour: "2-digit", minute: "2-digit" } : {}),
        }).format(new Date(timestamp)),
        value: Number((balanceStkz + invested).toFixed(2)),
      };
    });

    const base = rawPoints[0]?.value ?? 0;
    return rawPoints.map((point) => ({ ...point, returnPct: base > 0 ? Number((((point.value - base) / base) * 100).toFixed(3)) : 0 }));
  }, [balanceStkz, historyByTicker, holdings, range]);

  const chartChange = performanceData.length >= 2 ? performanceData[performanceData.length - 1].value - performanceData[0].value : 0;
  const chartChangePct = performanceData.length >= 2 && performanceData[0].value > 0 ? (chartChange / performanceData[0].value) * 100 : 0;
  const chartPositive = chartChange >= 0;

  const tradingStats = useMemo(() => {
    let highWater = Number.NEGATIVE_INFINITY;
    let maxDrawdown = 0;
    const movements: number[] = [];

    performanceData.forEach((point, index) => {
      highWater = Math.max(highWater, point.value);
      if (highWater > 0) maxDrawdown = Math.min(maxDrawdown, ((point.value - highWater) / highWater) * 100);
      if (index > 0 && performanceData[index - 1].value > 0) movements.push(((point.value - performanceData[index - 1].value) / performanceData[index - 1].value) * 100);
    });

    const meanMovement = movements.length ? movements.reduce((sum, value) => sum + value, 0) / movements.length : 0;
    const movementVolatility = movements.length ? Math.sqrt(movements.reduce((sum, value) => sum + (value - meanMovement) ** 2, 0) / movements.length) : 0;
    const profitablePositions = holdingStats.filter((holding) => holding.pnl > 0).length;
    const winRate = holdingStats.length ? (profitablePositions / holdingStats.length) * 100 : 0;
    const topWeight = investedValue > 0 && holdingStats[0] ? (holdingStats[0].value / investedValue) * 100 : 0;
    const cashWeight = netWorth > 0 ? (balanceStkz / netWorth) * 100 : 0;

    return { maxDrawdown, movementVolatility, winRate, topWeight, cashWeight };
  }, [balanceStkz, holdingStats, investedValue, netWorth, performanceData]);

  const tooltipStyle = {
    background: "#10151d",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 8,
    color: "#f4f7fa",
    fontSize: 11,
  };
  const chartDataKey = chartMode === "value" ? "value" : "returnPct";
  const firstChartValue = performanceData[0]?.value ?? 0;

  return (
    <div className="mt-7 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Portfolio value" icon={Wallet} value={`${money(netWorth)} STKZ`} detail={`${money(dailyPnl)} today · ${percent(dailyPnlPct)}`} detailPositive={dailyPnl >= 0} />
        <KpiCard label="Invested" icon={Layers3} value={`${money(investedValue)} STKZ`} detail={`${holdings.length} open ${holdings.length === 1 ? "position" : "positions"}`} />
        <KpiCard label="Available cash" icon={CircleDollarSign} value={`${money(balanceStkz)} STKZ`} detail={`${tradingStats.cashWeight.toFixed(0)}% of portfolio uninvested`} />
        <KpiCard label="Unrealised P&L" icon={totalPnl >= 0 ? TrendingUp : TrendingDown} value={`${totalPnl >= 0 ? "+" : ""}${money(totalPnl)} STKZ`} detail={`${percent(totalPnlPct)} vs average buy`} detailPositive={totalPnl >= 0} valuePositive={totalPnl >= 0} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_.8fr]">
        <div className="terminal-panel p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="terminal-label">Performance terminal</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2"><p className="font-data text-2xl font-bold">{money(netWorth)} STKZ</p>{performanceData.length >= 2 && <span className={`font-data text-xs font-bold ${chartPositive ? "text-[#20d997]" : "text-[#ff5263]"}`}>{percent(chartChangePct)} · {range}</span>}</div>
              <p className="mt-1 text-[11px] text-[#727e8e]">Current positions replayed against saved market snapshots. Use Return to compare percentage movement cleanly.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg border border-white/[.08] bg-[#0c1118] p-1">
                {(["value", "return"] as ChartMode[]).map((mode) => <button key={mode} type="button" onClick={() => setChartMode(mode)} className={`rounded-md px-3 py-1.5 text-[10px] font-bold capitalize transition ${chartMode === mode ? "bg-[#1b2430] text-white" : "text-[#727e8e] hover:text-white"}`}>{mode}</button>)}
              </div>
              <div className="flex flex-wrap gap-1.5">{ranges.map((item) => <button key={item.key} type="button" onClick={() => setRange(item.key)} className={`rounded-md px-2.5 py-1.5 text-[10px] font-bold transition ${range === item.key ? "bg-[#00d4a0] text-[#06120f]" : "border border-white/[.07] bg-[#0c1118] text-[#8993a4] hover:bg-[#151c25]"}`}>{item.key}</button>)}</div>
            </div>
          </div>

          <div className="mt-4 h-[300px]">
            {performanceData.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                  <defs><linearGradient id="portfolio-performance" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={chartPositive ? "#20d997" : "#ff5263"} stopOpacity={0.24} /><stop offset="100%" stopColor={chartPositive ? "#20d997" : "#ff5263"} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="rgba(255,255,255,.045)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#657082", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={36} />
                  <YAxis tick={{ fill: "#657082", fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(value) => chartMode === "value" ? compact(Number(value)) : `${Number(value).toFixed(1)}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => chartMode === "value" ? [`${money(value)} STKZ`, "Portfolio"] : [`${percent(value)}`, "Return"]} labelStyle={{ color: "#a8b2c0" }} />
                  <ReferenceLine y={chartMode === "value" ? firstChartValue : 0} stroke="rgba(255,255,255,.14)" strokeDasharray="4 5" />
                  <Area type="monotone" dataKey={chartDataKey} stroke={chartPositive ? "#20d997" : "#ff5263"} strokeWidth={2.25} fill="url(#portfolio-performance)" dot={false} activeDot={{ r: 4 }} />
                  <Brush dataKey="label" height={20} travellerWidth={7} stroke="#00d4a0" fill="#0c1118" tickFormatter={() => ""} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center rounded-lg border border-dashed border-white/[.08] bg-[#0c1118] text-center"><div><LineChartFallback /><p className="mt-3 text-sm font-bold text-[#a8b2c0]">Portfolio history is building</p><p className="mt-1 text-xs text-[#657082]">The chart will fill as saved celebrity price snapshots accumulate.</p></div></div>}
          </div>
        </div>

        <div className="terminal-panel p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="terminal-label">Allocation by market</p><h3 className="font-display mt-1 text-lg font-bold">Capital concentration</h3></div><Gauge size={18} className="text-[#4da3ff]" /></div>
          {allocation.length ? <><div className="mt-3 h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius={48} outerRadius={76} paddingAngle={2}>{allocation.map((item, index) => <Cell key={item.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${money(value)} STKZ`, "Value"]} /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-2">{allocation.slice(0, 6).map((item, index) => <div key={item.name} className="flex items-center justify-between gap-2 rounded-md border border-white/[.04] bg-[#0c1118] px-2.5 py-2 text-[10px]"><span className="flex min-w-0 items-center gap-2 font-bold"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} /><span className="truncate">{item.name}</span></span><span className="font-data text-[#8993a4]">{investedValue > 0 ? ((item.value / investedValue) * 100).toFixed(0) : 0}%</span></div>)}</div></> : <div className="mt-4 rounded-lg border border-dashed border-white/[.08] p-6 text-center text-xs text-[#727e8e]">Buy your first celebrity shares to see allocation.</div>}
        </div>
      </section>

      <section className="terminal-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="terminal-label">Trading desk stats</p><h3 className="font-display mt-1 text-lg font-bold">Risk, concentration & hit rate</h3></div><p className="max-w-xl text-[10px] leading-4 text-[#657082]">Snapshot analytics use your current positions and available saved prices. They are gameplay diagnostics, not investment-risk calculations.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <DeskStat icon={ShieldAlert} label="Max drawdown" value={performanceData.length > 1 ? `${tradingStats.maxDrawdown.toFixed(2)}%` : "—"} detail={`${range} replay`} negative={tradingStats.maxDrawdown < -10} />
          <DeskStat icon={Activity} label="Movement volatility" value={performanceData.length > 2 ? `${tradingStats.movementVolatility.toFixed(2)}%` : "—"} detail="Between snapshots" />
          <DeskStat icon={Layers3} label="Top holding" value={holdings.length ? `${tradingStats.topWeight.toFixed(0)}%` : "—"} detail={holdingStats[0]?.ticker ?? "No positions"} negative={tradingStats.topWeight > 50} />
          <DeskStat icon={Sparkles} label="Profitable positions" value={holdings.length ? `${tradingStats.winRate.toFixed(0)}%` : "—"} detail={`${holdingStats.filter((item) => item.pnl > 0).length}/${holdingStats.length} above cost`} />
          <DeskStat icon={CircleDollarSign} label="Cash weight" value={`${tradingStats.cashWeight.toFixed(0)}%`} detail={`${categoryExposure.length} categories held`} />
        </div>
        {topContributor && <div className="mt-3 rounded-lg border border-white/[.05] bg-[#0c1118] px-3 py-2 text-[11px] text-[#8993a4]">Biggest current P&L contributor: <strong className={topContributor.pnl >= 0 ? "text-[#20d997]" : "text-[#ff5263]"}>{topContributor.ticker} {topContributor.pnl >= 0 ? "+" : ""}{money(topContributor.pnl)} STKZ</strong></div>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="terminal-panel p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3"><div><p className="terminal-label">Position performance</p><h3 className="font-display mt-1 text-lg font-bold">Profit & loss by celebrity</h3></div>{best && <span className="text-right text-[10px] text-[#8993a4]">Best <strong className="block text-[#20d997]">{best.ticker} {percent(best.pnlPct)}</strong></span>}</div>
          <div className="mt-4 h-[230px]">{pnlBars.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={pnlBars} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.045)" horizontal={false} /><XAxis type="number" tick={{ fill: "#657082", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis dataKey="ticker" type="category" tick={{ fill: "#a8b2c0", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={72} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value >= 0 ? "+" : ""}${money(value)} STKZ`, "P&L"]} /><ReferenceLine x={0} stroke="rgba(255,255,255,.14)" /><Bar dataKey="pnl" radius={[0, 4, 4, 0]}>{pnlBars.map((item) => <Cell key={item.ticker} fill={item.pnl >= 0 ? "#20d997" : "#ff5263"} />)}</Bar></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-xs text-[#727e8e]">No open positions yet.</div>}</div>
        </div>

        <div className="terminal-panel p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3"><div><p className="terminal-label">Diversification</p><h3 className="font-display mt-1 text-lg font-bold">Category exposure</h3></div>{worst && <span className="text-right text-[10px] text-[#8993a4]">Weakest <strong className={`block ${worst.pnlPct >= 0 ? "text-[#20d997]" : "text-[#ff5263]"}`}>{worst.ticker} {percent(worst.pnlPct)}</strong></span>}</div>
          <div className="mt-4 h-[230px]">{categoryExposure.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={categoryExposure} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}><CartesianGrid stroke="rgba(255,255,255,.045)" vertical={false} /><XAxis dataKey="category" tick={{ fill: "#8993a4", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#657082", fontSize: 10 }} axisLine={false} tickLine={false} width={56} tickFormatter={(value) => compact(Number(value))} /><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${money(value)} STKZ`, "Exposure"]} /><Bar dataKey="value" fill="#4da3ff" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-xs text-[#727e8e]">Category exposure appears once you hold shares.</div>}</div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, icon: Icon, value, detail, detailPositive, valuePositive }: { label: string; icon: typeof Wallet; value: string; detail: string; detailPositive?: boolean; valuePositive?: boolean }) {
  return (
    <div className="terminal-panel p-4">
      <div className="flex items-center justify-between text-[#8993a4]"><span className="terminal-label">{label}</span><Icon size={16} /></div>
      <p className={`font-data mt-3 text-2xl font-bold ${valuePositive === true ? "text-[#20d997]" : valuePositive === false ? "text-[#ff5263]" : "text-[#f4f7fa]"}`}>{value}</p>
      <p className={`font-data mt-2 inline-flex items-center gap-1 text-xs font-semibold ${detailPositive === true ? "text-[#20d997]" : detailPositive === false ? "text-[#ff5263]" : "text-[#8993a4]"}`}>{detailPositive === true ? <ArrowUpRight size={14} /> : detailPositive === false ? <ArrowDownRight size={14} /> : null}{detail}</p>
    </div>
  );
}

function DeskStat({ icon: Icon, label, value, detail, negative = false }: { icon: typeof Activity; label: string; value: string; detail: string; negative?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[.06] bg-[#0c1118] p-3.5">
      <div className="flex items-center justify-between text-[#727e8e]"><span className="terminal-label text-[9px]">{label}</span><Icon size={14} /></div>
      <p className={`font-data mt-3 text-lg font-bold ${negative ? "text-[#ff5263]" : "text-[#f4f7fa]"}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold text-[#657082]">{detail}</p>
    </div>
  );
}

function LineChartFallback() {
  return <svg aria-hidden="true" viewBox="0 0 88 42" className="mx-auto h-10 w-20 text-[#00d4a0]"><path d="M3 35 20 25l15 5 18-18 12 7L85 5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}