import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, TrendingUp } from "lucide-react";
import { PriceChart } from "@/components/PriceChart";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";

type TopMoversProps = {
  markets: CategorizedCelebrity[];
  onTrade: (market: CategorizedCelebrity) => void;
};

export function TopMovers({ markets, onTrade }: TopMoversProps) {
  const [view, setView] = useState<"winners" | "losers">("winners");

  const movers = useMemo(
    () =>
      [...markets]
        .sort((first, second) =>
          view === "winners"
            ? second.change - first.change
            : first.change - second.change,
        )
        .slice(0, 40),
    [markets, view],
  );

  const isWinners = view === "winners";

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            <TrendingUp size={14} />
            Market momentum
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Top 40 movers.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8a9c4]">
            See which celebrity markets have moved the most in the current
            modeled pricing cycle.
          </p>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-[#b9a9c5]">
          {markets.length} tracked markets
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-1.5 sm:max-w-md">
        <button
          type="button"
          onClick={() => setView("winners")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            isWinners
              ? "bg-[#3ed9a3] text-[#112b24]"
              : "text-[#a99ab7] hover:bg-white/5 hover:text-white"
          }`}
        >
          <ArrowUpRight size={17} />
          Winners
        </button>
        <button
          type="button"
          onClick={() => setView("losers")}
          className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
            !isWinners
              ? "bg-[#ff7282] text-[#401b2d]"
              : "text-[#a99ab7] hover:bg-white/5 hover:text-white"
          }`}
        >
          <ArrowDownRight size={17} />
          Losers
        </button>
      </div>

      <section className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-[#1e112f]">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#95869f] sm:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_5.5rem]">
          <span>#</span>
          <span>Market</span>
          <span className="hidden sm:block">Trend</span>
          <span className="hidden text-right sm:block">Price</span>
          <span className="text-right">Move</span>
        </div>

        {movers.map((market, index) => {
          const positive = market.change >= 0;

          return (
            <article
              key={market.ticker}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_5.5rem]"
            >
              <span className="font-display text-sm font-black text-[#8c7b9a]">
                {index + 1}
              </span>

              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#160c25] p-1">
                  <img
                    src={market.image}
                    alt={market.name}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{market.name}</p>
                  <p className="mt-0.5 text-xs font-bold text-[#9f90ac]">
                    ${market.ticker} · {market.category}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block">
                <PriceChart
                  price={market.price}
                  change={market.change}
                  ticker={`mover-${market.ticker}`}
                />
              </div>

              <p className="hidden text-right text-sm font-black sm:block">
                {market.price.toFixed(2)}
                <span className="ml-1 text-[10px] text-[#9f90ac]">STKZ</span>
              </p>

              <div className="flex items-center justify-end gap-2">
                <span
                  className={`rounded-lg px-2 py-1.5 text-xs font-black ${
                    positive
                      ? "bg-[#183b33] text-[#62e7b6]"
                      : "bg-[#482332] text-[#ff9ca5]"
                  }`}
                >
                  {positive ? "+" : ""}
                  {market.change.toFixed(1)}%
                </span>
                <button
                  type="button"
                  onClick={() => onTrade(market)}
                  className="hidden rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black transition hover:bg-white/10 sm:inline-flex"
                >
                  Trade
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}