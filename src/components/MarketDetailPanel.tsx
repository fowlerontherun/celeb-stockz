import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flame,
  LoaderCircle,
  Lock,
  PackageOpen,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { showError, showSuccess } from "@/utils/toast";

type HistoryPoint = {
  capturedAt: string;
  price: number;
};

type DetailResponse = {
  bio: string;
  description: string;
  image: string | null;
  history: HistoryPoint[];
};

type MarketDetail = {
  name: string;
  ticker: string;
  price: number;
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
  access?: {
    isStandard: boolean;
    isUnlocked: boolean;
    requiredPacks: Array<{ id: number; name: string }>;
  };
  marketState?: {
    state: "normal" | "hot" | "viral";
    heatScore: number;
    volatilityMultiplier: number;
    reason: string;
    expiresAt: string | null;
  };
  snapshot?: {
    capturedAt: string | null;
    refreshStatus: "verified" | "fallback";
    movementReason: string;
  };
};

type Range = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

const ranges: Array<{ label: Range; hours: number | null }> = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "1D", hours: 24 },
  { label: "1W", hours: 168 },
  { label: "1M", hours: 720 },
  { label: "ALL", hours: null },
];

function percentChange(points: HistoryPoint[], currentPrice: number) {
  const first = points[0]?.price;
  if (!first || first <= 0) return null;
  return ((currentPrice - first) / first) * 100;
}

