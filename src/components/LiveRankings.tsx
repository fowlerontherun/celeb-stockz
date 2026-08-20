import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Gem, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { showError } from "@/utils/toast";

type Ranking = {
  traderId: string;
  name: string;
  nickname: string | null;
  netWorth: number;
  profitLoss: number;
  isCurrentUser: boolean;
  rank: number;
};

const rankColors = ["#ffd17b", "#bd9cff", "#6ce0bd"];

export function LiveRankings() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRankings = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/rankings", {
        credentials: "include",
      });
      const data = (await response.json()) as Ranking[] & {
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not load rankings.");
      }

      setRankings(data);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not load rankings.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRankings();
    window.addEventListener("wallet:updated", loadRankings);

    return () => window.removeEventListener("wallet:updated", loadRankings);
  }, [loadRankings]);

  const displayedRankings = useMemo(() => {
    const topTraders = rankings.slice(0, 10);
    const currentTrader = rankings.find((trader) => trader.isCurrentUser);

    if (
      currentTrader &&
      !topTraders.some((trader) => trader.traderId === currentTrader.traderId)
    ) {
      return [...topTraders, currentTrader];
    }

    return topTraders;
  }, [rankings]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            Live practice standings
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Rankings
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadRankings()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#e6d8ff] transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-[#b9a9c5]">
        Standings use each trader's real STKZ balance and the current modeled
        value of their holdings. Custom player nicknames are shown below.
      </p>

      <section className="mt-7 overflow-hidden rounded-[28px] border border-white/10 bg-[#1e112f] p-4 sm:p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 text-xs font-extrabold uppercase tracking-[.16em] text-[#a99ab7]">
          <span>Trader</span>
          <span>Net worth</span>
        </div>

        {isLoading ? (
          <div className="grid min-h-48 place-items-center">
            <LoaderCircle className="animate-spin text-[#c99bff]" />
          </div>
        ) : displayedRankings.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#a99ab7]">
            Rankings will appear once traders start using their STKZ wallets.
          </div>
        ) : (
          displayedRankings.map((trader) => {
            const rankColor =
              rankColors[trader.rank - 1] ?? "#ff9fa9";
            const isTopThree = trader.rank <= 3;

            return (
              <div
                key={trader.traderId}
                className={`flex items-center gap-3 py-4 sm:gap-4 ${
                  trader.isCurrentUser
                    ? "rounded-xl bg-[#7c3aed]/15 px-3"
                    : "border-b border-white/5 last:border-0"
                }`}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-black"
                  style={{
                    backgroundColor: `${rankColor}20`,
                    color: rankColor,
                  }}
                >
                  {trader.rank === 1 ? (
                    <Crown size={18} fill="currentColor" />
                  ) : (
                    trader.rank
                  )}
                </span>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#513266] font-display font-black text-white">
                  {trader.name[0]?.toUpperCase() ?? "T"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-black">
                      {trader.name}
                    </p>
                    {trader.nickname && (
                      <span className="rounded bg-[#ffd17b]/15 px-1.5 py-0.5 text-[9px] font-black text-[#ffd17b]">
                        NICK
                      </span>
                    )}
                    {trader.isCurrentUser && (
                      <span className="rounded bg-[#7c3aed]/30 px-1.5 py-0.5 text-[9px] font-black text-[#d8c1ff]">
                        YOU
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-0.5 text-xs font-bold ${
                      trader.profitLoss >= 0
                        ? "text-[#62e7b6]"
                        : "text-[#ff9ca5]"}
                    }`}
                  >
                    {trader.profitLoss >= 0 ? "+" : ""}
                    {trader.profitLoss.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}{" "}
                    STKZ all time
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-sm font-black sm:text-lg">
                    {trader.netWorth.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-[10px] font-bold text-[#a99ab7]">STKZ</p>
                </div>
                {isTopThree && (
                  <span className="hidden h-2 w-2 rounded-full bg-[#ffd17b] sm:block" />
                )}
              </div>
            );
          })
        )}
      </section>

      <div className="mt-5 flex gap-3 rounded-2xl border border-[#f5ab43]/30 bg-[#2e1e30] p-4">
        <Gem className="shrink-0 text-[#ffd17b]" />
        <p className="text-sm leading-5 text-[#e2d5dd]">
          Set your custom trading nickname in <b>Profile & Settings</b> to show your handle on global and league rankings.
        </p>
      </div>
    </div>
  );
}