import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock,
  History,
  ListOrdered,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";
import { PracticeJournal } from "@/components/PracticeJournal";
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

type TradeHistoryItem = {
  id: number;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  priceStkz: number;
  totalStkz: number;
  createdAt: string;
};

type LivePortfolioProps = {
  markets: CategorizedCelebrity[];
  onTrade: (market: CategorizedCelebrity) => void;
};

type PortfolioTab = "positions" | "orders" | "history" | "journal";

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
  const [activeTab, setActiveTab] = useState<PortfolioTab>("positions");
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  const loadPortfolio = useCallback(async () => {
    setIsLoading(true);

    try {
      const [walletResponse, ordersResponse, historyResponse] = await Promise.all([
        fetch("/api/wallet", { credentials: "include" }),
        fetch("/api/orders", { credentials: "include" }),
        fetch("/api/trades", { credentials: "include" }),
      ]);
      const walletData = (await walletResponse.json()) as WalletData & {
        statusMessage?: string;
      };
      const orderData = (await ordersResponse.json()) as OpenOrder[] & {
        statusMessage?: string;
      };
      const historyData = (await historyResponse.json()) as {
        trades?: TradeHistoryItem[];
      };

      if (!walletResponse.ok) {
        throw new Error(walletData.statusMessage ?? "Could not load your portfolio.");
      }

      if (!ordersResponse.ok) {
        throw new Error(orderData.statusMessage ?? "Could not load your pending orders.");
      }

      setWallet(walletData);
      setOrders(orderData);
      if (historyData?.trades) {
        setTradeHistory(historyData.trades);
      }
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

  const holdingsValue = useMemo(
    () =>
      holdings.reduce(
        (total, holding) => total + holding.quantity * holding.market.price,
        0,
      ),
    [holdings],
  );

  const netWorth = (wallet?.balanceStkz ?? 0) + holdingsValue;
  const totalProfitLoss = holdings.reduce(
    (total, holding) =>
      total +
      holding.quantity * (holding.market.price - holding.averageCost),
    0,
  );

  const allTickers = useMemo(
    () => markets.map((m) => m.ticker),
    [markets],
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

      {/* Net Worth Overview Banner */}
      <section className="mt-7 rounded-[28px] border border-white/10 bg-[#2a1740] p-6 sm:p-8 shadow-xl">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#b8a6c9]">
          Modeled net worth
        </p>
        <p className="font-display mt-2 text-4xl font-black sm:text-5xl">
          {wallet
            ? netWorth.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })
            : "—"}{" "}
          <span className="text-xl text-[#c3b5cf]">STKZ</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-xl bg-white/10 px-3 py-2 text-[#e6d8ff]">
            Available{" "}
            {wallet
              ? wallet.balanceStkz.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              : "—"}{" "}
            STKZ
          </span>
          <span className="rounded-xl bg-[#183b33] px-3 py-2 text-[#78e8bd]">
            Holdings {holdingsValue.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}{" "}
            STKZ
          </span>
          {holdings.length > 0 && (
            <span
              className={`rounded-xl px-3 py-2 ${
                totalProfitLoss >= 0
                  ? "bg-[#183b33] text-[#78e8bd]"
                  : "bg-[#482332] text-[#ffb1b9]"
              }`}
            >
              Holdings P&L {totalProfitLoss >= 0 ? "+" : ""}
              {totalProfitLoss.toLocaleString(undefined, {
                maximumFractionDigits: 2,
              })}{" "}
              STKZ
            </span>
          )}
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="mt-7 flex gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("positions")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "positions"
              ? "bg-[#7c3aed] text-white shadow-md"
              : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
          }`}
        >
          <WalletCards size={15} />
          Holdings ({holdings.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "orders"
              ? "bg-[#7c3aed] text-white shadow-md"
              : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
          }`}
        >
          <ListOrdered size={15} />
          Open Orders ({orders.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "history"
              ? "bg-[#7c3aed] text-white shadow-md"
              : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
          }`}
        >
          <History size={15} />
          Trade History ({tradeHistory.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("journal")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition ${
            activeTab === "journal"
              ? "bg-[#7c3aed] text-white shadow-md"
              : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
          }`}
        >
          <BookOpen size={15} />
          Trading Journal & Goals
        </button>
      </div>

      {/* TAB 1: POSITIONS */}
      {activeTab === "positions" && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black">Your Positions</h2>
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
              <h3 className="font-display mt-3 text-xl font-black">No positions yet</h3>
              <p className="mt-2 text-sm text-[#a99ab7]">
                Use your STKZ test balance to take positions in any celebrity market.
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
                        {quantity.toFixed(4)} shares · avg {averageCost.toFixed(2)} STKZ
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
      )}

      {/* TAB 2: OPEN ORDERS */}
      {activeTab === "orders" && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black">Open Pending Orders</h2>
            <span className="rounded-lg bg-[#ff7282]/15 px-2 py-1 text-xs font-bold text-[#ffb2bc]">
              {orders.length} pending
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="mt-3 rounded-[22px] border border-dashed border-white/15 bg-white/[.03] p-5 text-sm text-[#a99ab7]">
              No pending limit or stop orders. Set a trigger order from any trade sheet.
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
                        {order.orderType.replace(/_/g, " ")} · {order.amountStkz.toFixed(2)} STKZ
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
      )}

      {/* TAB 3: TRADE EXECUTION HISTORY */}
      {activeTab === "history" && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black">Completed Trade Ledger</h2>
            <span className="rounded-lg bg-[#7c3aed]/20 px-2 py-1 text-xs font-bold text-[#c99bff]">
              {tradeHistory.length} executed
            </span>
          </div>

          {tradeHistory.length === 0 ? (
            <div className="mt-3 rounded-[22px] border border-dashed border-white/15 bg-white/[.03] p-7 text-center text-sm text-[#a99ab7]">
              No trade executions recorded yet. Execute your first practice buy or sell.
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-[22px] border border-white/10 bg-[#1e112f]">
              {tradeHistory.map((trade) => {
                const isBuy = trade.side === "buy";

                return (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between border-b border-white/5 p-4 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${
                          isBuy
                            ? "bg-[#183b33] text-[#62e7b6]"
                            : "bg-[#482332] text-[#ff9ca5]"
                        }`}
                      >
                        {isBuy ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </span>
                      <div>
                        <p className="text-sm font-black text-white">
                          {isBuy ? "Bought" : "Sold"} ${trade.ticker}
                        </p>
                        <p className="text-[11px] text-[#a99ab7]">
                          {trade.quantity.toFixed(4)} shares @ {trade.priceStkz.toFixed(2)} STKZ
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-display text-sm font-black text-white">
                        {trade.totalStkz.toFixed(2)} STKZ
                      </p>
                      <p className="text-[10px] text-[#8a7b97]">
                        {new Intl.DateTimeFormat([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(trade.createdAt))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 4: PRACTICE TRADING JOURNAL & GOALS */}
      {activeTab === "journal" && (
        <section className="mt-6">
          <PracticeJournal availableTickers={allTickers} />
        </section>
      )}
    </div>
  );
}