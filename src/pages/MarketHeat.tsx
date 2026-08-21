import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChartNoAxesCombined, Flame, PackageOpen, X } from "lucide-react";
import {
  MarketHeatRadar,
  type HeatMarket,
} from "@/components/MarketHeatRadar";
import { MarketDetailPanel } from "@/components/MarketDetailPanel";
import { TradeControls } from "@/components/TradeControls";
import { WalletBalance } from "@/components/WalletBalance";
import { showError } from "@/utils/toast";

type HeatMarketWithSignals = HeatMarket & {
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
};

export default function MarketHeat() {
  const [markets, setMarkets] = useState<HeatMarketWithSignals[]>([]);
  const [selected, setSelected] = useState<HeatMarketWithSignals | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadMarkets = async () => {
      const response = await fetch("/api/markets", { credentials: "include" });
      if (!response.ok) throw new Error("Could not load the market heat radar.");
      const data = (await response.json()) as { markets: HeatMarketWithSignals[] };
      if (active) setMarkets(data.markets);
    };

    void loadMarkets()
      .catch((error: Error) => showError(error.message))
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const refresh = () => void loadMarkets().catch(() => undefined);
    window.addEventListener("markets:updated", refresh);

    return () => {
      active = false;
      window.removeEventListener("markets:updated", refresh);
    };
  }, []);

  const openTrade = (market: HeatMarket) => {
    const fullMarket = markets.find((item) => item.ticker === market.ticker);
    if (!fullMarket) return;
    setSelected(fullMarket);
    setTradeOpen(true);
  };

  return (
    <main className="min-h-screen bg-[#120b20] text-[#fff8f2]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#120b20]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3.5 sm:px-8 sm:py-5">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="Back to CelebStockz"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#c99bff] transition hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={17} />
            </Link>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]">
              <ChartNoAxesCombined size={19} />
            </div>
            <div>
              <p className="font-display text-base font-black sm:text-lg">
                Celeb<span className="text-[#ff7282]">Stockz</span>
              </p>
              <p className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[.14em] text-[#ff9ca5]">
                <Flame size={10} fill="currentColor" /> Heat Radar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/packs"
              className="hidden items-center gap-1.5 rounded-xl border border-[#ffd17b]/40 bg-[#ffd17b]/15 px-3 py-2 text-xs font-black text-[#ffd17b] hover:bg-[#ffd17b]/25 sm:inline-flex"
            >
              <PackageOpen size={14} /> Packs
            </Link>
            <WalletBalance />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-5 sm:px-8 sm:pt-7 lg:px-10">
        {isLoading ? (
          <div className="grid min-h-[55vh] place-items-center">
            <div className="text-center">
              <Flame className="mx-auto animate-pulse text-[#ff7282]" size={28} fill="currentColor" />
              <p className="mt-3 text-sm font-bold text-[#b9a9c5]">Scanning market heat…</p>
            </div>
          </div>
        ) : (
          <MarketHeatRadar markets={markets} onTrade={openTrade} />
        )}
      </div>

      {tradeOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4">
          <section className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-[32px] border border-white/15 bg-[#211230] p-5 pb-safe shadow-2xl sm:max-h-[90vh] sm:rounded-[30px] sm:p-6">
            <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]">
                    {selected.category} · Practice Market
                  </p>
                  {selected.marketState?.state !== "normal" && (
                    <span
                      className={`rounded-lg px-2 py-1 text-[9px] font-black ${
                        selected.marketState?.state === "viral"
                          ? "bg-[#ffd17b]/15 text-[#ffd17b]"
                          : "bg-[#ff7282]/15 text-[#ff9ca5]"
                      }`}
                    >
                      {selected.marketState?.state === "viral" ? "⚡ VIRAL" : "🔥 HOT"} · {selected.marketState?.heatScore.toFixed(0)}
                    </span>
                  )}
                </div>
                <h2 className="font-display mt-0.5 text-2xl font-black">
                  Trade {selected.ticker}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTradeOpen(false)}
                aria-label="Close trade sheet"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-[#c7b9d1] hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[.04] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#160c25] p-1">
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="h-full w-full object-contain"
                  onError={(event) => {
                    event.currentTarget.src = `/api/celebrity-images/${encodeURIComponent(selected.ticker)}`;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{selected.name}</p>
                <p className="text-xs text-[#9b8ba8]">
                  Heat {selected.marketState?.heatScore.toFixed(0) ?? "0"} · {selected.marketState?.volatilityMultiplier.toFixed(1) ?? "1.0"}× game volatility
                </p>
              </div>
              <p className="text-right text-lg font-black">
                {selected.price.toFixed(2)}
                <span className="ml-1 text-[9px] text-[#9b8ba8]">STKZ</span>
              </p>
            </div>

            <MarketDetailPanel market={selected} />

            <div className="mt-4">
              <TradeControls
                key={selected.ticker}
                ticker={selected.ticker}
                price={selected.price}
                access={selected.access}
                onTradeComplete={() => setTradeOpen(false)}
              />
            </div>

            <p className="mt-4 text-center text-[10px] leading-4 text-[#81738d]">
              Heat indicates elevated attention and volatility, not guaranteed price direction.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
