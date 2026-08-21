import { useMemo, useState } from "react";
import {
  Clock3,
  Flame,
  Lock,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";

export type HeatMarket = CategorizedCelebrity & {
  marketState?: {
    state: "normal" | "hot" | "viral";
    heatScore: number;
    volatilityMultiplier: number;
    reason: string;
    expiresAt: string | null;
  };
};

type HeatFilter = "all" | "warming" | "hot" | "viral";

type HeatRadarProps = {
  markets: HeatMarket[];
  onTrade: (market: HeatMarket) => void;
};

function heatScore(market: HeatMarket) {
  return Math.max(0, Math.min(100, market.marketState?.heatScore ?? 0));
}

function marketHeatState(market: HeatMarket) {
  return market.marketState?.state ?? "normal";
}

function isWarming(market: HeatMarket) {
  return marketHeatState(market) === "normal" && heatScore(market) >= 25;
}

function timeRemaining(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const milliseconds = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;

  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m left` : `${hours}h left`;
}

function badgeFor(market: HeatMarket) {
  const state = marketHeatState(market);
  if (state === "viral") {
    return {
      label: "VIRAL",
      icon: Zap,
      className: "border-[#ffd17b]/40 bg-[#ffd17b]/15 text-[#ffe2a3]",
    };
  }
  if (state === "hot") {
    return {
      label: "HOT",
      icon: Flame,
      className: "border-[#ff7282]/40 bg-[#ff7282]/15 text-[#ffb2bc]",
    };
  }
  if (isWarming(market)) {
    return {
      label: "WARMING",
      icon: TrendingUp,
      className: "border-[#c99bff]/35 bg-[#c99bff]/10 text-[#d9bdff]",
    };
  }
  return null;
}

function heatBarClass(market: HeatMarket) {
  const state = marketHeatState(market);
  if (state === "viral") return "bg-[#ffd17b]";
  if (state === "hot") return "bg-[#ff7282]";
  return "bg-[#a97cff]";
}

function HeatBadge({ market }: { market: HeatMarket }) {
  const badge = badgeFor(market);
  if (!badge) return null;
  const Icon = badge.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black ${badge.className}`}
      title={market.marketState?.reason}
    >
      <Icon size={11} fill={badge.label === "HOT" ? "currentColor" : undefined} />
      {badge.label} · {heatScore(market).toFixed(0)}
    </span>
  );
}

