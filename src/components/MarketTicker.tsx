import { useEffect, useMemo, useState } from "react";
import { Activity, Clock3 } from "lucide-react";

const REFRESH_INTERVAL = 60 * 1000;

function getNextRefreshAt(timestamp: number) {
  return (Math.floor(timestamp / REFRESH_INTERVAL) + 1) * REFRESH_INTERVAL;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export function MarketTicker() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const nextRefreshAt = getNextRefreshAt(now);
  const secondsRemaining = Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));
  const countdown = useMemo(
    () =>
      `${String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:${String(
        secondsRemaining % 60,
      ).padStart(2, "0")}`,
    [secondsRemaining],
  );

  return (
    <div className="fixed bottom-20 left-3 right-3 z-30 mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border border-[#a97cff]/30 bg-[#211230]/95 px-4 py-3 text-xs shadow-2xl backdrop-blur sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-none">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#7c3aed]/25 text-[#c99bff]">
        <Activity size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-[#fff8f2]">
          Practice-market updates · next cycle in {countdown}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#b8a9c4]">
          Public signals refresh when available · modeled movement updates every minute
        </p>
      </div>
      <span className="hidden items-center gap-1 rounded-lg bg-[#ffd17b]/15 px-2 py-1 text-[10px] font-black text-[#ffd17b] sm:inline-flex">
        <Clock3 size={12} />
        PRACTICE ONLY
      </span>
    </div>
  );
}