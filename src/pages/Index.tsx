import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  ChartNoAxesCombined,
  Home,
  LayoutGrid,
  Menu,
  PackageOpen,
  Search,
  Shield,
  Star,
  Swords,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ClubsPanel, WatchlistPanel, type Celebrity } from "@/components/ExperiencePanels";
import { CategoryMarkets, type CategorizedCelebrity } from "@/components/CategoryMarkets";
import { CustomLeagues } from "@/components/CustomLeagues";
import { CelebrityBattle } from "@/components/CelebrityBattle";
import { LivePortfolio } from "@/components/LivePortfolio";
import { LiveRankings } from "@/components/LiveRankings";
import { TopMovers } from "@/components/TopMovers";
import { TradeControls } from "@/components/TradeControls";
import { WalletBalance } from "@/components/WalletBalance";
import { OnboardingRecap } from "@/components/OnboardingRecap";
import { MarketDetailPanel } from "@/components/MarketDetailPanel";
import { PackCarousels } from "@/components/PackCarousels";
import { QuickSearchModal } from "@/components/QuickSearchModal";
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

type Page = "Home" | "Markets" | "Movers" | "Battles" | "Leagues" | "Watchlist" | "Portfolio" | "Rankings" | "Clubs";

const desktopNavItems: Array<{ page: Page; icon: ComponentType<{ size?: number; className?: string }> }> = [
  { page: "Home", icon: Home },
  { page: "Markets", icon: LayoutGrid },
  { page: "Movers", icon: TrendingUp },
  { page: "Battles", icon: Swords },
  { page: "Leagues", icon: Shield },
  { page: "Watchlist", icon: Star },
  { page: "Portfolio", icon: Wallet },
  { page: "Rankings", icon: Trophy },
  { page: "Clubs", icon: Users },
];

