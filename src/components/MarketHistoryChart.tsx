import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, LoaderCircle } from "lucide-react";
import { PriceChart } from "@/components/PriceChart";

type HistoryPoint = {
  capturedAt: string;
  price: number;
};

const STALE_AFTER_MS = 8 * 60 * 60 * 1000;

export function MarketHistoryChart({
  ticker,
  price,
  change,
}: {
  ticker: string;
  price: number;
  change: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let isMounted = true;
    setIsLoading(true);

    void fetch(`/api/markets/${ticker}/history`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ history: HistoryPoint[] }>;
      })
      .then((data) => {
        if (isMounted && data) {
          setHistory(data.history);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isVisible, ticker]);

  const latestSnapshot = history.at(-1)?.capturedAt;
  const isStale = useMemo(
    () =>
      Boolean(
        latestSnapshot &&
          Date.now() - new Date(latestSnapshot).getTime() > STALE_AFTER_MS,
      ),
    [latestSnapshot],
  );

  return (
    <div ref={containerRef} className="relative">
      {isVisible ? (
        <PriceChart
          ticker={`history-${ticker}`}
          price={price}
          change={change}
          history={history}
        />
      ) : (
        <div className="grid h-16 w-full place-items-center rounded-lg border border-dashed border-white/10 text-[10px] font-bold text-[#9f90ac]">
          Chart loads when visible
        </div>
      )}

      {isLoading && (
        <LoaderCircle
          size={13}
          className="absolute right-1 top-1 animate-spin text-[#c99bff]"
          aria-label="Loading saved price history"
        />
      )}

      {!isLoading && isVisible && isStale && (
        <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-[#ffd17b]/15 px-1.5 py-1 text-[9px] font-black text-[#ffd17b]">
          <Clock3 size={10} />
          STALE
        </span>
      )}
    </div>
  );
}