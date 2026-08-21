import type { ReactNode } from "react";
import { useAuthSession } from "@/lib/auth-client";
import { MarketTicker } from "@/components/MarketTicker";
import { MarketDiscovery } from "@/components/MarketDiscovery";
import { MarketTransparencyShortcut } from "@/components/MarketTransparencyShortcut";
import { PackShortcut } from "@/components/PackShortcut";
import { PublicLanding } from "@/components/PublicLanding";

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
        <MarketTransparencyShortcut />
        <PackShortcut />
        {children}
      </>
    );
  }

  return <PublicLanding />;
}
