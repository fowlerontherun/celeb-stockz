import { useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";

export function WalletBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  const loadBalance = useCallback(async () => {
    const response = await fetch("/api/wallet", { credentials: "include" });
    const data = response.ok ? ((await response.json()) as { balanceStkz: number }) : null;
    setBalance(data?.balanceStkz ?? null);
  }, []);

  useEffect(() => {
    void loadBalance();
    window.addEventListener("wallet:updated", loadBalance);
    return () => window.removeEventListener("wallet:updated", loadBalance);
  }, [loadBalance]);

  return (
    <div className="hidden items-center gap-2 rounded-xl border border-[#8a60db]/50 bg-[#291845] px-3 py-2 text-xs font-bold text-[#e6d8ff] sm:flex">
      <Wallet size={15} className="text-[#ffd17b]" />
      {balance === null ? "Loading STKZ…" : `${balance.toLocaleString()} STKZ`}
    </div>
  );
}