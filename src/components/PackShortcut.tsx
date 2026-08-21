import { PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function PackShortcut() {
  return (
    <Link
      to="/packs"
      className="fixed bottom-24 right-3 z-30 inline-flex items-center gap-1.5 rounded-2xl border border-[#ffd17b]/40 bg-[#211230]/95 px-3 py-2.5 text-xs font-black text-[#f3ebfa] shadow-2xl backdrop-blur transition active:scale-95 hover:scale-105 hover:bg-[#2e1744] sm:bottom-36 sm:left-3 sm:right-auto sm:px-4 sm:py-3 sm:gap-2"
    >
      <PackageOpen size={15} className="text-[#ffd17b]" />
      <span className="hidden xs:inline sm:inline">Packs</span>
      <span className="rounded-lg bg-[#ffd17b] px-1.5 py-0.5 font-display text-[10px] font-black text-[#382600]">
        £1.99
      </span>
    </Link>
  );
}