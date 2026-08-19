import { useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  BookOpenText,
  ChartNoAxesCombined,
  Home,
  LayoutGrid,
  Star,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ClubsPanel, WatchlistPanel, type Celebrity } from "@/components/ExperiencePanels";
import { CategoryMarkets, type CategorizedCelebrity } from "@/components/CategoryMarkets";
import { LivePortfolio } from "@/components/LivePortfolio";
import { LiveRankings } from "@/components/LiveRankings";
import { TopMovers } from "@/components/TopMovers";
import { TradeControls } from "@/components/TradeControls";
import { WalletBalance } from "@/components/WalletBalance";
import { OnboardingRecap } from "@/components/OnboardingRecap";
import { PracticeTools } from "@/components/PracticeTools";
import { showError, showSuccess } from "@/utils/toast";

type CelebrityMarket = CategorizedCelebrity & {
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
};

type Follow = {
  ticker: string;
  alertsEnabled: boolean;
};

const fallbackMarkets: CelebrityMarket[] = [
  { name: "Taylor Swift", ticker: "TSWIFT", category: "Music", price: 108.15, change: 12.6, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Taylor%20Swift%20at%20the%202023%20MTV%20Video%20Music%20Awards%20(3).png?width=900", birthYear: 1989, nationality: "American", signals: { socialFollowersMillions: 282, hashtagViewsBillions: 38.4, trendScore: 94, monthlySearchesMillions: 18.6, newsStories: 860 } },
  { name: "Adele", ticker: "ADELE", category: "Music", price: 45.76, change: 8.4, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Adele%202016.jpg?width=900", birthYear: 1988, nationality: "British", signals: { socialFollowersMillions: 58, hashtagViewsBillions: 12.8, trendScore: 85, monthlySearchesMillions: 9.2, newsStories: 430 } },
  { name: "Jude Bellingham", ticker: "BELLINGHAM", category: "Sport", price: 65.84, change: 14.2, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Jude%20Bellingham%202023.jpg?width=900", birthYear: 2003, nationality: "British", signals: { socialFollowersMillions: 37, hashtagViewsBillions: 10.1, trendScore: 96, monthlySearchesMillions: 10.8, newsStories: 790 } },
  { name: "Daniel Kaluuya", ticker: "KALUUYA", category: "Film", price: 45.89, change: 4.1, image: "https://commons.wikimedia.org/wiki/Special:FilePath/Daniel%20Kaluuya%20by%20Gage%20Skidmore.jpg?width=900", birthYear: 1989, nationality: "British", signals: { socialFollowersMillions: 2.1, hashtagViewsBillions: 1.7, trendScore: 74, monthlySearchesMillions: 2.4, newsStories: 260 } },
];

type Page = "Home" | "Markets" | "Movers" | "Watchlist" | "Portfolio" | "Rankings" | "Clubs" | "Practice";

const navItems: Array<{ page: Page; icon: ComponentType<{ size?: number; className?: string }> }> = [
  { page: "Home", icon: Home },
  { page: "Markets", icon: LayoutGrid },
  { page: "Movers", icon: TrendingUp },
  { page: "Watchlist", icon: Star },
  { page: "Portfolio", icon: Wallet },
  { page: "Rankings", icon: Trophy },
  { page: "Clubs", icon: Users },
  { page: "Practice", icon: BookOpenText },
];

export default function Index() {
  const [page, setPage] = useState<Page>("Home");
  const [markets, setMarkets] = useState<CelebrityMarket[]>(fallbackMarkets);
  const [selected, setSelected] = useState<CelebrityMarket>(fallbackMarkets[0]);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [follows, setFollows] = useState<Follow[]>([]);

  const watchlist = follows
    .map((follow) => markets.find((market) => market.ticker === follow.ticker))
    .filter((market): market is CelebrityMarket => Boolean(market));

  useEffect(() => {
    const loadMarkets = async () => {
      const [marketsResponse, followsResponse] = await Promise.all([
        fetch("/api/markets", { credentials: "include" }),
        fetch("/api/follows", { credentials: "include" }),
      ]);

      if (!marketsResponse.ok || !followsResponse.ok) {
        throw new Error("Could not refresh your saved market data.");
      }

      const marketData = (await marketsResponse.json()) as {
        markets: CelebrityMarket[];
      };
      const followData = (await followsResponse.json()) as {
        follows: Follow[];
      };

      setMarkets(marketData.markets);
      setFollows(followData.follows);
      setSelected(
        (current) =>
          marketData.markets.find((market) => market.ticker === current.ticker) ??
          marketData.markets[0],
      );
    };

    void loadMarkets().catch((error: Error) => showError(error.message));
    window.addEventListener("markets:updated", loadMarkets);
    return () => window.removeEventListener("markets:updated", loadMarkets);
  }, []);

  const removeFromWatchlist = async (ticker: string) => {
    const follow = follows.find((item) => item.ticker === ticker);

    try {
      const response = await fetch("/api/follows", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker,
          following: false,
          alertsEnabled: follow?.alertsEnabled ?? true,
        }),
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not remove this market.");
      }

      setFollows((current) =>
        current.filter((followItem) => followItem.ticker !== ticker),
      );
      showSuccess(`${ticker} removed from your watchlist.`);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not remove this market.",
      );
    }
  };

  const openTrade = (market: Celebrity) => {
    setSelected(markets.find((item) => item.ticker === market.ticker) ?? markets[0]);
    setTradeOpen(true);
  };

  const content =
    page === "Markets" ? <CategoryMarkets markets={markets} onTrade={openTrade} /> :
    page === "Movers" ? <TopMovers markets={markets} onTrade={openTrade} /> :
    page === "Watchlist" ? <WatchlistPanel celebs={watchlist} onTrade={openTrade} onRemove={(ticker) => void removeFromWatchlist(ticker)} /> :
    page === "Portfolio" ? <LivePortfolio markets={markets} onTrade={openTrade} /> :
    page === "Rankings" ? <LiveRankings /> :
    page === "Clubs" ? <ClubsPanel /> :
    page === "Practice" ? <PracticeTools markets={markets} /> : (
      <div className="animate-in fade-in duration-300">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">Signal-priced practice markets</p>
        <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">Fame moves the <span className="text-[#ff7282]">market.</span></h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8a9c4]">Explore public figures across music, sport, film, TV, and politics. Every price uses modeled signals and is for practice trading only.</p>
        <button type="button" onClick={() => setPage("Markets")} className="mt-6 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-black text-white hover:bg-[#9361f5]">Browse market categories</button>
        <OnboardingRecap onStartTrading={() => setPage("Markets")} />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#120b20] text-[#fff8f2]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#170d29] px-5 py-7 lg:flex">
          <div className="flex items-center gap-2 px-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]"><ChartNoAxesCombined size={20} /></div><span className="font-display text-xl font-black">Celeb<span className="text-[#ff7282]">Stockz</span></span></div>
          <div className="mt-11 space-y-2">{navItems.map(({ page: itemPage, icon: Icon }) => <button key={itemPage} type="button" onClick={() => setPage(itemPage)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${page === itemPage ? "bg-[#7c3aed] text-white shadow-lg" : "text-[#b9acc9] hover:bg-white/5 hover:text-white"}`}><Icon size={18} />{itemPage}</button>)}</div>
          <p className="mt-auto px-2 text-[10px] leading-4 text-[#7c6d8e]">Synthetic celebrity assets for entertainment only. Not investment advice.</p>
        </aside>

        <section className="w-full overflow-hidden">
          <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]"><ChartNoAxesCombined size={19} /></div><span className="font-display text-lg font-black lg:hidden">Celeb<span className="text-[#ff7282]">Stockz</span></span></div>
            <div className="flex items-center gap-3"><button type="button" aria-label="Market alerts" className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5"><Bell size={18} /><i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ff7282]" /></button><WalletBalance /></div>
          </header>
          <div className="px-5 pb-28 sm:px-8 lg:px-10">{content}</div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-white/10 bg-[#1a0e2a]/95 px-2 py-3 backdrop-blur lg:hidden">
        {navItems.slice(0, 5).map(({ page: itemPage, icon: Icon }) => <button key={itemPage} type="button" onClick={() => setPage(itemPage)} className={`flex flex-col items-center gap-1 text-[10px] font-bold ${page === itemPage ? "text-[#c99bff]" : "text-[#897b95]"}`}><Icon size={19} />{itemPage}</button>)}
      </nav>

      {tradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0e0717]/75 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="w-full max-w-md rounded-t-[30px] border border-white/10 bg-[#211230] p-6 shadow-2xl sm:rounded-[30px]">
            <div className="flex items-start justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]">{selected.category} · signal-priced practice market</p><h2 className="font-display mt-1 text-2xl font-black">Trade {selected.ticker}</h2></div><button type="button" onClick={() => setTradeOpen(false)} aria-label="Close trade sheet" className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[#c7b9d1]"><X size={18} /></button></div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[.04] p-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#160c25] p-1"><img src={selected.image} alt={selected.name} className="h-full w-full object-contain" /></div><div><p className="font-bold">{selected.name}</p><p className="text-xs text-[#9b8ba8]">{selected.signals.socialFollowersMillions}M followers · {selected.signals.hashtagViewsBillions}B hashtag views</p></div></div>
            <div className="mt-5"><TradeControls key={selected.ticker} ticker={selected.ticker} price={selected.price} onTradeComplete={() => setTradeOpen(false)} /></div>
            <p className="mt-4 text-center text-[10px] leading-4 text-[#81738d]">Prices use a reproducible fame-signal model and are for practice trading only.</p>
          </section>
        </div>
      )}
    </main>
  );
}