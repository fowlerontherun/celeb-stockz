import { useCallback, useEffect, useState } from "react";
import { LogOut, Settings, UserRound, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from "@/utils/toast";

export function WalletBalance() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadBalance = useCallback(async () => {
    const response = await fetch("/api/wallet", { credentials: "include" });
    const data = response.ok
      ? ((await response.json()) as { balanceStkz: number })
      : null;
    setBalance(data?.balanceStkz ?? null);
  }, []);

  useEffect(() => {
    void loadBalance();
    window.addEventListener("wallet:updated", loadBalance);
    return () => window.removeEventListener("wallet:updated", loadBalance);
  }, [loadBalance]);

  const signOut = async () => {
    setIsSigningOut(true);

    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message ?? "Could not sign out.");
      }

      showSuccess("You have been signed out.");
      navigate("/auth/sign-in", { replace: true });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 rounded-xl border border-[#8a60db]/50 bg-[#291845] px-3 py-2 text-xs font-bold text-[#e6d8ff] sm:flex">
        <Wallet size={15} className="text-[#ffd17b]" />
        {balance === null ? "Loading STKZ…" : `${balance.toLocaleString()} STKZ`}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#c99bff] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#a97cff]"
          >
            <UserRound size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 rounded-2xl border-white/10 bg-[#211230] p-2 text-[#fff8f2]"
        >
          <DropdownMenuItem
            onSelect={() => navigate("/profile")}
            className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold focus:bg-white/10 focus:text-white"
          >
            <Settings size={16} className="mr-2 text-[#c99bff]" />
            Profile & settings
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isSigningOut}
            onSelect={() => void signOut()}
            className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold text-[#ff9ca5] focus:bg-[#ff7282]/15 focus:text-[#ffb3bc]"
          >
            <LogOut size={16} className="mr-2" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}