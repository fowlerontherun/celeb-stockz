import { ChartNoAxesCombined } from "lucide-react";
import { Link } from "react-router-dom";

export function MarketTransparencyShortcut() {
  return (
    <Link
      to="/market-data"
      className="fixed bottom-36 left-3 z-30 inline-flex items-center gap-2 rounded-2xl border border-[#c99bff]/35 bg-[#211230]/95 px-4 py-3 text-xs font-black text-[#f3ebfa] shadow-2xl backdrop-blur transition hover:bg-[#2b1840] sm:bottom-20"
    >
      <ChartNoAxesCombined size={16} className="text-[#c99bff]" />
      Market details
    </Link>
  );
}