export function MarketHeatPreview({
  markets,
  onTrade,
  onOpenHeat,
}: HeatRadarProps & { onOpenHeat: () => void }) {
  const hottest = useMemo(
    () =>
      [...markets]
        .filter((market) => heatScore(market) >= 25)
        .sort((first, second) => heatScore(second) - heatScore(first))
        .slice(0, 4),
    [markets],
  );

  return (
    <section className="mt-7 rounded-[26px] border border-[#ff7282]/20 bg-gradient-to-br from-[#241135] to-[#1a1027] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.17em] text-[#ff9ca5]">
            <Flame size={13} fill="currentColor" /> Heat Radar
          </p>
          <h2 className="font-display mt-1 text-xl font-black sm:text-2xl">
            Catch the story before the leaderboard.
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#b9a9c5]">
            Heat measures rising real-world attention. HOT and VIRAL markets get extra in-game volatility, so they can become the most chaotic places to trade.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenHeat}
          className="shrink-0 rounded-xl border border-[#ff7282]/30 bg-[#ff7282]/10 px-3 py-2 text-xs font-black text-[#ffb2bc] transition hover:bg-[#ff7282]/20"
        >
          Open radar
        </button>
      </div>

      {hottest.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[.03] p-4 text-xs text-[#9f90ac]">
          No markets are above the warming threshold yet. The radar will populate as real-world momentum observations build.
        </div>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {hottest.map((market) => (
            <button
              key={market.ticker}
              type="button"
              onClick={() => onTrade(market)}
              className="rounded-2xl border border-white/10 bg-white/[.04] p-3 text-left transition hover:border-[#ff7282]/40 hover:bg-white/[.07]"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#160c25] p-1">
                  <img src={market.image} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{market.name}</p>
                  <p className="text-[10px] font-bold text-[#94859f]">${market.ticker}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <HeatBadge market={market} />
                <span className="text-[10px] font-black text-[#d7c9e0]">
                  {market.marketState?.volatilityMultiplier?.toFixed(1) ?? "1.0"}× vol
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function MarketHeatRadar({ markets, onTrade }: HeatRadarProps) {
  const [filter, setFilter] = useState<HeatFilter>("all");

  const counts = useMemo(() => {
    let hot = 0;
    let viral = 0;
    let warming = 0;
    for (const market of markets) {
      const state = marketHeatState(market);
      if (state === "viral") viral += 1;
      else if (state === "hot") hot += 1;
      else if (isWarming(market)) warming += 1;
    }
    return { hot, viral, warming };
  }, [markets]);

  const visible = useMemo(() => {
    return [...markets]
      .filter((market) => {
        const state = marketHeatState(market);
        if (filter === "viral") return state === "viral";
        if (filter === "hot") return state === "hot";
        if (filter === "warming") return isWarming(market);
        return true;
      })
      .sort((first, second) => {
        const scoreDifference = heatScore(second) - heatScore(first);
        if (scoreDifference !== 0) return scoreDifference;
        return Math.abs(second.change) - Math.abs(first.change);
      })
      .slice(0, filter === "all" ? 50 : 100);
  }, [filter, markets]);

  const hottestScore = markets.reduce(
    (maximum, market) => Math.max(maximum, heatScore(market)),
    0,
  );

  const filters: Array<{ id: HeatFilter; label: string; count?: number }> = [
    { id: "all", label: "Top heat" },
    { id: "warming", label: "Warming", count: counts.warming },
    { id: "hot", label: "HOT", count: counts.hot },
    { id: "viral", label: "VIRAL", count: counts.viral },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#ff9ca5]">
            <Flame size={14} fill="currentColor" /> Market Heat
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Find the next chaotic market.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8a9c4]">
            Heat scores rising public attention from 0–100. It does not predict whether a price goes up or down — it tells you where the game is likely to become more volatile.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
          <div className="rounded-xl border border-[#c99bff]/20 bg-[#c99bff]/10 p-3 text-center">
            <p className="text-lg font-black text-[#d9bdff]">{counts.warming}</p>
            <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#9f90ac]">Warming</p>
          </div>
          <div className="rounded-xl border border-[#ff7282]/25 bg-[#ff7282]/10 p-3 text-center">
            <p className="text-lg font-black text-[#ff9ca5]">{counts.hot}</p>
            <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#9f90ac]">Hot</p>
          </div>
          <div className="rounded-xl border border-[#ffd17b]/25 bg-[#ffd17b]/10 p-3 text-center">
            <p className="text-lg font-black text-[#ffd17b]">{counts.viral}</p>
            <p className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#9f90ac]">Viral</p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#9f90ac]">Current radar peak</p>
            <p className="mt-1 text-2xl font-black">{hottestScore.toFixed(0)} / 100</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                  filter === item.id
                    ? "bg-[#7c3aed] text-white"
                    : "border border-white/10 bg-white/[.03] text-[#b9acc9] hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}{item.count !== undefined ? ` · ${item.count}` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/15 bg-white/[.03] p-8 text-center text-sm text-[#b9acc9]">
          No markets currently match this heat state.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((market, index) => {
            const state = marketHeatState(market);
            const score = heatScore(market);
            const isLocked = Boolean(market.access && !market.access.isUnlocked);
            const expiry = timeRemaining(market.marketState?.expiresAt);

            return (
              <article
                key={market.ticker}
                className={`overflow-hidden rounded-[24px] border bg-[#1e112f] ${
                  state === "viral"
                    ? "border-[#ffd17b]/35"
                    : state === "hot"
                      ? "border-[#ff7282]/30"
                      : "border-white/10"
                }`}
              >
                <div className="flex gap-3 p-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#160c25] p-1.5">
                    <img
                      src={market.image}
                      alt={market.name}
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.src = `/api/celebrity-images/${encodeURIComponent(market.ticker)}`;
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-black">{market.name}</p>
                        <p className="text-xs font-bold text-[#94859f]">${market.ticker} · {market.category}</p>
                      </div>
                      <span className="text-xs font-black text-[#8f819b]">#{index + 1}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <HeatBadge market={market} />
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#ff7282]/10 px-2 py-1 text-[10px] font-black text-[#ff9ca5]">
                          <Lock size={10} /> PACK LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#9f90ac]">Heat score</p>
                      <p className="mt-0.5 text-3xl font-black">{score.toFixed(0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-[#9f90ac]">Game volatility</p>
                      <p className="mt-0.5 text-xl font-black text-[#d9bdff]">{market.marketState?.volatilityMultiplier?.toFixed(1) ?? "1.0"}×</p>
                    </div>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${heatBarClass(market)}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>

                  <p className="mt-3 min-h-10 text-xs leading-5 text-[#c7b8d2]">
                    {market.marketState?.reason ?? "Real-world attention is within its normal range."}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                    <div>
                      <p className="text-lg font-black">{market.price.toFixed(2)} <span className="text-[10px] text-[#9f90ac]">STKZ</span></p>
                      <p className={`text-[10px] font-black ${market.change >= 0 ? "text-[#62e7b6]" : "text-[#ff9ca5]"}`}>
                        {market.change >= 0 ? "+" : ""}{market.change.toFixed(1)}% today
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {expiry && (
                        <span className="hidden items-center gap-1 text-[10px] font-bold text-[#9f90ac] sm:inline-flex">
                          <Clock3 size={11} /> {expiry}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onTrade(market)}
                        className="rounded-xl bg-[#7c3aed] px-3.5 py-2 text-xs font-black text-white transition hover:bg-[#9361f5]"
                      >
                        {isLocked ? "View pack" : "Trade"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
