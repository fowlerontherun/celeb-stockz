import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Dumbbell,
  EyeOff,
  Flame,
  Gamepad2,
  Globe2,
  LoaderCircle,
  Lock,
  Music2,
  PackageOpen,
  Search,
  Sparkles,
  Tag,
  Trophy,
  Tv,
  Users,
  X,
  Zap,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type PackMember = {
  ticker: string;
  name: string;
};

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
  members: PackMember[];
};

type SaleInfo = {
  active: boolean;
  discountPercent: number;
  bannerText: string;
  endsAt: string | null;
};

const packIcons: Record<number, typeof Trophy> = {
  1: Music2,
  2: Tv,
  3: Trophy,
  4: Sparkles,
  5: Gamepad2,
  6: Flame,
  7: Trophy,
  8: Zap,
  9: Dumbbell,
  10: Globe2,
  11: Trophy,
  12: Tv,
  13: Flame,
  14: Tv,
  15: Music2,
  16: Music2,
  17: Sparkles,
  18: Trophy,
  19: Trophy,
  20: Sparkles,
  21: Music2,
  22: Music2,
  23: Gamepad2,
  24: Tv,
  25: Music2,
  26: Tv,
  27: Trophy,
  28: Trophy,
  29: Trophy,
  30: Trophy,
  31: Sparkles,
  32: Sparkles,
  33: Gamepad2,
  34: Gamepad2,
  35: Gamepad2,
  36: Music2,
  37: Music2,
  38: Music2,
  39: Music2,
  40: Music2,
  41: Globe2,
  42: Globe2,
  43: Tv,
  44: Tv,
  45: Globe2,
  46: Tv,
  47: Tv,
  48: Sparkles,
  49: Tv,
  50: Sparkles,
  51: Flame,
  52: Trophy,
};

type PackFilter =
  | "All"
  | "Sports"
  | "UK Culture & TV"
  | "Music & Hip Hop"
  | "Digital & Creators";

