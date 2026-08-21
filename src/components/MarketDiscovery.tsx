import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Bookmark, Sparkles, X } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type Follow = {
  ticker: string;
  alertsEnabled: boolean;
};

type Market = {
  ticker: string;
  name: string;
  category: string;
  change: number;
  price: number;
};

const collections = [
  {
    title: "Festival season",
    detail: "Artists with live-music momentum",
    tickers: ["DUALIPA", "CHARLI", "STORMZY"],
  },
  {
    title: "Awards buzz",
    detail: "Screen names in the spotlight",
    tickers: ["MURPHY", "JCOMER", "ANYATJ"],
  },
  {
    title: "Breakout talent",
    detail: "Fast-moving rising profiles",
    tickers: ["BELLINGHAM", "AYO", "CENTRALC"],
  },
];

export function MarketDiscovery() {
  const [isOpen, setIsOpen] = useState(false);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [alertsAllowed, setAlertsAllowed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const followsByTicker = useMemo(
    () => new Map(follows.map((follow) => [follow.ticker, follow])),
    [follows],
  );

  useEffect(() => {
    const loadDiscovery = async () => {
      try {
        const [marketsResponse, followsResponse, preferencesResponse] =
          await Promise.all([
            fetch("/api/markets", { credentials: "include" }),
            fetch("/api/follows", { credentials: "include" }),
            fetch("/api/preferences", { credentials: "include" }),
          ]);

        if (
          !marketsResponse.ok ||
          !followsResponse.ok ||
          !preferencesResponse.ok
        ) {
          throw new Error("Could not load your market discovery settings.");
        }

        const marketData = (await marketsResponse.json()) as {
          markets: Market[];
        };
        const followData = (await followsResponse.json()) as {
          follows: Follow[];
        };
        const preferences = (await preferencesResponse.json()) as {
          market_alerts: boolean;
        };

        setMarkets(marketData.markets);
        setFollows(followData.follows);
        setAlertsAllowed(preferences.market_alerts);
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : "Could not load your market discovery settings.",
        );
      }
    };

    void loadDiscovery();
  }, []);

  const updateFollow = async (
    ticker: string,
    following: boolean,
    alertsEnabled = true,
  ) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/follows", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, following, alertsEnabled }),
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not update this follow.");
      }

      setFollows((current) =>
        following
          ? [
              ...current.filter((follow) => follow.ticker !== ticker),
              { ticker, alertsEnabled },
            ]
          : current.filter((follow) => follow.ticker !== ticker),
      );
      showSuccess(
        following
          ? `${ticker} added to your follows.`
          : `${ticker} removed from your follows.`,
      );
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not update this follow.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const collectionMarkets = (tickers: string[]) =>
    tickers
      .map((ticker) => markets.find((market) => market.ticker === ticker))
      .filter((market): market is Market => Boolean(market));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0e0717]/85 p-3 sm:p-4 backdrop-blur-md sm:grid sm:place-items-center">
          <section className="mx-auto my-auto w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#211230] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
                  <Sparkles size={14} /> Curated discovery
                </p>
                <h2 className="font-display mt-2 text-2xl sm:text-3xl font-black">
                  Follow the spotlight.
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-[#c4b4d0]">
                  Save markets to track movements and receive real-time updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close discovery"
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[#cdbed9] hover:bg-white/10 active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {collections.map((collection) => (
                <article
                  key={collection.title}
                  className="rounded-[22px] border border-white/10 bg-[#180d29] p-4"
                >
                  <p className="text-xs font-extrabold uppercase tracking-[.13em] text-[#ffd17b]">
                    Collection
                  </p>
                  <h3 className="font-display mt-1.5 text-lg sm:text-xl font-black">
                    {collection.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#af9fbb]">
                    {collection.detail}
                  </p>
                  <div className="mt-4 space-y-2">
                    {collectionMarkets(collection.tickers).map((market) => {
                      const follow = followsByTicker.get(market.ticker);

                      return (
                        <div
                          key={market.ticker}
                          className="rounded-xl bg-white/[.05] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">{market.name}</p>
                              <p className="text-[10px] font-bold text-[#a99ab7]">
                                ${market.ticker} · {market.price.toFixed(2)} STKZ
                              </p>
                            </div>
                            <span
                              className={`text-xs font-black shrink-0 ${
                                market.change >= 0
                                  ? "text-[#62e7b6]"
                                  : "text-[#ff9ca5]"
                              }`}
                            >
                              {market.change >= 0 ? "+" : ""}
                              {market.change}%
                            </span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() =>
                                void updateFollow(
                                  market.ticker,
                                  !follow,
                                  follow?.alertsEnabled ?? true,
                                )
                              }
                              className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-black disabled:opacity-50 ${
                                follow
                                  ? "bg-[#7c3aed]/25 text-[#d9c2ff]"
                                  : "bg-[#7c3aed] text-white"
                              }`}
                            >
                              <Bookmark
                                size={13}
                                className="mr-1 inline"
                                fill={follow ? "currentColor" : "none"}
                              />
                              {follow ? "Following" : "Follow"}
                            </button>
                            {follow && (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() =>
                                  void updateFollow(
                                    market.ticker,
                                    true,
                                    !follow.alertsEnabled,
                                  )
                                }
                                aria-label={`${follow.alertsEnabled ? "Disable" : "Enable"} ${market.name} alerts`}
                                className="grid w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#c99bff] disabled:opacity-50"
                              >
                                {follow.alertsEnabled ? (
                                  <Bell size={14} />
                                ) : (
                                  <BellOff size={14} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}