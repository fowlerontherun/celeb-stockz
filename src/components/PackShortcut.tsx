import { PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function PackShortcut() {
  return (
    <Link
      to="/packs"
      className="fixed bottom-52 left-3 z-30 inline-flex items-center gap-2 rounded-2xl border border-[#ffd17b]/35 bg-[#211230]/95 px-4 py-3 text-xs font-black text-[#f3ebfa] shadow-2xl backdrop-blur transition hover:bg-[#2b1840] sm:bottom-36"
    >
      <PackageOpen size={16} className="text-[#ffd17b]" />
      Celebrity packs
    </Link>
  );
}