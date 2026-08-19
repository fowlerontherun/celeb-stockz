import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2, WalletCards } from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";
import { showError, showSuccess } from "@/utils/toast";

type WalletData = {
  balanceStkz: number;
  positions: Array<{
    ticker: string;
    quantity: number;
    averageCost: number;
  }>;
};

type OpenOrder = {
  id: number;
  ticker: string;
  side: "buy" | "sell";
  orderType: "limit" | "stop_market" | "stop_limit";
  amountStkz: number;
  limitPrice: number | null;
  stopPrice: number | null;
};

type LivePortfolioProps = {
  markets: CategorizedCelebrity[];
  onTrade: (market: CategorizedCelebrity) => void;
};

function getOrderTrigger(order: OpenOrder) {
  if (order.orderType === "limit") {
    return `Limit ${order.limitPrice?.toFixed(2)} STKZ`;
  }

  if (order.orderType === "stop_market") {
    return `Stop ${order.stopPrice?.toFixed(2)} STKZ`;
  }

  return `Stop ${order.stopPrice?.toFixed(2)} · limit ${order.limitPrice?.toFixed(2)}`;
}

export function LivePortfolio({ markets, onTrade }: LivePortfolioProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(
    null,
  );

  const loadPortfolio = useCallback(async () => {
    setIsLoading(true);

    try {
      const [walletResponse, ordersResponse] = await Promise.all([
        fetch("/api/wallet", { credentials: "include" }),
        fetch("/api/orders", { credentials: "include" }),
      ]);
      const walletData = (await walletResponse.json()) as WalletData & {
        statusMessage?: string;
      };
      const orderData = (await ordersResponse.json()) as OpenOrder[] & {
        statusMessage?: string;
      };

      if (!walletResponse.ok) {
        throw new Error(
          walletData.statusMessage ?? "Could not load your portfolio.",
        );
      }

      if (!ordersResponse.ok) {
        throw new Error(
          orderData.statusMessage ?? "Could not load your pending orders.",
        );
      }

      setWallet(walletData);
      setOrders(orderData);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not load your portfolio.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
    window.addEventListener("wallet:updated", loadPortfolio);
    window.addEventListener("orders:updated", loadPortfolio);

    return () => {
      window.removeEventListener("wallet:updated", loadPortfolio);
      window.removeEventListener("orders:updated", loadPortfolio);
    };
  }, [loadPortfolio]);

  const cancelOrder = async (orderId: number) => {
    setCancellingOrderId(orderId);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not cancel this order.");
      }

      setOrders((current) => current.filter((order) => order.id !== orderId));
      window.dispatchEvent(new Event("orders:updated"));
      showSuccess("Pending order cancelled.");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not cancel this order.",
      );
    } finally {
      setCancellingOrderId(null);
    }
  };

  const holdings = useMemo(
    () =>
      (wallet?.positions ?? [])
        .map((position) => ({
          ...position,
          market: markets.find((market) => market.ticker === position.ticker),
        }))
        .filter(
          (
            position,
          ): position is WalletData["positions"][number] & {
            market: CategorizedCelebrity;
          } => Boolean(position.market),
        ),
    [markets, wallet?.positions],
  );

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            Your assets
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Portfolio
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void loadPortfolio()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-[#e6d8ff] transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <section className="mt-7 rounded-[28px] border border-white/10 bg-[#2a1740] p-6 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b8a6c9]">
          Available balance
        </p>
        <p className="font-display mt-2 text-4xl font-black sm:text-5xl">
          {wallet
            ? wallet.balanceStkz.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })
            : "—"}{" "}
          <span className="text-xl text-[#c3b5cf]">STKZ</span>
        </p>
        <p className="mt-3 text-sm text-[#c4b4d0]">
          Your current practice-trading balance.
        </p>
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-black">Your positions</h2>
          <span className="rounded-lg bg-[#7c3aed]/20 px-2 py-1 text-xs font-bold text-[#c99bff]">
            {holdings.length} held
          </span>
        </div>

        {isLoading ? (
          <div className="mt-3 grid place-items-center rounded-[22px] border border-white/10 bg-[#1e112f] p-10">
            <RefreshCw className="animate-spin text-[#c99bff]" />
          </div>
        ) : holdings.length === 0 ? (
          <div className="mt-3 rounded-[22px] border border-dashed border-white/15 bg-white/[.03] p-7 text-center">
            <WalletCards className="mx-auto text-[#c99bff]" size={28} />
            <h3 className="font-display mt-3 text-xl font-black">
              No positions yet
            </h3>
            <p className="mt-2 text-sm text-[#a99ab7]">
              Your reset account is ready with its restored STKZ balance.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#1e112f]">
            {holdings.map(({ market, quantity, averageCost }) => {
              const marketValue = quantity * market.price;
              const profit = marketValue - quantity * averageCost;

              return (
                <div
                  key={market.ticker}
                  className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#160c25] p-1">
                    <img
                      src={market.image}
                      alt={market.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{market.ticker}</p>
                    <p className="text-xs text-[#9f90ac]">
                      {quantity.toFixed(4)} shares · avg {averageCost.toFixed(2)}{" "}
                      STKZ
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black">
                      {marketValue.toFixed(2)} STKZ
                    </p>
                    <p
                      className={`text-xs font-bold ${
                        profit >= 0 ? "text-[#62e7b6]" : "text-[#ff9ca5]"
                      }`}
                    >
                      {profit >= 0 ? "+" : ""}
                      {profit.toFixed(2)} STKZ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTrade(market)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold transition hover:bg-white/10"
                  >
                    Trade
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-black">Open orders</h2>
          <span className="rounded-lg bg-[#ff7282]/15 px-2 py-1 text-xs font-bold text-[#ffb2bc]">
            {orders.length} pending
          </span>
        </div>

        {isLoading ? (
          <div className="mt-3 h-24 rounded-[22px] border border-white/10 bg-[#1e112f]" />
        ) : orders.length === 0 ? (
          <div className="mt-3 rounded-[22px] border border-dashed border-white/15 bg-white/[.03] p-5 text-sm text-[#a99ab7]">
            No pending orders. Set a limit or stop order from any trade sheet.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#1e112f]">
            {orders.map((order) => {
              const isBuy = order.side === "buy";

              return (
                <article
                  key={order.id}
                  className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0"
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-black ${
                      isBuy
                        ? "bg-[#183b33] text-[#62e7b6]"
                        : "bg-[#482332] text-[#ff9ca5]"
                    }`}
                  >
                    {isBuy ? "B" : "S"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">
                      {isBuy ? "Buy" : "Sell"} {order.ticker}
                    </p>
                    <p className="mt-0.5 text-xs text-[#9f90ac]">
                      {order.orderType.replaceAll("_", " ")} ·{" "}
                      {order.amountStkz.toFixed(2)} STKZ
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#c99bff]">
                      {getOrderTrigger(order)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cancellingOrderId === order.id}
                    onClick={() => void cancelOrder(order.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#ff7282]/30 px-3 py-2 text-xs font-bold text-[#ff9ca5] transition hover:bg-[#ff7282]/10 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {cancellingOrderId === order.id ? "Cancelling…" : "Cancel"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}