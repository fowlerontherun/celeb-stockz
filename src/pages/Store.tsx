import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Coins, LoaderCircle, PackageOpen, RotateCcw, ShoppingBag } from "lucide-react";
import { WalletBalance } from "@/components/WalletBalance";
import { showError, showSuccess } from "@/utils/toast";

type Pack = {
  id: number;
  name: string;
  unlocked: boolean;
  isAvailable: boolean;
  memberCount: number;
};

type Bundle = {
  sku: "STKZ_10000" | "STKZ_30000" | "STKZ_75000" | "STKZ_175000";
  amount: number;
  price: string;
};

const bundles: Bundle[] = [
  { sku: "STKZ_10000", amount: 1.99, price: "£1.99" },
  { sku: "STKZ_30000", amount: 4.99, price: "£4.99" },
  { sku: "STKZ_75000", amount: 9.99, price: "£9.99" },
  { sku: "STKZ_175000", amount: 19.99, price: "£19.99" },
];

export default function Store() {
  const [searchParams] = useSearchParams();
  const [packs, setPacks] = useState<Pack[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const availablePacks = useMemo(
    () => packs.filter((pack) => pack.isAvailable && !pack.unlocked),
    [packs],
  );

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      showSuccess("Payment received. Your purchase is being applied to your CelebStockz account.");
      window.dispatchEvent(new Event("wallet:updated"));
      window.dispatchEvent(new Event("markets:updated"));
    }
    if (searchParams.get("checkout") === "cancelled") {
      showError("Checkout was cancelled. Nothing was charged by CelebStockz.");
    }
  }, [searchParams]);

  useEffect(() => {
    void fetch("/api/packs", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load celebrity packs.");
        return response.json() as Promise<{ packs: Pack[] }>;
      })
      .then((data) => setPacks(data.packs ?? []))
      .catch((error: Error) => showError(error.message));
  }, []);

  const beginCheckout = async (body: object, key: string) => {
    setBusyKey(key);
    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { checkoutUrl?: string; statusMessage?: string };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.statusMessage ?? "Checkout could not be started.");
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Checkout could not be started.");
      setBusyKey(null);
    }
  };

  const resetAccount = async () => {
    if (!window.confirm("Start fresh? Holdings, queued orders and trade history are cleared. Your unlocked packs and any unspent purchased STKZ are preserved.")) return;
    setIsResetting(true);
    try {
      const response = await fetch("/api/account-reset", { method: "POST", credentials: "include" });
      const data = (await response.json()) as { balanceStkz?: number; preservedPurchasedStkz?: number; statusMessage?: string };
      if (!response.ok) throw new Error(data.statusMessage ?? "Could not reset account.");
      window.dispatchEvent(new Event("wallet:updated"));
      window.dispatchEvent(new Event("markets:updated"));
      showSuccess(`Fresh start complete: ${data.balanceStkz?.toLocaleString()} STKZ available.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not reset account.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#120b20] px-4 py-6 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-bold text-[#c99bff] hover:text-white">← Back to markets</Link>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">CelebStockz Store</p>
            <h1 className="font-display mt-1 text-4xl font-black">Top up your game.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#b9a9c5]">
              Buy permanent celebrity packs or add closed-loop STKZ. For the market simulation, 1 STKZ is valued at £1. STKZ remains an in-game currency only and cannot currently be withdrawn, redeemed or exchanged for cash.
            </p>
          </div>
          <WalletBalance />
        </header>

        <section className="mt-8 rounded-[28px] border border-[#ffd17b]/25 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#ffd17b]"><Coins size={19} /><h2 className="font-display text-2xl font-black">Buy STKZ</h2></div>
          <p className="mt-2 text-sm text-[#b9a9c5]">Top-ups now use exact £1-for-1 STKZ parity: £9.99 adds 9.99 STKZ. Purchased STKZ never expires and any unspent paid balance survives an account reset.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {bundles.map((bundle) => (
              <article key={bundle.sku} className="rounded-2xl border border-white/10 bg-[#160c25] p-4">
                <p className="font-display text-2xl font-black">{bundle.amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                <p className="text-xs font-bold text-[#c99bff]">STKZ · £1 = 1 STKZ</p>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => void beginCheckout({ type: "stkz", sku: bundle.sku }, bundle.sku)}
                  className="mt-4 w-full rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  {busyKey === bundle.sku ? <LoaderCircle className="mx-auto animate-spin" size={17} /> : `Buy · ${bundle.price}`}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#c99bff]"><PackageOpen size={19} /><h2 className="font-display text-2xl font-black">Celebrity packs</h2></div>
          <p className="mt-2 text-sm text-[#b9a9c5]">Each £1.99 pack permanently unlocks its included celebrity markets on this account.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availablePacks.slice(0, 18).map((pack) => (
              <article key={pack.id} className="rounded-2xl border border-white/10 bg-[#160c25] p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="font-black">{pack.name}</p><p className="mt-1 text-xs text-[#9f90ac]">{pack.memberCount}+ celebrity markets</p></div><ShoppingBag size={17} className="text-[#ffd17b]" /></div>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => void beginCheckout({ type: "pack", packId: pack.id }, `pack-${pack.id}`)}
                  className="mt-4 w-full rounded-xl bg-[#ffd17b] px-4 py-2.5 text-sm font-black text-[#3a2600] disabled:opacity-50"
                >
                  {busyKey === `pack-${pack.id}` ? <LoaderCircle className="mx-auto animate-spin" size={17} /> : "Unlock · £1.99"}
                </button>
              </article>
            ))}
            {availablePacks.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-[#a99ab7]">
                <CheckCircle2 className="mb-2 text-[#62e7b6]" /> No currently available locked packs.
              </div>
            )}
          </div>
          <Link to="/packs" className="mt-5 inline-block text-sm font-black text-[#c99bff] hover:text-white">Browse all celebrity packs →</Link>
        </section>

        <section className="mt-6 rounded-[28px] border border-[#ff7282]/30 bg-[#2d1428] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#ff9ca5]"><RotateCcw size={19} /><h2 className="font-display text-2xl font-black">Start over for free</h2></div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d6c6d4]">Reset your game back to the £100-equivalent starting balance: 100 base STKZ. Your permanent pack unlocks remain yours and any unspent purchased STKZ is added on top of the fresh 100.</p>
          <button type="button" disabled={isResetting} onClick={() => void resetAccount()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ff7282] px-5 py-3 text-sm font-black text-[#401b2d] disabled:opacity-50">
            {isResetting ? <LoaderCircle className="animate-spin" size={16} /> : <RotateCcw size={16} />}
            {isResetting ? "Resetting…" : "Reset to 100 STKZ"}
          </button>
        </section>
      </div>
    </main>
  );
}