export function MarketDetailPanel({ market }: { market: MarketDetail }) {
  const [range, setRange] = useState<Range>("1D");
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    void fetch(`/api/markets/${market.ticker}/detail`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Market detail unavailable");
        return response.json() as Promise<DetailResponse>;
      })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active) setDetail(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [market.ticker]);

  const handleQuickPackUnlock = async (packId: number, packName: string) => {
    setIsUnlocking(true);
    try {
      const response = await fetch(`/api/packs/${packId}/unlock`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not unlock pack.");
      }

      showSuccess(`🎉 Unlocked ${packName}! You can now trade ${market.name} and all other pack markets.`);
      window.dispatchEvent(new Event("markets:updated"));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not unlock pack.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const selectedRange = ranges.find((item) => item.label === range)!;
  const points = useMemo(() => {
    const history = detail?.history ?? [];
    if (!selectedRange.hours) return history;

    const cutoff = Date.now() - selectedRange.hours * 60 * 60 * 1000;
    return history.filter(
      (point) => new Date(point.capturedAt).getTime() >= cutoff,
    );
  }, [detail?.history, selectedRange.hours]);

  const chartData = useMemo(
    () =>
      [...points, { capturedAt: new Date().toISOString(), price: market.price }]
        .filter(
          (point, index, all) =>
            index === 0 ||
            point.price !== all[index - 1].price ||
            index === all.length - 1,
        )
        .map((point) => ({
          time: new Intl.DateTimeFormat([], {
            hour: "2-digit",
            minute: "2-digit",
            month: range === "1M" || range === "ALL" ? "short" : undefined,
            day: range === "1W" || range === "1M" || range === "ALL" ? "numeric" : undefined,
          }).format(new Date(point.capturedAt)),
          price: point.price,
        })),
    [market.price, points, range],
  );

  const change = percentChange(points, market.price);
  const verified = market.snapshot?.refreshStatus === "verified";
  const refreshedAt = market.snapshot?.capturedAt
    ? new Intl.DateTimeFormat([], {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(market.snapshot.capturedAt))
    : "Awaiting first verified refresh";

  const requiredPacks = market.access?.requiredPacks ?? [];
  const isLocked = Boolean(market.access && !market.access.isUnlocked);
  const isPackExclusive = requiredPacks.length > 0;
  const heatState = market.marketState?.state ?? "normal";
  const heatActive = heatState === "hot" || heatState === "viral";

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4">
      {isPackExclusive && (
        <div
          className={`mb-4 rounded-xl border p-3.5 ${
            isLocked
              ? "border-[#ff7282]/30 bg-[#2d1428]"
              : "border-[#62e7b6]/30 bg-[#162925]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`grid h-8 w-8 place-items-center rounded-lg ${
                  isLocked ? "bg-[#ff7282]/20 text-[#ff9ca5]" : "bg-[#62e7b6]/20 text-[#62e7b6]"
                }`}
              >
                {isLocked ? <Lock size={15} /> : <CheckCircle2 size={15} />}
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                  Celebrity Pack Affiliation
                </p>
                <p className="text-xs font-bold text-white">
                  {requiredPacks.map((p) => p.name).join(", ")}
                </p>
              </div>
            </div>

            {isLocked ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isUnlocking}
                  onClick={() => void handleQuickPackUnlock(requiredPacks[0].id, requiredPacks[0].name)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#ffd17b] px-3 py-1.5 text-xs font-black text-[#3d2a00] hover:bg-[#ffe29c] disabled:opacity-50"
                >
                  {isUnlocking ? <LoaderCircle size={13} className="animate-spin" /> : <Zap size={13} />}
                  Unlock (£1.99)
                </button>
                <Link
                  to="/packs"
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-[#c99bff] hover:bg-white/10 hover:text-white"
                >
                  <PackageOpen size={13} className="inline mr-1" />
                  View All
                </Link>
              </div>
            ) : (
              <span className="rounded-lg bg-[#62e7b6]/20 px-2.5 py-1 text-[10px] font-black text-[#62e7b6]">
                ✓ PACK UNLOCKED
              </span>
            )}
          </div>
        </div>
      )}

      {heatActive && (
        <div
          className={`mb-4 rounded-xl border p-3.5 ${
            heatState === "viral"
              ? "border-[#ffd17b]/40 bg-[#3a2b13]"
              : "border-[#ff7a32]/35 bg-[#341d18]"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  heatState === "viral"
                    ? "bg-[#ffd17b]/20 text-[#ffd17b]"
                    : "bg-[#ff7a32]/20 text-[#ff9a5c]"
                }`}
              >
                {heatState === "viral" ? <Zap size={18} /> : <Flame size={18} />}
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#ffcb8c]">
                  {heatState === "viral" ? "Viral market" : "Hot market"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#f4dfcf]">
                  {market.marketState?.reason}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-black text-white">
                {Math.round(market.marketState?.heatScore ?? 0)}
                <span className="ml-1 text-[10px] text-[#cdb9aa]">/100</span>
              </p>
              <p className="text-[10px] font-black text-[#ffcb8c]">
                {(market.marketState?.volatilityMultiplier ?? 1).toFixed(1)}× game volatility
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={verified ? "text-[#62e7b6]" : "text-[#ffd17b]"}>
          {verified ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
            Market insight
          </p>
          <p className="mt-1 text-xs leading-5 text-[#d6c6e1]">
            {market.snapshot?.movementReason ??
              "This price is waiting for its first approved snapshot."}
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-[#160c25] p-1">
        {ranges.map(({ label }) => (
          <button
            key={label}
            type="button"
            onClick={() => setRange(label)}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-black transition ${
              range === label
                ? "bg-[#7c3aed] text-white"
                : "text-[#a99ab7] hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-[#160c25] p-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#a99ab7]">
            {range} price change
          </p>
          <p
            className={`text-sm font-black ${
              change === null
                ? "text-[#a99ab7]"
                : change >= 0
                  ? "text-[#62e7b6]"
                  : "text-[#ff9ca5]"
            }`}
          >
            {change === null ? "Building history" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
          </p>
        </div>

        {isLoading ? (
          <div className="grid h-28 place-items-center">
            <LoaderCircle className="animate-spin text-[#c99bff]" size={20} />
          </div>
        ) : chartData.length < 2 ? (
          <div className="grid h-28 place-items-center text-center text-xs text-[#a99ab7]">
            More snapshots are needed for this period.
          </div>
        ) : (
          <div className="mt-2 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={`detail-chart-${market.ticker}`} x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={change !== null && change < 0 ? "#ff7282" : "#62e7b6"}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={change !== null && change < 0 ? "#ff7282" : "#62e7b6"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "#211230",
                    border: "1px solid rgba(255,255,255,.12)",
                    borderRadius: 10,
                    color: "#fff8f2",
                    fontSize: 11,
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} STKZ`, "Price"]}
                  labelFormatter={() => "Recorded market price"}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={change !== null && change < 0 ? "#ff7282" : "#62e7b6"}
                  strokeWidth={2}
                  fill={`url(#detail-chart-${market.ticker})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {detail?.bio && (
        <article className="mt-4 rounded-xl bg-white/[.04] p-3">
          <div className="flex gap-3">
            {detail.image && (
              <img
                src={detail.image}
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            )}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#c99bff]">
                {detail.description}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#d6c6e1]">
                {detail.bio}
              </p>
            </div>
          </div>
        </article>
      )}

      <p className="mt-4 flex items-center gap-2 text-[11px] font-bold text-[#b9a9c5]">
        <Clock3 size={13} /> Latest verified public-signal refresh: {refreshedAt}
      </p>
      <a
        href={`https://en.wikipedia.org/wiki/${encodeURIComponent(
          market.name.replace(/ /g, "_"),
        )}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#c99bff] hover:text-white"
      >
        View Wikipedia source <ExternalLink size={12} />
      </a>
    </section>
  );
}
