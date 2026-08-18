import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type WalletData = {
  balanceStkz: number;
  positions: Array<{ ticker: string; quantity: number }>;
};

type TradeControlsProps = {
  ticker: string;
  price: number;
  onTradeComplete?: () => void;
};

export function TradeControls({
  ticker,
  price,
  onTradeComplete,
}: TradeControlsProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("25");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const positionQuantity = useMemo(
    () => wallet?.positions.find((position) => position.ticker === ticker)?.quantity ?? 0,
    [ticker, wallet],
  );
  const sellMax = Number((positionQuantity * price).toFixed(2));
  const maxAmount = side === "buy" ? wallet?.balanceStkz ?? 0 : sellMax;

  const loadWallet = async () => {
    const response = await fetch("/api/wallet", { credentials: "include" });
    if (!response.ok) {
      throw new Error("Could not load your STKZ wallet.");
    }

    setWallet((await response.json()) as WalletData);
  };

  useEffect(() => {
    void loadWallet().catch((error: Error) => showError(error.message));
  }, []);

  useEffect(() => {
    setAmount(side === "buy" ? "25" : sellMax > 0 ? sellMax.toFixed(2) : "");
  }, [side, sellMax]);

  const submitTrade = async () => {
    const amountStkz = Number(amount);

    if (!Number.isFinite(amountStkz) || amountStkz <= 0) {
      showError("Enter a valid STKZ amount.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, side, amountStkz }),
      });
      const data = (await response.json()) as {
        statusMessage?: string;
        quantity?: number;
        totalStkz?: number;
      };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Your trade could not be completed.");
      }

      showSuccess(
        `${side === "buy" ? "Bought" : "Sold"} ${data.quantity?.toFixed(2)} ${ticker} for ${data.totalStkz?.toFixed(2)} STKZ.`,
      );
      await loadWallet();
      window.dispatchEvent(new Event("wallet:updated"));
      onTradeComplete?.();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Your trade could not be completed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-xl bg-white/5 p-1">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSide(option)}
            className={`rounded-lg py-2.5 text-sm font-black capitalize transition ${
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

      <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <div className="flex items-center justify-between text-xs font-bold text-[#b6a8c1]">
          <span>{side === "buy" ? "Available to buy" : `Available ${ticker}`}</span>
          <span className="text-[#fff8f2]">
            {side === "buy"
              ? `${maxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} STKZ`
              : `${positionQuantity.toFixed(4)} shares`}
          </span>
        </div>

        <label className="mt-4 block text-xs font-bold uppercase tracking-[.13em] text-[#a89aad]">
          Amount (STKZ)
          <div className="mt-2 flex gap-2">
            <input
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^0-9.]/g, ""))
              }
              inputMode="decimal"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 text-lg font-black text-white outline-none focus:border-[#a97cff]"
            />
            <button
              type="button"
              onClick={() => setAmount(maxAmount.toFixed(2))}
              disabled={!wallet || maxAmount <= 0}
              className="rounded-xl bg-[#7c3aed] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {side === "buy" ? "Buy max" : "Sell max"}
            </button>
          </div>
        </label>

        <div className="mt-3 flex justify-between text-xs text-[#b6a8c1]">
          <span>Market price</span>
          <span className="font-bold text-white">{price.toFixed(2)} STKZ</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void submitTrade()}
        disabled={isSubmitting || !wallet}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
          side === "buy"
            ? "bg-[#3ed9a3] text-[#112b24]"
            : "bg-[#ff7282] text-[#401b2d]"
        }`}
      >
        {isSubmitting && <LoaderCircle size={17} className="animate-spin" />}
        {side === "buy" ? `Buy ${ticker}` : `Sell ${ticker}`}
      </button>
    </div>
  );
}