export default function Packs() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [sale, setSale] = useState<SaleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<PackFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectingPack, setInspectingPack] = useState<Pack | null>(null);

  const loadPacks = async () => {
    try {
      const response = await fetch("/api/packs", { credentials: "include" });
      const data = (await response.json()) as {
        packs?: Pack[];
        sale?: SaleInfo;
        statusMessage?: string;
      };
      if (!response.ok || !data.packs) {
        throw new Error(data.statusMessage ?? "Could not load celebrity packs.");
      }
      setPacks(data.packs);
      if (data.sale) {
        setSale(data.sale);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load packs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPacks();
    window.addEventListener("packs:sale_updated", loadPacks);
    return () => window.removeEventListener("packs:sale_updated", loadPacks);
  }, []);

  const handleUnlock = async (pack: Pack) => {
    setUnlockingId(pack.id);
    try {
      const response = await fetch(`/api/packs/${pack.id}/unlock`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not unlock this pack.");
      }

      showSuccess(`Unlocked ${pack.name}! You can now trade its markets.`);
      await loadPacks();
      if (inspectingPack?.id === pack.id) {
        setInspectingPack((prev) => (prev ? { ...prev, unlocked: true } : null));
      }
      window.dispatchEvent(new Event("markets:updated"));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not unlock pack.");
    } finally {
      setUnlockingId(null);
    }
  };

  const unlockedCount = packs.filter((p) => p.unlocked).length;
  const sportsPacksCount = packs.filter((p) => [3, 7, 8, 9, 10, 11, 18, 19, 27, 28, 29, 30].includes(p.id)).length;
  const ukCultureCount = packs.filter((p) => [1, 2, 4, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(p.id)).length;

  const filteredPacks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return packs.filter((pack) => {
      if (activeFilter === "Sports" && ![3, 7, 8, 9, 10, 11, 18, 19, 27, 28, 29, 30].includes(pack.id)) return false;
      if (activeFilter === "UK Culture & TV" && ![1, 2, 4, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(pack.id)) return false;
      if (activeFilter === "Music & Hip Hop" && ![1, 6, 15, 16, 21, 22, 25, 36, 37, 38, 39, 40].includes(pack.id)) return false;
      if (activeFilter === "Digital & Creators" && ![5, 23, 33, 34, 35].includes(pack.id)) return false;

      if (query) {
        const matchesName = pack.name.toLowerCase().includes(query);
        const matchesMember = pack.members?.some(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            m.ticker.toLowerCase().includes(query),
        );
        return matchesName || matchesMember;
      }

      return true;
    });
  }, [activeFilter, packs, searchQuery]);

  function formatAvailableDate(dateStr: string | null) {
    if (!dateStr) return "Available Now";
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  }

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#c99bff] hover:text-white"
        >
          ← Back to markets
        </Link>

        <header className="mt-8 rounded-[30px] border border-[#c99bff]/30 bg-[#211230] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
                  <CalendarDays size={15} /> 52-Week Annual Release Schedule (Starting Sept 2025)
                </p>
                {sale?.active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ff4b2b] px-2.5 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
                    <Flame size={12} /> {sale.discountPercent}% OFF SALE
                  </span>
                )}
              </div>
              <h1 className="font-display mt-3 text-3xl font-black sm:text-5xl">
                52 Weekly Celebrity Packs
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#c9b8d4]">
                A brand new curated collection of <strong>25+ unique celebrity markets</strong> scheduled to launch every single week throughout the year. Standard pack price is <strong>£1.99</strong>
                {sale?.active ? ` (currently discounted to £${(1.99 * (1 - sale.discountPercent / 100)).toFixed(2)})` : ""}.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[#e6d8ff]">
                52 Weekly Packs
              </span>
              <span className="rounded-xl border border-[#62e7b6]/30 bg-[#162725] px-3 py-2 text-[#62e7b6]">
                {sportsPacksCount} Sports Collections
              </span>
              <span className="rounded-xl border border-[#ffd17b]/30 bg-[#291e30] px-3 py-2 text-[#ffd17b]">
                {ukCultureCount} UK Culture Sets
              </span>
              {unlockedCount > 0 && (
                <span className="rounded-xl bg-[#7c3aed] px-3 py-2 text-white">
                  {unlockedCount} Unlocked
                </span>
              )}
            </div>
          </div>

          {/* Search and Category Filter Bar */}
          <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "All",
                  "Sports",
                  "UK Culture & TV",
                  "Music & Hip Hop",
                  "Digital & Creators",
                ] as PackFilter[]
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveFilter(tab)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
                    activeFilter === tab
                      ? "bg-[#7c3aed] text-white shadow-lg"
                      : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {tab === "Sports" ? `⚽ Sports (${sportsPacksCount})` : tab}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px]">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c99bff]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packs or celebs…"
                className="w-full rounded-xl border border-white/10 bg-[#160c25] py-2 pl-9 pr-3 text-xs font-bold text-white outline-none focus:border-[#ffd17b]"
              />
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="mt-8 grid min-h-48 place-items-center text-sm font-bold text-[#c99bff]">
            <LoaderCircle className="animate-spin" size={24} />
          </div>
        ) : filteredPacks.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/10 bg-white/[.02] p-10 text-center text-sm text-[#a99ab7]">
            No packs found matching your search criteria.
          </div>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPacks.map((pack) => {
              const isClassified =
                !pack.unlocked && !pack.isAvailable && !pack.isAnnounced;
              const isUnlocking = unlockingId === pack.id;
              const Icon = packIcons[pack.id] ?? PackageOpen;
              const isSportsPack = [3, 7, 8, 9, 10, 11, 18, 19, 27, 28, 29, 30].includes(pack.id);

              return (
                <article
                  key={pack.id}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-[26px] border p-5 transition duration-200 ${
                    isClassified
                      ? "border-white/10 bg-[#190d26]/85"
                      : pack.unlocked
                      ? "border-[#62e7b6]/30 bg-[#162725]"
                      : "border-white/10 bg-[#211230] hover:border-[#c99bff]/50 hover:bg-[#251438]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`grid h-11 w-11 place-items-center rounded-2xl ${
                          pack.unlocked
                            ? "bg-[#62e7b6] text-[#112b24]"
                            : isClassified
                            ? "bg-white/5 text-[#9a89a8]"
                            : isSportsPack
                            ? "bg-[#62e7b6]/20 text-[#62e7b6]"
                            : "bg-[#7c3aed] text-white"
                        }`}
                      >
                        {pack.unlocked ? (
                          <CheckCircle2 size={22} />
                        ) : isClassified ? (
                          <EyeOff size={20} />
                        ) : (
                          <Icon size={21} />
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          {isSportsPack && (
                            <span className="rounded-lg bg-[#62e7b6]/15 px-2 py-0.5 text-[9px] font-black text-[#62e7b6]">
                              SPORTS
                            </span>
                          )}
                          <span
                            className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${
                              pack.unlocked
                                ? "bg-[#62e7b6]/20 text-[#62e7b6]"
                                : pack.isAvailable
                                ? "bg-[#ffd17b]/15 text-[#ffd17b]"
                                : "bg-[#c99bff]/15 text-[#c99bff]"
                            }`}
                          >
                            {pack.unlocked
                              ? "UNLOCKED"
                              : pack.isAvailable
                              ? "AVAILABLE"
                              : "WEEKLY DROP"}
                          </span>
                        </div>
                        {pack.availableAt && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-[#b9a9c5]">
                            <Clock size={10} className="text-[#ffd17b]" />
                            {formatAvailableDate(pack.availableAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-4 text-xs font-extrabold uppercase tracking-[.13em] text-[#c99bff]">
                      Week {pack.id} Release
                    </p>

                    <h2 className="font-display mt-1 text-xl font-black sm:text-2xl">
                      {isClassified ? (
                        <span className="tracking-wide text-[#b5a2c4]">
                          Classified Pack #{pack.id}
                        </span>
                      ) : (
                        pack.name
                      )}
                    </h2>

                    <p className="mt-2 text-sm leading-5 text-[#bbaac6]">
                      {isClassified
                        ? "Theme and celebrity market roster will be unveiled upon announcement."
                        : `${pack.memberCount} exclusive celebrity markets`}
                    </p>

                    {/* Preview Roster Button */}
                    {!isClassified && pack.members && pack.members.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInspectingPack(pack)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#ffd17b] hover:underline"
                      >
                        <Users size={13} /> View {pack.members.length} member roster <ChevronRight size={13} />
                      </button>
                    )}
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-4">
                    {pack.unlocked ? (
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs font-black text-[#62e7b6]">
                          <CheckCircle2 size={15} /> Pack Unlocked
                        </span>
                        <Link
                          to="/"
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                        >
                          Trade Markets
                        </Link>
                      </div>
                    ) : pack.isAvailable ? (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          {pack.isDiscounted ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-display text-lg font-black text-[#ffd17b]">
                                £{pack.priceGbp.toFixed(2)}
                              </span>
                              <span className="text-xs font-bold text-[#8f7e9f] line-through">
                                £{pack.originalPriceGbp.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-display text-lg font-black text-[#ffd17b]">
                              £{pack.priceGbp.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isUnlocking}
                          onClick={() => void handleUnlock(pack)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#ffd17b] px-4 py-2.5 text-xs font-black text-[#3d2a00] shadow-md transition hover:bg-[#ffe29c] disabled:opacity-50"
                        >
                          {isUnlocking ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Zap size={14} />
                          )}
                          {isUnlocking ? "Unlocking…" : "Unlock Now"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-xl bg-white/[.03] p-2.5 text-xs">
                        <span className="flex items-center gap-1.5 text-[#8c7b9a]">
                          <Lock size={13} /> Drops {formatAvailableDate(pack.availableAt)}
                        </span>
                        <span className="font-display font-black text-[#ffd17b]">
                          £1.99
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Member Roster Inspection Modal */}
        {inspectingPack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[28px] border border-[#c99bff]/30 bg-[#211230] p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                      Week {inspectingPack.id} Pack · {inspectingPack.members.length} Celebrity Markets
                    </span>
                    {inspectingPack.availableAt && (
                      <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-[#ffd17b]">
                        {formatAvailableDate(inspectingPack.availableAt)}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display mt-1 text-2xl font-black text-white">
                    {inspectingPack.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingPack(null)}
                  className="rounded-lg p-1 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                <p className="text-xs text-[#a99ab7]">
                  All {inspectingPack.members.length} celebrity markets in this collection:
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {inspectingPack.members.map((member) => (
                    <div
                      key={member.ticker}
                      className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[.03] p-2.5"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#7c3aed]/25 font-display text-xs font-black text-[#c99bff]">
                        ${member.ticker.slice(0, 3)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-white">{member.name}</p>
                        <p className="text-[10px] font-bold text-[#8f809e]">${member.ticker}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                {inspectingPack.unlocked ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#62e7b6]">
                      ✓ You have unlocked this collection
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectingPack(null)}
                      className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      {inspectingPack.isDiscounted ? (
                        <>
                          <span className="font-display text-xl font-black text-[#ffd17b]">
                            £{inspectingPack.priceGbp.toFixed(2)}
                          </span>
                          <span className="text-xs font-bold text-[#8f7e9f] line-through">
                            £{inspectingPack.originalPriceGbp.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="font-display text-xl font-black text-[#ffd17b]">
                          £{inspectingPack.priceGbp.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={unlockingId === inspectingPack.id}
                      onClick={() => void handleUnlock(inspectingPack)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#ffd17b] px-5 py-2.5 text-xs font-black text-[#3d2a00] hover:bg-[#ffe29c] disabled:opacity-50"
                    >
                      <Zap size={14} />
                      {unlockingId === inspectingPack.id ? "Unlocking…" : "Unlock Pack Now"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}