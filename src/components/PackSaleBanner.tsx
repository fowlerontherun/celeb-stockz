import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Sparkles, Tag, X } from "lucide-react";

type SaleInfo = {
  active: boolean;
  discountPercent: number;
  bannerText: string;
  endsAt: string | null;
};

export function PackSaleBanner() {
  const [sale, setSale] = useState<SaleInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const loadSale = async () => {
      try {
        const response = await fetch("/api/packs/sale", { credentials: "include" });
        if (response.ok) {
          const data = (await response.json()) as SaleInfo;
          setSale(data);
        }
      } catch {
        // Ignore background failures
      }
    };

    void loadSale();
    window.addEventListener("packs:sale_updated", loadSale);
    return () => window.removeEventListener("packs:sale_updated", loadSale);
  }, []);

  if (!sale?.active || isDismissed) return null;

  return (
    <aside
      aria-label="Promotional pack sale"
      className="relative z-50 flex items-center justify-between border-b border-[#ffd17b]/40 bg-gradient-to-r from-[#ff416c] via-[#ff4b2b] to-[#8a2387] px-4 py-2.5 text-white shadow-xl backdrop-blur-md"
    >
      <div className="mx-auto flex flex-wrap items-center justify-center gap-2.5 text-center text-xs font-black tracking-wide sm:text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-0.5 text-[11px] font-black uppercase text-[#ffe2a4]">
          <Flame size={13} className="text-[#ffd17b]" />
          {sale.discountPercent}% OFF SALE
        </span>

        <span>{sale.bannerText}</span>

        <Link
          to="/packs"
          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1 font-display text-xs font-black text-[#93173a] shadow-md transition hover:bg-[#fff0f4] hover:scale-105"
        >
          <Tag size={13} />
          View All Packs (£{(1.99 * (1 - sale.discountPercent / 100)).toFixed(2)}) →
        </Link>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss sale banner"
        className="ml-2 rounded-lg p-1 text-white/80 hover:bg-black/20 hover:text-white"
      >
        <X size={16} />
      </button>
    </aside>
  );
}