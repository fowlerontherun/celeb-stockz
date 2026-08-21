import { ChartNoAxesCombined } from "lucide-react";
import { Link } from "react-router-dom";

export function MarketTransparencyShortcut() {
  return (
    <Link
      to="/market-data"
      className="fixed bottom-24 left-3 z-30 inline-flex items-center gap-1.5 rounded-2xl border border-[#c99bff]/35 bg-[#211230]/95 px-3 py-2.5 text-xs font-black text-[#f3ebfa] shadow-2xl backdrop-blur transition active:scale-95 hover:bg-[#2b1840] sm:bottom-20 sm:px-4 sm:py-3 sm:gap-2"
    >
      <ChartNoAxesCombined size={15} className="text-[#c99bff]" />
      <span className="hidden xs:inline sm:inline">Methodology</span>
      <span className="xs:hidden sm:hidden">Info</span>
    </Link>
  );
}