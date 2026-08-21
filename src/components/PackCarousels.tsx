import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Lock,
  PackageOpen,
  Sparkles,
  Zap,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type Pack = {
  id: number;
  name: string;
  priceGbp: number;
  originalPriceGbp: number;
  isDiscounted: boolean;
  discountPercent: number;
  availableAt: string | null;
  isPublished: boolean;
  isAnnounced: boolean;
  memberCount: number;
  unlocked: boolean;
  isAvailable: boolean;
  members: Array<{ ticker: string; name: string }>;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Available Now";
  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function PackCarousels() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [sale, setSale] = useState<{ active: boolean; discountPercent: number } | null>(null);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const publishedScrollRef = useRef<HTMLDivElement>(null);
  const upcomingScrollRef = useRef<HTMLDivElement>(null);

  const loadPacks = async () => {
    try {
      const response = await fetch("/api/packs", { credentials: "include" });
      if (response.ok) {
        const data = (await response.json()) as {
          packs?: Pack[];
          sale?: { active: boolean; discountPercent: number };
        };
        if (data.packs) setPacks(data.packs);
        if (data.sale) setSale(data.sale);
      }
    } catch {
      // Ignore background errors
    }
  };

  useEffect(() => {
    void loadPacks();
    window.addEventListener("markets:updated", loadPacks);
    return () => window.removeEventListener("markets:updated", loadPacks);
  }, []);

  const handleQuickUnlock = async (pack: Pack) => {
    setUnlockingId(pack.id);
    try {
      const response = await fetch(`/api/packs/${pack.id}/unlock`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as { statusMessage?: string };
      if (!response.ok) throw new Error(data.statusMessage ?? "Could not unlock pack.");

      showSuccess(`🎉 Unlocked ${pack.name}! You can now trade its 25+ exclusive markets.`);
      await loadPacks();
      window.dispatchEvent(new Event("markets:updated"));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not unlock pack.");
    } finally {
      setUnlockingId(null);
    }
  };

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: "left" | "right") => {
    if (ref.current) {
      const amount = direction === "left" ? -300 : 300;
      ref.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  const publishedPacks = packs.filter((p) => p.isAvailable || p.unlocked);
  const upcomingPacks = packs.filter((p) => !p.isAvailable && !p.unlocked);
  const unlockedCount = packs.filter((p) => p.unlocked).length;

  if (packs.length === 0) return null;

  return (
    <section className="mt-7 space-y-6">
      {/* 1. PUBLISHED PACKS CAROUSEL */}
      <div className="rounded-[28px] border border-[#ffd17b]/30 bg-[#251538] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ffd17b] text-[#3d2a00]">
              <PackageOpen size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-black text-white sm:text-xl">
                  Featured Celebrity Packs
                </h2>
                {sale?.active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ff4b2b] px-2 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
                    <Flame size={11} /> {sale.discountPercent}% OFF
                  </span>
                )}
              </div>
              <p className="text-xs text-[#d1c1dc]">
                Each pack unlocks 25+ exclusive celebrity & sports markets · Flat price <strong>£1.99</strong>
                {sale?.active ? ` (Now £${(1.99 * (1 - sale.discountPercent / 100)).toFixed(2)})` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unlockedCount > 0 && (
              <span className="hidden rounded-xl bg-[#62e7b6]/20 px-3 py-1.5 text-xs font-black text-[#62e7b6] sm:inline-flex">
                {unlockedCount} Unlocked
              </span>
            )}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => scroll(publishedScrollRef, "left")}
                aria-label="Scroll published packs left"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => scroll(publishedScrollRef, "right")}
                aria-label="Scroll published packs right"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <Link
              to="/packs"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-[#9361f5]"
            >
              All Packs →
            </Link>
          </div>
        </div>

        {/* Published Horizontal Carousel */}
        <div
          ref={publishedScrollRef}
          className="mt-4 flex gap-3.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth"
        >
          {publishedPacks.slice(0, 16).map((pack) => {
            const isUnlocking = unlockingId === pack.id;

            return (
              <article
                key={pack.id}
                className={`relative flex w-64 shrink-0 flex-col justify-between rounded-2xl border p-4 transition duration-200 ${
                  pack.unlocked
                    ? "border-[#62e7b6]/40 bg-[#162925]"
                    : "border-white/10 bg-[#1a0e2a] hover:border-[#ffd17b]/50 hover:bg-[#201235]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                      Pack #{pack.id}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[9px] font-black ${
                        pack.unlocked
                          ? "bg-[#62e7b6]/20 text-[#62e7b6]"
                          : "bg-[#ffd17b]/15 text-[#ffd17b]"
                      }`}
                    >
                      {pack.unlocked ? "UNLOCKED" : "AVAILABLE"}
                    </span>
                  </div>

                  <h3 className="font-display mt-2 line-clamp-1 text-base font-black text-white">
                    {pack.name}
                  </h3>

                  <p className="mt-1 text-xs text-[#a99ab7]">
                    {pack.memberCount} exclusive markets
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                  <div>
                    {pack.isDiscounted ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-sm font-black text-[#ffd17b]">
                          £{pack.priceGbp.toFixed(2)}
                        </span>
                        <span className="text-[10px] font-semibold text-[#8f7e9f] line-through">
                          £{pack.originalPriceGbp.toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <span className="font-display text-sm font-black text-[#ffd17b]">
                        £{pack.priceGbp.toFixed(2)}
                      </span>
                    )}
                  </div>

                  {pack.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#62e7b6]">
                      <CheckCircle2 size={13} /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isUnlocking}
                      onClick={() => void handleQuickUnlock(pack)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#ffd17b] px-3 py-1.5 text-xs font-black text-[#3d2a00] hover:bg-[#ffe29c] disabled:opacity-50"
                    >
                      <Zap size={12} />
                      {isUnlocking ? "…" : "Unlock"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* 2. UPCOMING WEEKLY DROPS CAROUSEL */}
      {upcomingPacks.length > 0 && (
        <div className="rounded-[28px] border border-white/10 bg-[#1b1029] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]/30 text-[#c99bff]">
                <CalendarDays size={18} />
              </div>
              <div>
                <h2 className="font-display text-lg font-black text-white sm:text-xl">
                  Upcoming 52-Week Drops (Sept 2025 – Aug 2026)
                </h2>
                <p className="text-xs text-[#a99ab7]">
                  A brand new celebrity pack scheduled to drop every Monday.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => scroll(upcomingScrollRef, "left")}
                  aria-label="Scroll upcoming drops left"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => scroll(upcomingScrollRef, "right")}
                  aria-label="Scroll upcoming drops right"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <span className="rounded-xl bg-white/5 px-3 py-1 text-xs font-bold text-[#c99bff]">
                {upcomingPacks.length} upcoming
              </span>
            </div>
          </div>

          {/* Upcoming Horizontal Carousel */}
          <div
            ref={upcomingScrollRef}
            className="mt-4 flex gap-3.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth"
          >
            {upcomingPacks.slice(0, 16).map((pack) => (
              <article
                key={pack.id}
                className="flex w-60 shrink-0 flex-col justify-between rounded-2xl border border-white/5 bg-white/[.02] p-4 hover:border-white/15"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#a99ab7]">
                      Week {pack.id}
                    </span>
                    <span className="flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-[#b9acc9]">
                      <Clock size={10} /> {formatDate(pack.availableAt)}
                    </span>
                  </div>

                  <h3 className="font-display mt-2 line-clamp-1 text-sm font-black text-white">
                    {pack.name}
                  </h3>

                  <p className="mt-1 text-[11px] text-[#8f7f9f]">
                    {pack.memberCount} celebrity markets
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                  <span className="font-bold text-[#ffd17b]">£1.99</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#a99ab7]">
                    <Lock size={11} /> Drops {formatDate(pack.availableAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}