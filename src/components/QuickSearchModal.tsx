import { useEffect, useMemo, useState } from "react";
import { Command, Lock, Search, Sparkles, TrendingUp, X } from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";
import { getCountryInfo } from "@/components/CategoryMarkets";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  markets: CategorizedCelebrity[];
  onSelectMarket: (market: CategorizedCelebrity) => void;
};

export function QuickSearchModal({ isOpen, onClose, markets, onSelectMarket }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets.slice(0, 8);

    return markets
      .filter((m) => {
        const country = getCountryInfo(m.nationality);
        return (
          m.name.toLowerCase().includes(q) ||
          m.ticker.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.nationality.toLowerCase().includes(q) ||
          country.label.toLowerCase().includes(q)
        );
      })
      .slice(0, 15);
  }, [markets, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 p-4 pt-16 sm:pt-24 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-[28px] border border-white/15 bg-[#211230] p-4 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Input */}
        <div className="relative flex items-center border-b border-white/10 pb-3">
          <Search size={18} className="absolute left-3 text-[#c99bff]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search celebrities, tickers, categories or countries…"
            className="w-full rounded-2xl border border-white/10 bg-[#140b20] py-3 pl-11 pr-10 text-sm font-semibold text-white outline-none focus:border-[#c99bff]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 rounded-lg p-1 text-[#a99ab7] hover:text-white"
            >
              <X size={16} />
            </button>
          ) : (
            <kbd className="absolute right-3 hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-[#b9a9c5] sm:inline-block">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
          {results.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#a99ab7]">
              No celebrities found matching "{query}"
            </div>
          ) : (
            results.map((market) => {
              const country = getCountryInfo(market.nationality);
              const isLocked = Boolean(market.access && !market.access.isUnlocked);

              return (
                <button
                  key={market.ticker}
                  type="button"
                  onClick={() => {
                    onSelectMarket(market);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-transparent p-3 text-left transition hover:border-white/10 hover:bg-white/[.04] active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[#140b20] p-1 border border-white/5">
                      <img
                        src={market.image}
                        alt={market.name}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = `/api/celebrity-images/${encodeURIComponent(market.ticker)}`;
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-sm font-black text-white">
                          {market.name}
                        </span>
                        <span className="text-xs">{country.flag}</span>
                        {isLocked && (
                          <span className="rounded bg-[#ff7282]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#ff9ca5]">
                            <Lock size={9} className="inline mr-0.5" /> Pack
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#a99ab7]">
                        ${market.ticker} · {market.category}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-sm font-black text-white">
                      {market.price.toFixed(2)} STKZ
                    </p>
                    <p
                      className={`text-[10px] font-bold ${
                        market.change >= 0 ? "text-[#62e7b6]" : "text-[#ff9ca5]"
                      }`}
                    >
                      {market.change >= 0 ? "+" : ""}
                      {market.change.toFixed(1)}%
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[11px] text-[#a99ab7]">
          <span>Tip: Press <kbd className="rounded bg-white/10 px-1 py-0.2">Cmd+K</kbd> anytime to open</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-[#c99bff] hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}