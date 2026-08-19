import { useEffect, useMemo, useState } from "react";
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
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/markets/${ticker}/history`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { history: HistoryPoint[] };

        if (isMounted) {
          setHistory(data.history);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [ticker]);

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
    <div className="relative">
      <PriceChart
        ticker={`history-${ticker}`}
        price={price}
        change={change}
        history={history}
      />
      {isLoading && (
        <LoaderCircle
          size={13}
          className="absolute right-1 top-1 animate-spin text-[#c99bff]"
          aria-label="Loading saved price history"
        />
      )}
      {!isLoading && isStale && (
        <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-md bg-[#ffd17b]/15 px-1.5 py-1 text-[9px] font-black text-[#ffd17b]">
          <Clock3 size={10} />
          STALE
        </span>
      )}
    </div>
  );
}