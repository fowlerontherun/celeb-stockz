import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";

export function WalletBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/wallet", { credentials: "include" })
      .then(response => response.ok ? response.json() : null)
      .then(data => setBalance(data?.balanceStkz ?? null));
  }, []);

  return <div className="hidden items-center gap-2 rounded-xl border border-[#8a60db]/50 bg-[#291845] px-3 py-2 text-xs font-bold text-[#e6d8ff] sm:flex"><Wallet size={15} className="text-[#ffd17b]"/>{balance === null ? "Loading STKZ…" : `${balance.toLocaleString()} STKZ`}</div>;
}
