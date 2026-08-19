import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink } from "lucide-react";

type HistoryPoint = {
  capturedAt: string;
  price: number;
};

type MarketDetail = {
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

function movementSince(history: HistoryPoint[], hours: number) {
  const latest = history.at(-1);
  if (!latest) return null;

  const target = new Date(latest.capturedAt).getTime() - hours * 60 * 60 * 1000;
  const baseline = [...history]
    .reverse()
    .find((point) => new Date(point.capturedAt).getTime() <= target);

  if (!baseline || baseline.price === 0) return null;
  return ((latest.price - baseline.price) / baseline.price) * 100;
}

export function MarketDetailPanel({ market }: { market: MarketDetail }) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    let active = true;

    void fetch(`/api/markets/${market.ticker}/history`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("History unavailable");
        return response.json() as Promise<{ history: HistoryPoint[] }>;
      })
      .then((data) => {
        if (active) setHistory(data.history);
      })
      .catch(() => {
        if (active) setHistory([]);
      });

    return () => {
      active = false;
    };
  }, [market.ticker]);

  const momentum = useMemo(
    () => ({ day: movementSince(history, 24), week: movementSince(history, 168) }),
    [history],
  );
  const verified = market.snapshot?.refreshStatus === "verified";
  const refreshedAt = market.snapshot?.capturedAt
    ? new Intl.DateTimeFormat([], {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(market.snapshot.capturedAt))
    : "Awaiting first verified refresh";

  const signals = [
    ["Wikimedia interest", "Verified daily pageviews", "Live source"],
    ["Official reach", `${market.signals.socialFollowersMillions}M modeled baseline`, "Baseline only"],
    ["Search interest", "Not connected", "Planned source"],
    ["News volume", "Not connected", "Planned source"],
  ];

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="flex items-start gap-3">
        <div className={verified ? "text-[#62e7b6]" : "text-[#ffd17b]"}>
          {verified ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
            Price transparency
          </p>
          <p className="mt-1 text-xs leading-5 text-[#d6c6e1]">
            {market.snapshot?.movementReason ?? "This price is waiting for its first approved snapshot."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#160c25] p-2.5">
          <p className="text-[10px] font-bold text-[#9f90ac]">24 hour</p>
          <p className="mt-1 text-sm font-black">{momentum.day === null ? "—" : `${momentum.day >= 0 ? "+" : ""}${momentum.day.toFixed(1)}%`}</p>
        </div>
        <div className="rounded-xl bg-[#160c25] p-2.5">
          <p className="text-[10px] font-bold text-[#9f90ac]">7 day</p>
          <p className="mt-1 text-sm font-black">{momentum.week === null ? "—" : `${momentum.week >= 0 ? "+" : ""}${momentum.week.toFixed(1)}%`}</p>
        </div>
        <div className="rounded-xl bg-[#160c25] p-2.5">
          <p className="text-[10px] font-bold text-[#9f90ac]">Data quality</p>
          <p className={`mt-1 text-sm font-black ${verified ? "text-[#62e7b6]" : "text-[#ffd17b]"}`}>{verified ? "Verified" : "Fallback"}</p>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] font-bold text-[#b9a9c5]">
        <Clock3 size={13} /> Last verified refresh: {refreshedAt}
      </p>

      <div className="mt-4 space-y-2">
        {signals.map(([label, value, status]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs">
            <div><p className="font-bold text-[#eee4f3]">{label}</p><p className="text-[#9f90ac]">{value}</p></div>
            <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold text-[#c99bff]">{status}</span>
          </div>
        ))}
      </div>

      <a
        href={`https://en.wikipedia.org/wiki/${encodeURIComponent(market.name.replaceAll(" ", "_"))}`}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#c99bff] hover:text-white"
      >
        View Wikimedia source <ExternalLink size={12} />
      </a>
      <p className="mt-4 border-t border-white/10 pt-3 text-[10px] leading-4 text-[#9f90ac]">
        STKZ is a practice-market score for entertainment and education only, not an investment product or investment advice. News, search, and social sources will only be added through approved, licensed APIs.
      </p>
    </section>
  );
}