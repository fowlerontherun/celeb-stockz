import { useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  ChartNoAxesCombined,
  Flame,
  Home,
  LayoutGrid,
  Star,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  ClubsPanel,
  MarketsPanel,
  PortfolioPanel,
  RankingsPanel,
  WatchlistPanel,
  type Celebrity,
  type OpenOrder,
} from "@/components/ExperiencePanels";
import { TradeControls } from "@/components/TradeControls";
import { WalletBalance } from "@/components/WalletBalance";
import { showError } from "@/utils/toast";

type CelebrityMarket = Celebrity & {
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
};

const fallbackMarkets: CelebrityMarket[] = [
  {
    name: "Taylor Swift",
    ticker: "TSWIFT",
    price: 108.15,
    change: 12.6,
    image:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=280&q=85",
    signals: {
      socialFollowersMillions: 282,
      hashtagViewsBillions: 38.4,
      trendScore: 94,
      monthlySearchesMillions: 18.6,
      newsStories: 860,
    },
  },
  {
    name: "Cristiano Ronaldo",
    ticker: "CR7",
    price: 215.51,
    change: 7.8,
    image:
      "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=280&q=85",
    signals: {
      socialFollowersMillions: 935,
      hashtagViewsBillions: 95.2,
      trendScore: 89,
      monthlySearchesMillions: 15.1,
      newsStories: 740,
    },
  },
  {
    name: "Selena Gomez",
    ticker: "SELENA",
    price: 108.93,
    change: -2.4,
    image:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=280&q=85",
    signals: {
      socialFollowersMillions: 490,
      hashtagViewsBillions: 22.1,
      trendScore: 77,
      monthlySearchesMillions: 8.4,
      newsStories: 390,
    },
  },
  {
    name: "MrBeast",
    ticker: "MRBEAST",
    price: 143.92,
    change: 10.2,
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=280&q=85",
    signals: {
      socialFollowersMillions: 520,
      hashtagViewsBillions: 41.8,
      trendScore: 91,
      monthlySearchesMillions: 11.7,
      newsStories: 680,
    },
  },
];

type Page = "Home" | "Markets" | "Watchlist" | "Portfolio" | "Rankings" | "Clubs";

