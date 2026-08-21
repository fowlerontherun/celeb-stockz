import { Flame, PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function PackShortcut() {
  return (
    <Link
      to="/packs"
      className="fixed bottom-52 left-3 z-30 inline-flex items-center gap-2 rounded-2xl border border-[#ffd17b]/40 bg-[#211230]/95 px-4 py-3 text-xs font-black text-[#f3ebfa] shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-[#2e1744] sm:bottom-36"
    >
      <PackageOpen size={16} className="text-[#ffd17b]" />
      <span>Celebrity Packs</span>
      <span className="rounded-lg bg-[#ffd17b] px-1.5 py-0.5 font-display text-[10px] font-black text-[#382600]">
        £1.99
      </span>
    </Link>
  );
}