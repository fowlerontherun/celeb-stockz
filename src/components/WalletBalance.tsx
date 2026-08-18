import { useCallback, useEffect, useState } from "react";
import { UserRound, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

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
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 rounded-xl border border-[#8a60db]/50 bg-[#291845] px-3 py-2 text-xs font-bold text-[#e6d8ff] sm:flex">
        <Wallet size={15} className="text-[#ffd17b]" />
        {balance === null ? "Loading STKZ…" : `${balance.toLocaleString()} STKZ`}
      </div>
      <Link to="/profile" aria-label="Open profile settings" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#c99bff] hover:bg-white/10">
        <UserRound size={18} />
      </Link>
    </div>
  );
}