const navItems: Array<{
  page: Page;
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [
  { page: "Home", icon: Home },
  { page: "Markets", icon: LayoutGrid },
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
  const [watchlist, setWatchlist] = useState<Celebrity[]>([
    fallbackMarkets[0],
    fallbackMarkets[2],
  ]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);

  useEffect(() => {
    const loadMarkets = async () => {
      const response = await fetch("/api/markets", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Could not refresh celebrity market signals.");
      }

      const data = (await response.json()) as { markets: CelebrityMarket[] };
      setMarkets(data.markets);
      setSelected((current) =>
        data.markets.find((market) => market.ticker === current.ticker) ??
        data.markets[0],
      );
      setWatchlist((current) =>
        current
          .map((item) =>
            data.markets.find((market) => market.ticker === item.ticker),
          )
          .filter((item): item is CelebrityMarket => Boolean(item)),
      );
    };

    void loadMarkets().catch((error: Error) => showError(error.message));
  }, []);

  const openTrade = (market: Celebrity) => {
    const selectedMarket =
      markets.find((item) => item.ticker === market.ticker) ?? markets[0];
    setSelected(selectedMarket);
    setTradeOpen(true);
  };

  const content =
    page === "Markets" ? (
      <MarketsPanel celebs={markets} onTrade={openTrade} />
    ) : page === "Watchlist" ? (
      <WatchlistPanel
        celebs={watchlist}
        onTrade={openTrade}
        onRemove={(ticker) =>
          setWatchlist((current) =>
            current.filter((market) => market.ticker !== ticker),
          )
        }
      />
    ) : page === "Portfolio" ? (
      <PortfolioPanel
        celebs={markets}
        onTrade={openTrade}
        openOrders={openOrders}
        onCancelOrder={(id) =>
          setOpenOrders((current) =>
            current.filter((order) => order.id !== id),
          )
        }
      />
    ) : page === "Rankings" ? (
      <RankingsPanel />
    ) : page === "Clubs" ? (
      <ClubsPanel />
    ) : (
      <div className="animate-in fade-in duration-300">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
          Signal-priced practice markets
        </p>
        <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
          Fame moves the <span className="text-[#ff7282]">market.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8a9c4]">
          Each STKZ price is calculated from social reach, hashtag activity,
          search demand, trend momentum, and current news coverage.
        </p>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {markets.map((market) => (
            <button
              key={market.ticker}
              type="button"
              onClick={() => openTrade(market)}
              className="overflow-hidden rounded-[24px] border border-white/10 bg-[#1e112f] text-left transition hover:-translate-y-1 hover:border-[#a97cff]/60"
            >
              <img
                src={market.image}
                alt={market.name}
                className="h-36 w-full object-cover"
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-black">{market.name}</p>
                    <p className="text-xs font-bold text-[#a99ab7]">${market.ticker}</p>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-1 text-xs font-black ${
                      market.change > 0
                        ? "bg-[#183b33] text-[#62e7b6]"
                        : "bg-[#482332] text-[#ff9ca5]"
                    }`}
                  >
                    {market.change > 0 ? "+" : ""}
                    {market.change}%
                  </span>
                </div>
                <p className="mt-4 text-2xl font-black">
                  {market.price.toFixed(2)}{" "}
                  <span className="text-xs text-[#a99ab7]">STKZ</span>
                </p>
                <p className="mt-2 text-[11px] font-bold text-[#c99bff]">
                  Trend score {market.signals.trendScore}/100 ·{" "}
                  {market.signals.newsStories} news signals
                </p>
              </div>
            </button>
          ))}
        </section>
      </div>
    );

  return (
    <main className="min-h-screen bg-[#120b20] text-[#fff8f2]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#170d29] px-5 py-7 lg:flex">
          <div className="flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]">
              <ChartNoAxesCombined size={20} />
            </div>
            <span className="font-display text-xl font-black">
              Celeb<span className="text-[#ff7282]">Stockz</span>
            </span>
          </div>
          <div className="mt-11 space-y-2">
            {navItems.map(({ page: itemPage, icon: Icon }) => (
              <button
                key={itemPage}
                type="button"
                onClick={() => setPage(itemPage)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  page === itemPage
                    ? "bg-[#7c3aed] text-white shadow-lg"
                    : "text-[#b9acc9] hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {itemPage}
              </button>
            ))}
          </div>
          <p className="mt-auto px-2 text-[10px] leading-4 text-[#7c6d8e]">
            Synthetic celebrity assets for entertainment only. Not investment advice.
          </p>
        </aside>

        <section className="w-full overflow-hidden">
          <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]">
                <ChartNoAxesCombined size={19} />
              </div>
              <span className="font-display text-lg font-black lg:hidden">
                Celeb<span className="text-[#ff7282]">Stockz</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Market alerts"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5"
              >
                <Bell size={18} />
                <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ff7282]" />
              </button>
              <WalletBalance />
            </div>
          </header>
          <div className="px-5 pb-28 sm:px-8 lg:px-10">{content}</div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-white/10 bg-[#1a0e2a]/95 px-2 py-3 backdrop-blur lg:hidden">
        {navItems.slice(0, 4).map(({ page: itemPage, icon: Icon }) => (
          <button
            key={itemPage}
            type="button"
            onClick={() => setPage(itemPage)}
            className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
              page === itemPage ? "text-[#c99bff]" : "text-[#897b95]"
            }`}
          >
            <Icon size={19} />
            {itemPage}
          </button>
        ))}
      </nav>

      {tradeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0e0717]/75 backdrop-blur-sm sm:items-center sm:p-6">
          <section className="w-full max-w-md rounded-t-[30px] border border-white/10 bg-[#211230] p-6 shadow-2xl sm:rounded-[30px]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]">
                  Signal-priced practice market
                </p>
                <h2 className="font-display mt-1 text-2xl font-black">
                  Trade {selected.ticker}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTradeOpen(false)}
                aria-label="Close trade sheet"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[#c7b9d1]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[.04] p-3">
              <img
                src={selected.image}
                alt={selected.name}
                className="h-12 w-12 rounded-xl object-cover"
              />
              <div>
                <p className="font-bold">{selected.name}</p>
                <p className="text-xs text-[#9b8ba8]">
                  {selected.signals.socialFollowersMillions}M followers ·{" "}
                  {selected.signals.hashtagViewsBillions}B hashtag views
                </p>
              </div>
            </div>
            <div className="mt-5">
              <TradeControls
                key={selected.ticker}
                ticker={selected.ticker}
                price={selected.price}
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