import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChartNoAxesCombined, Sparkles } from "lucide-react";
import { useAuthSession } from "@/lib/auth-client";
import { MarketTicker } from "@/components/MarketTicker";
import { MarketDiscovery } from "@/components/MarketDiscovery";

export function AccountGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useAuthSession();

  if (isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#120b20] text-[#e9dff1]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c99bff] border-t-transparent" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <>
        <MarketTicker />
        <MarketDiscovery />
        {children}
      </>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#120b20] px-5 text-[#fff8f2]">
      <section className="w-full max-w-md rounded-[30px] border border-white/10 bg-[#211230] p-7 shadow-2xl sm:p-9">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7c3aed] text-white">
          <ChartNoAxesCombined size={25} />
        </div>
        <p className="mt-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
          <Sparkles size={14} /> Own the spotlight
        </p>
        <h1 className="font-display mt-3 text-4xl font-black leading-none">
          Trade culture with <span className="text-[#ff7282]">STKZ.</span>
        </h1>
        <p className="mt-5 text-sm leading-6 text-[#c4b7ce]">
          Create your account to receive 10,000 STKZ for testing celebrity
          markets. STKZ purchases are not live yet.
        </p>
        <div className="mt-7 grid gap-3">
          <Link
            to="/auth/sign-up"
            className="rounded-xl bg-[#ff7282] px-5 py-3 text-center text-sm font-black text-[#401b2d]"
          >
            Create account · get 10,000 STKZ
          </Link>
          <Link
            to="/auth/sign-in"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-black text-[#eee4f3]"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}