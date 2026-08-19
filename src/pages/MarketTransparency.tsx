import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, LoaderCircle } from "lucide-react";
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

const sources = [
  {
    name: "Wikimedia pageviews",
    coverage: "Eligible celebrity biography pages with available daily pageview reporting.",
    delay: "Daily source data, captured during the scheduled STKZ refresh.",
    limitation: "Interest alone does not measure sentiment or personal value. Missing data never creates a new trade price.",
    href: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews",
    status: "Live",
  },
  {
    name: "Licensed news volume",
    coverage: "Not connected yet.",
    delay: "Will be documented before release.",
    limitation: "A licensed provider and source-level weighting are required before use.",
    href: null,
    status: "Planned",
  },
  {
    name: "Approved search trends",
    coverage: "Not connected yet.",
    delay: "Will be documented before release.",
    limitation: "Only approved, policy-compliant trend sources can be used.",
    href: null,
    status: "Planned",
  },
  {
    name: "Official social and video statistics",
    coverage: "Not connected yet.",
    delay: "Will be documented before release.",
    limitation: "Only platform-permitted APIs and public account statistics may be included.",
    href: null,
    status: "Planned",
  },
];

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
        <p className="mt-3 text-sm leading-6 text-[#c4b4d0]">
          STKZ is an entertainment-only practice score, not an investment, security, or investment recommendation.
        </p>

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

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">Source register</p>
          <h2 className="font-display mt-2 text-2xl font-black">What informs STKZ prices</h2>
          <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">
            Every source is documented before it can affect a practice-market price. Inputs are normalized so one platform cannot dominate movement.
          </p>
          <div className="mt-5 space-y-3">
            {sources.map((source) => (
              <article key={source.name} className="rounded-2xl bg-white/[.04] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{source.name}</h3>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${source.status === "Live" ? "bg-[#183b33] text-[#62e7b6]" : "bg-[#ffd17b]/15 text-[#ffd17b]"}`}>
                    {source.status}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-xs leading-5">
                  <div><dt className="font-black text-[#c99bff]">Coverage</dt><dd className="text-[#c4b4d0]">{source.coverage}</dd></div>
                  <div><dt className="font-black text-[#c99bff]">Delay</dt><dd className="text-[#c4b4d0]">{source.delay}</dd></div>
                  <div><dt className="font-black text-[#c99bff]">Limitations</dt><dd className="text-[#c4b4d0]">{source.limitation}</dd></div>
                </dl>
                {source.href && (
                  <a href={source.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#c99bff] hover:text-white">
                    Review source documentation <ExternalLink size={12} />
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}