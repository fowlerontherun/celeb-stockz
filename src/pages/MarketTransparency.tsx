import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { MarketDetailPanel } from "@/components/MarketDetailPanel";
import { showError } from "@/utils/toast";

type Market = {
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
  snapshot?: {
    capturedAt: string | null;
    refreshStatus: "verified" | "fallback";
    movementReason: string;
  };
};

export default function MarketTransparency() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");

  useEffect(() => {
    void fetch("/api/markets", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load market data.");
        return response.json() as Promise<{ markets: Market[] }>;
      })
      .then((data) => {
        setMarkets(data.markets);
        setSelectedTicker(data.markets[0]?.ticker ?? "");
      })
      .catch((error: Error) => showError(error.message));
  }, []);

  const selected = markets.find((market) => market.ticker === selectedTicker);

  if (!selected) {
    return <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]"><LoaderCircle className="animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#c99bff] hover:text-white"><ArrowLeft size={16} /> Back to markets</Link>
        <p className="mt-8 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">Open methodology</p>
        <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">Market data, explained.</h1>
        <p className="mt-3 text-sm leading-6 text-[#c4b4d0]">Inspect the saved signals behind every eligible STKZ practice market.</p>

        <label className="mt-7 block text-xs font-extrabold uppercase tracking-[.14em] text-[#b9a9c5]">
          Select a market
          <select value={selectedTicker} onChange={(event) => setSelectedTicker(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#a97cff]">
            {markets.map((market) => <option key={market.ticker} value={market.ticker}>{market.name} · {market.ticker}</option>)}
          </select>
        </label>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <p className="font-display text-2xl font-black">{selected.name}</p>
          <p className="mt-1 text-sm text-[#b9a9c5]">${selected.ticker} · {selected.price.toFixed(2)} STKZ</p>
          <MarketDetailPanel market={selected} />
        </section>
      </div>
    </main>
  );
}