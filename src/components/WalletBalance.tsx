import { useCallback, useEffect, useState } from "react";
import {
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { authClient, useAuthSession } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { showError, showSuccess } from "@/utils/toast";

const adminEmails = new Set(["j.fowler1986@gmail.com"]);

function formatCompactBalance(val: number) {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return val.toFixed(0);
}

export function WalletBalance() {
  const navigate = useNavigate();
  const { data: session } = useAuthSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isAdmin = session?.user.email
    ? adminEmails.has(session.user.email.toLowerCase())
    : false;

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
      if (result.error) throw new Error(result.error.message ?? "Could not sign out.");
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
      {/* Desktop / Tablet Balance Pill */}
      <div className="hidden items-center gap-2 rounded-xl border border-[#8a60db]/50 bg-[#291845] px-3 py-2 text-xs font-bold text-[#e6d8ff] sm:flex">
        <Wallet size={15} className="text-[#ffd17b]" />
        {balance === null ? "Loading STKZ…" : `${balance.toLocaleString()} STKZ`}
      </div>

      {/* Mobile Compact Balance Badge */}
      <div className="flex items-center gap-1.5 rounded-xl border border-[#8a60db]/40 bg-[#291845] px-2.5 py-1.5 text-xs font-black text-[#e6d8ff] sm:hidden">
        <Wallet size={13} className="text-[#ffd17b]" />
        <span>{balance === null ? "…" : `${formatCompactBalance(balance)} STKZ`}</span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#c99bff] transition active:scale-95 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#a97cff]"
          >
            <UserRound size={17} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl border-white/10 bg-[#211230] p-2 text-[#fff8f2] shadow-2xl">
          <DropdownMenuItem onSelect={() => navigate("/profile")} className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold focus:bg-white/10 focus:text-white">
            <Settings size={16} className="mr-2 text-[#c99bff]" />
            Profile & settings
          </DropdownMenuItem>

          {isAdmin && (
            <>
              <DropdownMenuSeparator className="my-1 bg-white/10" />
              <DropdownMenuItem onSelect={() => navigate("/operations")} className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold text-[#ffd17b] focus:bg-[#ffd17b]/15 focus:text-[#ffe1a4]">
                <ShieldCheck size={16} className="mr-2" />
                Market control center
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator className="my-1 bg-white/10" />
          <DropdownMenuItem disabled={isSigningOut} onSelect={() => void signOut()} className="cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold text-[#ff9ca5] focus:bg-[#ff7282]/15 focus:text-[#ffb3bc]">
            <LogOut size={16} className="mr-2" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}