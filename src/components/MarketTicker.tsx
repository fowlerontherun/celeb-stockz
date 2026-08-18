import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

const REFRESH_INTERVAL = 2 * 60 * 1000;

function getNextRefreshAt(timestamp: number) {
  return (Math.floor(timestamp / REFRESH_INTERVAL) + 1) * REFRESH_INTERVAL;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function MarketTicker() {
  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nextRefreshAt = getNextRefreshAt(now);

  useEffect(() => {
    const refreshAtBoundary = async () => {
      setIsRefreshing(true);

      try {
        const response = await fetch("/api/markets", {
          credentials: "include",
        });

        if (response.ok) {
          setLastUpdated(Date.now());
          window.dispatchEvent(new Event("markets:updated"));
        }
      } finally {
        setIsRefreshing(false);
      }
    };

    if (now % REFRESH_INTERVAL < 1000) {
      void refreshAtBoundary();
    }
  }, [now]);

  const secondsRemaining = Math.max(
    0,
    Math.ceil((nextRefreshAt - now) / 1000),
  );
  const countdown = useMemo(
    () =>
      `${String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:${String(
        secondsRemaining % 60,
      ).padStart(2, "0")}`,
    [secondsRemaining],
  );

  return (
    <div className="fixed left-3 right-3 top-3 z-40 mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-[#a97cff]/30 bg-[#211230]/95 px-4 py-3 text-xs shadow-2xl backdrop-blur sm:left-auto sm:right-5 sm:max-w-none">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#7c3aed]/25 text-[#c99bff]">
        {isRefreshing ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : (
          <Activity size={16} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#fff8f2]">
          {isRefreshing
            ? "Refreshing modeled markets…"
            : `Next market refresh in ${countdown}`}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#b8a9c4]">
          Modeled signals · due exactly {formatTime(nextRefreshAt)}
          {lastUpdated ? ` · last checked ${formatTime(lastUpdated)}` : ""}
        </p>
      </div>
      <span className="hidden rounded-lg bg-[#ffd17b]/15 px-2 py-1 text-[10px] font-black text-[#ffd17b] sm:inline">
        DEMO DATA
      </span>
    </div>
  );
}