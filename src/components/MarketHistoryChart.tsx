import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PriceChart } from "@/components/PriceChart";

type HistoryPoint = {
  capturedAt: string;
  price: number;
};

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
    </div>
  );
}