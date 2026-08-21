import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  EyeOff,
  Flame,
  Gamepad2,
  Globe2,
  LoaderCircle,
  Lock,
  Music2,
  PackageOpen,
  Sparkles,
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
  availableAt: string | null;
  isPublished: boolean;
  isAnnounced: boolean;
  memberCount: number;
  unlocked: boolean;
  isAvailable: boolean;
  members: PackMember[];
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
};

type PackFilter = "All" | "Sports" | "Music & Entertainment" | "Digital & Creators";

export default function Packs() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<PackFilter>("All");
  const [inspectingPack, setInspectingPack] = useState<Pack | null>(null);

  const loadPacks = async () => {
    try {
      const response = await fetch("/api/packs", { credentials: "include" });
      const data = (await response.json()) as {
        packs?: Pack[];
        statusMessage?: string;
      };
      if (!response.ok || !data.packs) {
        throw new Error(data.statusMessage ?? "Could not load celebrity packs.");
      }
      setPacks(data.packs);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load packs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPacks();
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
  const announcedCount = packs.filter((p) => p.isAnnounced || p.isPublished || p.unlocked).length;
  const sportsPacksCount = packs.filter((p) => [3, 7, 8, 9, 10, 11].includes(p.id)).length;

  const filteredPacks = packs.filter((pack) => {
    if (activeFilter === "Sports") return [3, 7, 8, 9, 10, 11].includes(pack.id);
    if (activeFilter === "Music & Entertainment") return [1, 2, 4, 6].includes(pack.id);
    if (activeFilter === "Digital & Creators") return [5].includes(pack.id);
    return true;
  });

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
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
                <Sparkles size={15} /> Celebrity packs marketplace
              </p>
              <h1 className="font-display mt-3 text-3xl font-black sm:text-5xl">
                Expand your trading universe.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9b8d4]">
                Unlock specialty collections including <strong>6 dedicated Sports Packs</strong> (NBA, F1, Combat, Tennis & Golf, NFL/MLB, and European Football), plus K-Pop, British Music, Creators, and Screen Stars.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[#e6d8ff]">
                {announcedCount} packs available
              </span>
              <span className="rounded-xl border border-[#62e7b6]/30 bg-[#162725] px-3 py-2 text-[#62e7b6]">
                {sportsPacksCount} sports collections
              </span>
              {unlockedCount > 0 && (
                <span className="rounded-xl bg-[#7c3aed] px-3 py-2 text-white">
                  {unlockedCount} unlocked
                </span>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-7 flex flex-wrap gap-2 border-t border-white/10 pt-5">
            {(["All", "Sports", "Music & Entertainment", "Digital & Creators"] as PackFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveFilter(tab)}
                className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${
                  activeFilter === tab
                    ? "bg-[#7c3aed] text-white shadow-lg"
                    : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
                }`}
              >
                {tab === "Sports" ? `⚽ Sports Collections (${sportsPacksCount})` : tab}
              </button>
            ))}
          </div>
        </header>

        {isLoading ? (
          <div className="mt-8 grid min-h-48 place-items-center text-sm font-bold text-[#c99bff]">
            <LoaderCircle className="animate-spin" size={24} />
          </div>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPacks.map((pack) => {
              const isClassified =
                !pack.unlocked && !pack.isAvailable && !pack.isAnnounced;
              const isUnlocking = unlockingId === pack.id;
              const Icon = packIcons[pack.id] ?? PackageOpen;
              const isSportsPack = [3, 7, 8, 9, 10, 11].includes(pack.id);

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

                      <div className="flex items-center gap-1.5">
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
                              : isClassified
                              ? "bg-white/5 text-[#8f809e]"
                              : "bg-[#c99bff]/15 text-[#c99bff]"
                          }`}
                        >
                          {pack.unlocked
                            ? "UNLOCKED"
                            : pack.isAvailable
                            ? "AVAILABLE"
                            : isClassified
                            ? "CLASSIFIED"
                            : "UPCOMING"}
                        </span>
                      </div>
                    </div>

                    <p className="mt-5 text-xs font-extrabold uppercase tracking-[.13em] text-[#c99bff]">
                      Pack #{pack.id}
                    </p>

                    <h2 className="font-display mt-1 text-2xl font-black">
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
                        : `${pack.memberCount} exclusive celebrity market${
                            pack.memberCount === 1 ? "" : "s"
                          }`}
                    </p>

                    {/* Preview Roster Button */}
                    {!isClassified && pack.members && pack.members.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInspectingPack(pack)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#c99bff] hover:text-white"
                      >
                        <Users size={13} /> View {pack.members.length} members <ChevronRight size={13} />
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
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={isUnlocking}
                          onClick={() => void handleUnlock(pack)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ffd17b] py-3 text-xs font-black text-[#3d2a00] shadow-md transition hover:bg-[#ffe29c] disabled:opacity-50"
                        >
                          {isUnlocking ? (
                            <LoaderCircle size={15} className="animate-spin" />
                          ) : (
                            <Zap size={15} />
                          )}
                          {isUnlocking ? "Unlocking…" : `Unlock Pack · £${pack.priceGbp.toFixed(2)}`}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-[#8c7b9a]">
                        <Lock size={14} /> Locked until launch
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
            <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-[28px] border border-[#c99bff]/30 bg-[#211230] p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                    Pack #{inspectingPack.id} · {inspectingPack.members.length} Celebrities
                  </span>
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
                  Unlocking this pack grants full practice trading access to all {inspectingPack.members.length} celebrity markets below:
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
                    <span className="font-display text-lg font-black text-[#ffd17b]">
                      £{inspectingPack.priceGbp.toFixed(2)}
                    </span>
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