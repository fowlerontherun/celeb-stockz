import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, Lock, PackageOpen } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type WalletData = {
  balanceStkz: number;
  positions: Array<{ ticker: string; quantity: number }>;
};

type OrderType = "market" | "limit" | "stop_market" | "stop_limit";

type TradeControlsProps = {
  ticker: string;
  price: number;
  access?: {
    isStandard: boolean;
    isUnlocked: boolean;
    requiredPacks: Array<{ id: number; name: string }>;
  };
  onTradeComplete?: () => void;
};

const TRANSACTION_FEE_RATE = 0.01;

export function TradeControls({
  ticker,
  price,
  access,
  onTradeComplete,
}: TradeControlsProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [amount, setAmount] = useState("25");
  const [limitPrice, setLimitPrice] = useState(price.toFixed(2));
  const [stopPrice, setStopPrice] = useState(price.toFixed(2));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLocked = Boolean(access && !access.isUnlocked);

  const positionQuantity = useMemo(
    () => wallet?.positions.find((position) => position.ticker === ticker)?.quantity ?? 0,
    [ticker, wallet],
  );
  const grossMaxAmount =
    side === "buy" ? wallet?.balanceStkz ?? 0 : positionQuantity * price;
  const maxAmount =
    side === "buy" ? grossMaxAmount / (1 + TRANSACTION_FEE_RATE) : grossMaxAmount;
  const enteredAmount = Number(amount) || 0;
  const estimatedFee = Number(
    (Math.max(0, enteredAmount) * TRANSACTION_FEE_RATE).toFixed(2),
  );
  const needsLimit = orderType === "limit" || orderType === "stop_limit";
  const needsStop = orderType === "stop_market" || orderType === "stop_limit";

  const loadWallet = async () => {
    const response = await fetch("/api/wallet", { credentials: "include" });
    if (!response.ok) throw new Error("Could not load your STKZ wallet.");
    setWallet((await response.json()) as WalletData);
  };

  useEffect(() => {
    void loadWallet().catch((error: Error) => showError(error.message));
  }, []);

  useEffect(() => {
    setLimitPrice(price.toFixed(2));
    setStopPrice(price.toFixed(2));
  }, [price, ticker]);

  const submitTrade = async () => {
    if (isLocked) {
      showError(`Unlock ${access?.requiredPacks.map((p) => p.name).join(" or ")} to trade this market.`);
      return;
    }

    const amountStkz = Number(amount);
    const parsedLimit = Number(limitPrice);
    const parsedStop = Number(stopPrice);

    if (!Number.isFinite(amountStkz) || amountStkz <= 0) {
      showError("Enter a valid STKZ amount.");
      return;
    }
    if ((needsLimit && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) ||
      (needsStop && (!Number.isFinite(parsedStop) || parsedStop <= 0))) {
      showError("Enter valid trigger prices.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isMarketOrder = orderType === "market";
      const response = await fetch(isMarketOrder ? "/api/trades" : "/api/orders", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isMarketOrder
            ? { ticker, side, amountStkz }
            : {
                ticker,
                side,
                amountStkz,
                orderType,
                limitPrice: needsLimit ? parsedLimit : undefined,
                stopPrice: needsStop ? parsedStop : undefined,
              },
        ),
      });
      const data = (await response.json()) as {
        statusMessage?: string;
        quantity?: number;
        totalStkz?: number;
        feeStkz?: number;
      };
      if (!response.ok) throw new Error(data.statusMessage ?? "Your order could not be completed.");

      showSuccess(
        isMarketOrder
          ? `${side === "buy" ? "Bought" : "Sold"} ${data.quantity?.toFixed(2)} ${ticker} for ${data.totalStkz?.toFixed(2)} STKZ. 1% fee: ${data.feeStkz?.toFixed(2)} STKZ.`
          : `${orderType.replace(/_/g, " ")} order placed for ${ticker}. A 1% fee applies when it fills.`,
      );
      await loadWallet();
      window.dispatchEvent(new Event("wallet:updated"));
      window.dispatchEvent(new Event("orders:updated"));
      onTradeComplete?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Your order could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const priceInput = (label: string, value: string, onChange: (value: string) => void) => (
    <label className="block text-xs font-bold uppercase tracking-[.13em] text-[#a89aad]">
      {label}
      <input
        value={value}
        disabled={isLocked}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 text-base font-black text-white outline-none focus:border-[#a97cff] disabled:opacity-50"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="rounded-2xl border border-[#ff7282]/35 bg-[#31162b] p-4 text-center">
          <Lock size={20} className="mx-auto text-[#ff9ca5]" />
          <p className="mt-2 font-display text-base font-black text-[#ffb2bc]">
            Pack Unlock Required
          </p>
          <p className="mt-1 text-xs text-[#ddcad8]">
            This market is exclusive to {access?.requiredPacks.map((p) => p.name).join(" or ")}.
          </p>
          <Link
            to="/packs"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#ff7282] px-4 py-2 text-xs font-black text-[#401b2d] hover:bg-[#ff8e9a]"
          >
            <PackageOpen size={14} />
            Go to Celebrity Packs
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 rounded-xl bg-white/5 p-1">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={isLocked}
            onClick={() => setSide(option)}
            className={`rounded-lg py-2.5 text-sm font-black capitalize transition disabled:opacity-40 ${
              side === option
                ? option === "buy"
                  ? "bg-[#3ed9a3] text-[#112b24]"
                  : "bg-[#ff7282] text-[#401b2d]"
                : "text-[#a89aad]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([
          ["market", "Market"],
          ["limit", "Limit"],
          ["stop_market", "Stop market"],
          ["stop_limit", "Stop limit"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={isLocked}
            onClick={() => setOrderType(value)}
            className={`rounded-xl border px-3 py-2.5 text-xs font-black transition disabled:opacity-40 ${
              orderType === value
                ? "border-[#a97cff] bg-[#7c3aed] text-white"
                : "border-white/10 bg-white/[.04] text-[#b9acc9]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <div className="flex justify-between text-xs font-bold text-[#b6a8c1]">
          <span>{side === "buy" ? "Available to buy" : `Available ${ticker}`}</span>
          <span className="text-[#fff8f2]">
            {side === "buy"
              ? `${grossMaxAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })} STKZ`
              : `${positionQuantity.toFixed(4)} shares`}
          </span>
        </div>
        <label className="mt-4 block text-xs font-bold uppercase tracking-[.13em] text-[#a89aad]">
          Amount (STKZ)
          <div className="mt-2 flex gap-2">
            <input
              value={amount}
              disabled={isLocked}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 text-lg font-black text-white outline-none focus:border-[#a97cff] disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setAmount(maxAmount.toFixed(2))}
              disabled={isLocked || !wallet || maxAmount <= 0}
              className="rounded-xl bg-[#7c3aed] px-4 text-xs font-black text-white disabled:opacity-40"
            >
              Max
            </button>
          </div>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {needsLimit && priceInput("Limit price (STKZ)", limitPrice, setLimitPrice)}
          {needsStop && priceInput("Stop price (STKZ)", stopPrice, setStopPrice)}
        </div>
        <div className="mt-3 flex justify-between text-xs text-[#b6a8c1]">
          <span>Current modeled price</span>
          <span className="font-bold text-white">{price.toFixed(2)} STKZ</span>
        </div>
        <div className="mt-3 flex justify-between rounded-xl bg-[#ffd17b]/10 px-3 py-2 text-xs">
          <span className="font-bold text-[#ffd17b]">Transaction fee · 1%</span>
          <span className="font-black text-[#fff8f2]">~{estimatedFee.toFixed(2)} STKZ</span>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[#a89aad]">
          {side === "buy"
            ? "The fee is added to your purchase total."
            : "The fee is deducted from your sale proceeds."}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void submitTrade()}
        disabled={isLocked || isSubmitting || !wallet}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black disabled:opacity-50 ${
          side === "buy"
            ? "bg-[#3ed9a3] text-[#112b24]"
            : "bg-[#ff7282] text-[#401b2d]"
        }`}
      >
        {isSubmitting && <LoaderCircle size={17} className="animate-spin" />}
        {orderType === "market"
          ? `${side === "buy" ? "Buy" : "Sell"} ${ticker}`
          : `Place ${orderType.replace(/_/g, " ")} order`}
      </button>
    </div>
  );
}