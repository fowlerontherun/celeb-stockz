import { useState, type ComponentType } from "react";
import {
  Bell,
  ChartNoAxesCombined,
  Flame,
  Home,
  LayoutGrid,
  Search,
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

const celebs: Celebrity[] = [
  {
    name: "Amara Vale",
    ticker: "AMARA",
    price: 38.42,
    change: 14.8,
    image:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=280&q=85",
  },
  {
    name: "Leo March",
    ticker: "LEO",
    price: 22.18,
    change: 8.3,
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=280&q=85",
  },
  {
    name: "Sienna Rae",
    ticker: "SIENNA",
    price: 51.07,
    change: -3.1,
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=280&q=85",
  },
  {
    name: "Dante Cruz",
    ticker: "DANTE",
    price: 17.63,
    change: 6.9,
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=280&q=85",
  },
];

type Page = "Home" | "Markets" | "Watchlist" | "Portfolio" | "Rankings" | "Clubs";

type NavItem = {
  page: Page;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const navItems: NavItem[] = [
  { page: "Home", icon: Home },
  { page: "Markets", icon: LayoutGrid },
  { page: "Watchlist", icon: Star },
  { page: "Portfolio", icon: Wallet },
  { page: "Rankings", icon: Trophy },
  { page: "Clubs", icon: Users },
];

function MarketSearch({
  query,
  onQuery,
  onTrade,
}: {
  query: string;
  onQuery: (value: string) => void;
  onTrade: (celeb: Celebrity) => void;
}) {
  const matches = query.trim()
    ? celebs.filter((celeb) =>
        `${celeb.name} ${celeb.ticker}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : [];

  return (
    <div className="relative hidden w-[310px] lg:block">
      <Search
        className="absolute left-4 top-3 z-10 text-[#a597b4]"
        size={17}
      />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-[#8e819e] focus:border-[#a97cff]"
        placeholder="Search celebrities"
      />
      {matches.length > 0 && (
        <div className="absolute top-12 z-30 w-full overflow-hidden rounded-xl border border-white/10 bg-[#211230] p-1 shadow-2xl">
          {matches.map((celeb) => (
            <button
              key={celeb.ticker}
              type="button"
              onClick={() => {
                onTrade(celeb);
                onQuery("");
              }}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/5"
            >
              <img
                src={celeb.image}
                alt=""
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="flex-1 text-xs font-bold">{celeb.name}</span>
              <span className="text-[10px] text-[#b19cbf]">
                ${celeb.ticker}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeDashboard({
  onTrade,
  goTo,
}: {
  onTrade: (celeb: Celebrity) => void;
  goTo: (page: Page) => void;
}) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            Your spotlight
          </p>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
            The market is <span className="text-[#ff7282]">buzzing.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#3ed9a3]/20 bg-[#12382f]/60 px-3 py-2 text-xs font-bold text-[#80ebc5]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#3ed9a3]" />
          Markets open · live STKZ balances enabled
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.42fr_.8fr]">
        <article className="relative min-h-[330px] overflow-hidden rounded-[28px] border border-white/10 bg-[#2a1740] p-7">
          <img
            src="https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=85"
            alt="Premiere lights"
            className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-[#2a1740]/70" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
              <Flame size={15} fill="currentColor" />
              Hype rising fast
            </div>
            <div className="mt-auto max-w-sm">
              <p className="font-display text-3xl font-black leading-none sm:text-5xl">
                Amara Vale is having a moment.
              </p>
              <p className="mt-4 text-sm leading-6 text-[#dccfe6]">
                Premiere week chatter has pushed her hype score to a new
                30-day high.
              </p>
              <button
                type="button"
                onClick={() => onTrade(celebs[0])}
                className="mt-6 rounded-xl bg-[#ff7282] px-5 py-3 text-sm font-extrabold text-[#35132a] transition hover:bg-[#ff8e9a]"
              >
                Trade AMARA
              </button>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-white/10 bg-[#1e112f] p-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#a99ab7]">
            Trading wallet
          </p>
          <p className="font-display mt-3 text-3xl font-black">
            10,000 <span className="text-lg text-[#c4b6cf]">STKZ</span>
          </p>
          <p className="mt-3 text-sm leading-6 text-[#b8a9c4]">
            Your balance updates instantly after every completed buy or sell
            order.
          </p>
          <button
            type="button"
            onClick={() => goTo("Markets")}
            className="mt-7 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold transition hover:bg-white/10"
          >
            Explore markets
          </button>
        </article>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-black">Hot right now</h2>
            <p className="mt-1 text-sm text-[#a99ab7]">
              Buy, sell, and manage your STKZ holdings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => goTo("Markets")}
            className="text-sm font-bold text-[#c99bff]"
          >
            See all
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {celebs.map((celeb) => (
            <button
              key={celeb.ticker}
              type="button"
              onClick={() => onTrade(celeb)}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1e112f] p-3 text-left transition hover:border-[#a97cff]/50 hover:bg-[#241538]"
            >
              <img
                src={celeb.image}
                alt={celeb.name}
                className="h-[60px] w-[60px] rounded-xl object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-extrabold">{celeb.name}</p>
                <p className="text-[11px] font-bold text-[#9b8ba8]">
                  ${celeb.ticker}
                </p>
                <p className="mt-1 text-sm font-black">
                  {celeb.price.toFixed(2)}{" "}
                  <span className="text-xs text-[#a99ab7]">STKZ</span>
                </p>
              </div>
              <div
                className={`rounded-lg px-2 py-1 text-xs font-extrabold ${
                  celeb.change > 0
                    ? "bg-[#183b33] text-[#62e7b6]"
                    : "bg-[#482332] text-[#ff9ca5]"
                }`}
              >
                {celeb.change > 0 ? "+" : ""}
                {celeb.change}%
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Index() {
  const [page, setPage] = useState<Page>("Home");
  const [selected, setSelected] = useState(celebs[0]);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<Celebrity[]>([
    celebs[0],
    celebs[2],
  ]);
  const [search, setSearch] = useState("");
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);

  const openTrade = (celeb: Celebrity) => {
    setSelected(celeb);
    setTradeOpen(true);
  };

  const content =
    page === "Home" ? (
      <HomeDashboard onTrade={openTrade} goTo={setPage} />
    ) : page === "Markets" ? (
      <MarketsPanel celebs={celebs} onTrade={openTrade} />
    ) : page === "Watchlist" ? (
      <WatchlistPanel
        celebs={watchlist}
        onTrade={openTrade}
        onRemove={(ticker) =>
          setWatchlist((current) =>
            current.filter((celeb) => celeb.ticker !== ticker),
          )
        }
      />
    ) : page === "Portfolio" ? (
      <PortfolioPanel
        celebs={celebs}
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
    ) : (
      <ClubsPanel />
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
            Synthetic celebrity assets. Entertainment only. Not investment
            advice.
          </p>
        </aside>

        <section className="w-full overflow-hidden">
          <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]">
                <ChartNoAxesCombined size={19} />
              </div>
              <span className="font-display text-lg font-black">
                Celeb<span className="text-[#ff7282]">Stockz</span>
              </span>
            </div>

            <MarketSearch
              query={search}
              onQuery={setSearch}
              onTrade={openTrade}
            />

            <div className="ml-auto flex items-center gap-3 lg:ml-4">
              <button
                type="button"
                aria-label="Market alerts"
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5"
              >
                <Bell size={18} />
                <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ff7282]" />
              </button>
              <WalletBalance />
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eeb19e] text-sm font-black text-[#45253d]">
                AJ
              </div>
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
                  Live practice market
                </p>
                <h2 className="font-display mt-1 text-2xl font-black">
                  Trade {selected.ticker}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTradeOpen(false)}
                aria-label="Close trade sheet"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[#c7b9d1] transition hover:bg-white/10"
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
                  {selected.price.toFixed(2)} STKZ ·{" "}
                  {selected.change > 0 ? "+" : ""}
                  {selected.change}% today
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
              Trades use your persistent STKZ practice wallet. Celebrity shares
              are synthetic entertainment assets.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}