import { useEffect } from "react";

const MARKET_REFRESH_MS = 2 * 60 * 1000;

export function MarketRefreshPulse() {
  useEffect(() => {
    const refreshMarkets = () => {
      if (document.visibilityState !== "visible") return;
      window.dispatchEvent(new Event("markets:updated"));
    };

    const intervalId = window.setInterval(refreshMarkets, MARKET_REFRESH_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshMarkets();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
