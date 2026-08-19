import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { showError, showSuccess } from "@/utils/toast";

type Source = {
  source_key: string;
  status: string;
  last_checked_at: string;
  last_success_at: string | null;
  detail: string | null;
};

type Refresh = {
  started_at: string;
  status: string;
  refreshed_count: number;
  verified_count: number;
  unavailable_count: number;
  flagged_count: number;
};

type Operations = {
  sources: Source[];
  recentRefreshes: Refresh[];
  system: {
    tradingPaused: boolean;
    updatedAt: string | null;
    apiConfiguration: {
      youtube: boolean;
      search: boolean;
      marketRefreshSecret: boolean;
    };
  };
  metrics: {
    verifiedSnapshots: number;
    unavailableSnapshots: number;
    flaggedSnapshots: number;
    latestVerifiedAt: string | null;
    averageFreshnessMinutes: number;
    stableSnapshotRate: number;
    latestRefreshSuccessRate: number | null;
    completedTrades: number;
    weeklyTrades: number;
    openOrders: number;
  };
};

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat([], {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not available";
}

function formatFreshness(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Not available";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
}

export default function MarketOperations() {
  const [data, setData] = useState<Operations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingTrading, setIsUpdatingTrading] = useState(false);

  const loadOperations = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/internal/market-operations", {
        credentials: "include",
      });
      const payload = (await response.json()) as Operations & {
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.statusMessage ?? "Could not load market operations.",
        );
      }

      setData(payload);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not load market operations.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const updateTradingStatus = async () => {
    if (!data) return;

    const nextPaused = !data.system.tradingPaused;
    const action = nextPaused ? "pause" : "resume";

    if (
      !window.confirm(
        `Are you sure you want to ${action} new practice trades for all users?`,
      )
    ) {
      return;
    }

    setIsUpdatingTrading(true);

    try {
      const response = await fetch("/api/internal/trading-status", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: nextPaused }),
      });
      const result = (await response.json()) as {
        tradingPaused?: boolean;
        updatedAt?: string;
        statusMessage?: string;
      };

      if (!response.ok || typeof result.tradingPaused !== "boolean") {
        throw new Error(
          result.statusMessage ?? "Could not update trading availability.",
        );
      }

      setData((current) =>
        current
          ? {
              ...current,
              system: {
                ...current.system,
                tradingPaused: result.tradingPaused!,
                updatedAt: result.updatedAt ?? current.system.updatedAt,
              },
            }
          : current,
      );
      showSuccess(
        result.tradingPaused
          ? "New practice trades are now paused."
          : "New practice trades are now live.",
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not update trading availability.",
      );
    } finally {
      setIsUpdatingTrading(false);
    }
  };

  const staleSourceCount = useMemo(
    () =>
      (data?.sources ?? []).filter((source) => {
        if (!source.last_success_at) return true;
        return (
          Date.now() - new Date(source.last_success_at).getTime() >
          8 * 60 * 60 * 1000
        );
      }).length,
    [data],
  );

  if (isLoading && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <RefreshCw className="animate-spin" />
      </main>
    );
  }

  if (!data) return null;

  const cards = [
    [
      "Refresh success",
      data.metrics.latestRefreshSuccessRate === null
        ? "—"
        : `${data.metrics.latestRefreshSuccessRate}%`,
      "Latest approved cycle",
    ],
    [
      "Average freshness",
      formatFreshness(data.metrics.averageFreshnessMinutes),
      "Across latest verified market snapshots",
    ],
    [
      "Price stability",
      `${data.metrics.stableSnapshotRate.toFixed(1)}%`,
      "Verified snapshots within the movement cap",
    ],
    ["Stale sources", String(staleSourceCount), "Older than eight hours"],
    ["Flagged movements", String(data.metrics.flaggedSnapshots), "Held for review"],
    [
      "Completed trades",
      String(data.metrics.completedTrades),
      `${data.metrics.weeklyTrades} in the last 7 days`,
    ],
    ["Open orders", String(data.metrics.openOrders), "Evaluated after verified snapshots"],
  ];

  const providers = [
    ["Official YouTube data", data.system.apiConfiguration.youtube],
    ["Google search data", data.system.apiConfiguration.search],
    ["Scheduled refresh secret", data.system.apiConfiguration.marketRefreshSecret],
  ];

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-sm font-bold text-[#c99bff] transition hover:text-white"
            >
              ← Back to markets
            </Link>
            <p className="mt-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
              <ShieldCheck size={15} /> Restricted operations
            </p>
            <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
              Market control center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c4b4d0]">
              Monitor quality, control practice trading, and check whether
              server-side provider connections are ready. Credentials are never
              shown in the dashboard.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadOperations()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black transition hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            Refresh view
          </button>
        </div>

        <section
          className={`mt-8 rounded-[28px] border p-5 sm:flex sm:items-center sm:justify-between sm:p-7 ${
            data.system.tradingPaused
              ? "border-[#ff7282]/40 bg-[#391b35]"
              : "border-[#62e7b6]/30 bg-[#15362f]"
          }`}
        >
          <div className="flex gap-4">
            <div
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                data.system.tradingPaused
                  ? "bg-[#ff7282] text-[#401b2d]"
                  : "bg-[#62e7b6] text-[#112b24]"
              }`}
            >
              {data.system.tradingPaused ? (
                <PauseCircle size={24} />
              ) : (
                <PlayCircle size={24} />
              )}
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em]">
                Global practice trading
              </p>
              <h2 className="font-display mt-1 text-2xl font-black">
                {data.system.tradingPaused ? "New trades are paused" : "Trading is live"}
              </h2>
              <p className="mt-1 text-sm text-[#e4d3e2]">
                {data.system.tradingPaused
                  ? "Market buys, sells, and new orders are blocked until you resume them."
                  : "Users can place market, limit, and stop orders normally."}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isUpdatingTrading}
            onClick={() => void updateTradingStatus()}
            className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition disabled:opacity-50 sm:mt-0 sm:w-auto ${
              data.system.tradingPaused
                ? "bg-[#62e7b6] text-[#112b24] hover:bg-[#83efc8]"
                : "bg-[#ff7282] text-[#401b2d] hover:bg-[#ff8e9a]"
            }`}
          >
            {data.system.tradingPaused ? (
              <PlayCircle size={17} />
            ) : (
              <PauseCircle size={17} />
            )}
            {isUpdatingTrading
              ? "Updating…"
              : data.system.tradingPaused
                ? "Resume trading"
                : "Pause trading"}
          </button>
        </section>

        <section className="mt-7 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#c99bff]">
            Provider readiness
          </p>
          <h2 className="font-display mt-2 text-2xl font-black">
            Connected data services
          </h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {providers.map(([name, isReady]) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-2xl bg-white/[.04] p-4"
              >
                {isReady ? (
                  <CheckCircle2 className="text-[#62e7b6]" size={20} />
                ) : (
                  <AlertTriangle className="text-[#ffd17b]" size={20} />
                )}
                <div>
                  <p className="text-sm font-black">{name}</p>
                  <p
                    className={`mt-1 text-xs font-bold ${
                      isReady ? "text-[#62e7b6]" : "text-[#ffd17b]"
                    }`}
                  >
                    {isReady ? "Configured" : "Needs server configuration"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([label, value, detail]) => (
            <article
              key={label}
              className="rounded-[22px] border border-white/10 bg-[#211230] p-5"
            >
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#a99ab7]">
                {label}
              </p>
              <p className="font-display mt-3 text-2xl font-black">{value}</p>
              <p className="mt-2 text-xs text-[#c4b4d0]">{detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-7 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-[#62e7b6]" />
            <h2 className="font-display text-2xl font-black">Source health</h2>
          </div>
          <div className="mt-5 space-y-3">
            {data.sources.map((source) => {
              const healthy = source.status === "healthy";

              return (
                <article
                  key={source.source_key}
                  className="flex flex-col gap-3 rounded-2xl bg-white/[.04] p-4 sm:flex-row sm:items-center"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                      healthy
                        ? "bg-[#183b33] text-[#62e7b6]"
                        : "bg-[#482332] text-[#ff9ca5]"
                    }`}
                  >
                    {healthy ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{source.source_key}</p>
                    <p className="mt-1 text-xs text-[#b9a9c5]">
                      {source.detail ?? "No source detail recorded."}
                    </p>
                  </div>
                  <div className="text-xs text-[#b9a9c5] sm:text-right">
                    <p className="font-bold text-[#fff8f2]">{source.status}</p>
                    <p className="mt-1">
                      Success: {formatDate(source.last_success_at)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-7 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-[#ffd17b]" />
            <h2 className="font-display text-2xl font-black">Recent refreshes</h2>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1.3fr_.7fr_.7fr] gap-3 border-b border-white/10 bg-white/[.04] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#a99ab7] sm:grid-cols-[1.5fr_.8fr_.7fr_.7fr_.7fr]">
              <span>Started</span>
              <span>Status</span>
              <span className="text-right">Verified</span>
              <span className="hidden text-right sm:block">Unavailable</span>
              <span className="hidden text-right sm:block">Flagged</span>
            </div>
            {data.recentRefreshes.map((refresh) => (
              <div
                key={refresh.started_at}
                className="grid grid-cols-[1.3fr_.7fr_.7fr] gap-3 border-b border-white/5 px-4 py-4 text-xs last:border-0 sm:grid-cols-[1.5fr_.8fr_.7fr_.7fr_.7fr]"
              >
                <span className="text-[#c4b4d0]">
                  {formatDate(refresh.started_at)}
                </span>
                <span
                  className={
                    refresh.status === "healthy"
                      ? "font-black text-[#62e7b6]"
                      : "font-black text-[#ff9ca5]"
                  }
                >
                  {refresh.status}
                </span>
                <span className="text-right font-black">
                  {refresh.verified_count}/{refresh.refreshed_count}
                </span>
                <span className="hidden text-right text-[#ff9ca5] sm:block">
                  {refresh.unavailable_count}
                </span>
                <span className="hidden text-right text-[#ffd17b] sm:block">
                  {refresh.flagged_count}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}