export default function Index() {
  const [page, setPage] = useState<Page>("Home");
  const [markets, setMarkets] = useState<CelebrityMarket[]>(fallbackMarkets);
  const [selected, setSelected] = useState<CelebrityMarket>(fallbackMarkets[0]);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);

  const watchlist = follows
    .map((follow) => markets.find((market) => market.ticker === follow.ticker))
    .filter((market): market is CelebrityMarket => Boolean(market));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const selectPage = (newPage: Page) => {
    setPage(newPage);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const content =
    page === "Markets" ? <CategoryMarkets markets={markets} onTrade={openTrade} /> :
    page === "Movers" ? <TopMovers markets={markets} onTrade={openTrade} /> :
    page === "Battles" ? <CelebrityBattle markets={markets} onTrade={openTrade} /> :
    page === "Leagues" ? <CustomLeagues /> :
    page === "Watchlist" ? <WatchlistPanel celebs={watchlist} onTrade={openTrade} onRemove={(ticker) => void removeFromWatchlist(ticker)} /> :
    page === "Portfolio" ? <LivePortfolio markets={markets} onTrade={openTrade} /> :
    page === "Rankings" ? <LiveRankings /> :
    page === "Clubs" ? <ClubsPanel /> : (
      <div className="animate-in fade-in duration-300">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">Signal-priced practice markets</p>
        <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl md:text-5xl">Fame moves the <span className="text-[#ff7282]">market.</span></h1>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-6 text-[#b8a9c4]">Explore public figures across music, sport, film, TV, and politics. Every price uses modeled signals and is for live trading only.</p>
        
        <div className="mt-6 flex flex-wrap gap-2.5 sm:gap-3">
          <button type="button" onClick={() => selectPage("Markets")} className="flex-1 sm:flex-none rounded-xl bg-[#7c3aed] px-5 py-3 text-xs sm:text-sm font-black text-white active:scale-95 transition hover:bg-[#9361f5]">Browse markets</button>
          <button type="button" onClick={() => selectPage("Battles")} className="flex-1 sm:flex-none rounded-xl border border-[#ff7282]/40 bg-[#ff7282]/15 px-5 py-3 text-xs sm:text-sm font-black text-[#ffb2bc] active:scale-95 transition hover:bg-[#ff7282]/25">Culture Battles ⚔️</button>
          <button type="button" onClick={() => selectPage("Leagues")} className="flex-1 sm:flex-none rounded-xl border border-[#ffd17b]/30 bg-[#ffd17b]/10 px-5 py-3 text-xs sm:text-sm font-black text-[#ffe2a3] active:scale-95 transition hover:bg-[#ffd17b]/20">Player Leagues</button>
          <button type="button" onClick={() => selectPage("Movers")} className="w-full sm:w-auto rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs sm:text-sm font-black text-[#e6d8ff] active:scale-95 transition hover:bg-white/10">View top movers</button>
        </div>

        {/* Horizontal Carousel for Published & Upcoming Packs */}
        <PackCarousels />

        <OnboardingRecap onStartTrading={() => selectPage("Markets")} />
      </div>
    );

  return (
    <main className="min-h-screen bg-[#120b20] text-[#fff8f2]">
      {/* Quick Search Spotlight Modal */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        markets={markets}
        onSelectMarket={openTrade}
      />

      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        {/* Desktop Sidebar Navigation */}
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#170d29] px-5 py-7 lg:flex">
          <div className="flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]">
              <ChartNoAxesCombined size={20} />
            </div>
            <span className="font-display text-xl font-black">
              Celeb<span className="text-[#ff7282]">Stockz</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsQuickSearchOpen(true)}
            className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-[#b9acc9] hover:bg-white/10 hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Search size={14} className="text-[#c99bff]" />
              Quick search…
            </span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#c99bff]">
              ⌘K
            </kbd>
          </button>

          <div className="mt-6 space-y-1.5">
            {desktopNavItems.map(({ page: itemPage, icon: Icon }) => (
              <button
                key={itemPage}
                type="button"
                onClick={() => selectPage(itemPage)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  page === itemPage
                    ? "bg-[#7c3aed] text-white shadow-lg font-black"
                    : "text-[#b9acc9] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {itemPage}
              </button>
            ))}
          </div>

          <div className="mt-auto space-y-3 px-2">
            <Link
              to="/packs"
              className="flex items-center justify-between rounded-xl border border-[#ffd17b]/30 bg-[#ffd17b]/10 p-3 text-xs font-black text-[#ffe2a4] hover:bg-[#ffd17b]/20"
            >
              <span className="flex items-center gap-2">
                <PackageOpen size={16} />
                52 Weekly Packs
              </span>
              <span className="rounded bg-[#ffd17b] px-1.5 py-0.5 text-[10px] font-black text-[#382600]">
                £1.99
              </span>
            </Link>
            <p className="text-[10px] leading-4 text-[#7c6d8e]">
              Live celebrity assets for entertainment only. Not investment advice.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <section className="w-full overflow-hidden">
          {/* Top Bar Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#120b20]/90 px-4 py-3.5 sm:px-8 sm:py-5 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#7c3aed] lg:hidden">
                <ChartNoAxesCombined size={17} />
              </div>
              <span className="font-display text-base font-black lg:hidden">
                Celeb<span className="text-[#ff7282]">Stockz</span>
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsQuickSearchOpen(true)}
                aria-label="Open Quick Search"
                className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#c99bff] hover:bg-white/10 active:scale-95"
              >
                <Search size={17} />
              </button>

              <Link
                to="/packs"
                className="hidden items-center gap-1.5 rounded-xl border border-[#ffd17b]/40 bg-[#ffd17b]/15 px-3 py-2 text-xs font-black text-[#ffd17b] hover:bg-[#ffd17b]/25 sm:inline-flex"
              >
                <PackageOpen size={14} />
                <span>Packs · £1.99</span>
              </Link>
              <WalletBalance />
            </div>
          </header>

          {/* Page Body with Mobile Bottom Padding */}
          <div className="px-4 pb-28 pt-4 sm:px-8 sm:pb-28 sm:pt-6 lg:px-10">
            {content}
          </div>
        </section>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#170c2a]/95 pb-safe backdrop-blur-lg lg:hidden shadow-[0_-10px_25px_rgba(0,0,0,0.5)]"
      >
        <div className="grid grid-cols-5 items-center px-1 py-1.5 text-center">
          {[
            { page: "Home" as Page, label: "Home", icon: Home },
            { page: "Markets" as Page, label: "Markets", icon: LayoutGrid },
            { page: "Movers" as Page, label: "Movers", icon: TrendingUp },
            { page: "Battles" as Page, label: "Battles", icon: Swords },
          ].map(({ page: itemPage, label, icon: Icon }) => {
            const isActive = page === itemPage;

            return (
              <button
                key={itemPage}
                type="button"
                onClick={() => selectPage(itemPage)}
                className={`flex flex-col items-center justify-center py-1.5 transition active:scale-90 ${
                  isActive ? "text-[#ffd17b]" : "text-[#9d8da9]"
                }`}
              >
                <div
                  className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                    isActive ? "bg-[#ffd17b]/20 text-[#ffd17b]" : "text-[#b2a2be]"
                  }`}
                >
                  <Icon size={19} />
                </div>
                <span className="mt-0.5 text-[10px] font-extrabold tracking-tight">
                  {label}
                </span>
              </button>
            );
          })}

          {/* "More" / Menu Button for mobile drawer */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 transition active:scale-90 ${
              ["Portfolio", "Leagues", "Watchlist", "Rankings", "Clubs"].includes(page)
                ? "text-[#c99bff]"
                : "text-[#9d8da9]"
            }`}
          >
            <div
              className={`grid h-8 w-8 place-items-center rounded-xl transition ${
                ["Portfolio", "Leagues", "Watchlist", "Rankings", "Clubs"].includes(page)
                  ? "bg-[#7c3aed]/30 text-[#c99bff]"
                  : "text-[#b2a2be]"
              }`}
            >
              <Menu size={19} />
            </div>
            <span className="mt-0.5 text-[10px] font-extrabold tracking-tight">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* MOBILE "MORE" DRAWER BOTTOM SHEET */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/80 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-full rounded-t-[32px] border-t border-[#c99bff]/30 bg-[#211230] p-6 pb-safe shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-white/20" />

            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
                Navigation & Tools
              </span>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-full p-1 text-[#bcaec8] hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {[
                { page: "Portfolio" as Page, label: "My Portfolio", icon: Wallet, desc: "Holdings & orders" },
                { page: "Leagues" as Page, label: "Player Leagues", icon: Shield, desc: "Private competitions" },
                { page: "Watchlist" as Page, label: "Watchlist", icon: Star, desc: `${watchlist.length} pinned` },
                { page: "Rankings" as Page, label: "Live Rankings", icon: Trophy, desc: "Global standings" },
                { page: "Clubs" as Page, label: "Trading Clubs", icon: Users, desc: "Community circles" },
              ].map(({ page: p, label, icon: Icon, desc }) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPage(p)}
                  className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition active:scale-95 ${
                    page === p
                      ? "border-[#ffd17b] bg-[#ffd17b]/15 text-white"
                      : "border-white/10 bg-[#160c25] text-[#dcd0e3] hover:bg-white/5"
                  }`}
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#7c3aed]/25 text-[#c99bff]">
                    <Icon size={16} />
                  </div>
                  <span className="mt-2 font-display text-sm font-black">{label}</span>
                  <span className="text-[10px] text-[#9c8ca8]">{desc}</span>
                </button>
              ))}
            </div>

            {/* Quick Links Section in Mobile Drawer */}
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <Link
                to="/packs"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-xl border border-[#ffd17b]/30 bg-[#ffd17b]/10 p-3 text-xs font-black text-[#ffe2a4]"
              >
                <div className="flex items-center gap-2">
                  <PackageOpen size={16} className="text-[#ffd17b]" />
                  <span>52 Weekly Celebrity Packs</span>
                </div>
                <span className="rounded bg-[#ffd17b] px-2 py-0.5 text-[10px] text-[#382600]">
                  £1.99
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE & DESKTOP RESPONSIVE TRADE SHEET MODAL */}
      {tradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
          <section
            className="flex max-h-[92vh] sm:max-h-[90vh] w-full max-w-lg flex-col rounded-t-[32px] sm:rounded-[30px] border border-white/15 bg-[#211230] p-5 sm:p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab bar on mobile */}
            <div className="mx-auto -mt-1 mb-3 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]">
                  {selected.category} · Practice Market
                </p>
                <h2 className="font-display mt-0.5 text-2xl font-black">
                  Trade {selected.ticker}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTradeOpen(false)}
                aria-label="Close trade sheet"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[#c7b9d1] hover:bg-white/10 active:scale-95"
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
                  onError={(e) => {
                    e.currentTarget.src = `/api/celebrity-images/${encodeURIComponent(selected.ticker)}`;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-white">{selected.name}</p>
                <p className="text-xs text-[#9b8ba8]">
                  {selected.signals.socialFollowersMillions}M followers · {selected.signals.hashtagViewsBillions}B hashtag views
                </p>
              </div>
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
              Prices use a reproducible fame-signal model and are for practice trading only.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}