import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  EyeOff,
  LockKeyhole,
  PackageOpen,
  Sparkles,
} from "lucide-react";
import { showError } from "@/utils/toast";

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
};

export default function Packs() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/packs", { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json()) as {
          packs?: Pack[];
          statusMessage?: string;
        };
        if (!response.ok || !data.packs) {
          throw new Error(data.statusMessage ?? "Could not load celebrity packs.");
        }
        setPacks(data.packs);
      })
      .catch((error: Error) => showError(error.message))
      .finally(() => setIsLoading(false));
  }, []);

  const totalPacks = packs.length;
  const unlockedCount = packs.filter((p) => p.unlocked).length;
  const announcedCount = packs.filter((p) => p.isAnnounced || p.isPublished || p.unlocked).length;
  const classifiedCount = totalPacks - announcedCount;

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
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
                <Sparkles size={15} /> Celebrity packs
              </p>
              <h1 className="font-display mt-3 text-3xl font-black sm:text-5xl">
                Expand your trading universe.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9b8d4]">
                Standard celebrities remain accessible to every player. Upcoming packs stay classified until officially announced and launched.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[#e6d8ff]">
                {announcedCount} revealed
              </span>
              {classifiedCount > 0 && (
                <span className="rounded-xl border border-white/10 bg-[#2f183d] px-3 py-2 text-[#e8b5ff]">
                  {classifiedCount} classified
                </span>
              )}
              {unlockedCount > 0 && (
                <span className="rounded-xl bg-[#183b33] px-3 py-2 text-[#62e7b6]">
                  {unlockedCount} unlocked
                </span>
              )}
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="mt-8 grid min-h-48 place-items-center text-sm font-bold text-[#c99bff]">
            Loading packs…
          </div>
        ) : (
          <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => {
              const isClassified =
                !pack.unlocked && !pack.isAvailable && !pack.isAnnounced;

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
                            : "bg-[#7c3aed] text-white"
                        }`}
                      >
                        {pack.unlocked ? (
                          <CheckCircle2 size={22} />
                        ) : isClassified ? (
                          <EyeOff size={20} />
                        ) : (
                          <PackageOpen size={21} />
                        )}
                      </div>

                      <span
                        className={`rounded-lg px-2.5 py-1 text-[10px] font-black tracking-wider ${
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

                    <p className="mt-5 text-xs font-extrabold uppercase tracking-[.13em] text-[#c99bff]">
                      Pack {pack.id}
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
                        : `${pack.memberCount} celebrity market${
                            pack.memberCount === 1 ? "" : "s"
                          }`}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between rounded-xl bg-white/[.04] px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        {pack.availableAt && !isClassified ? (
                          <CalendarDays size={14} className="text-[#c99bff]" />
                        ) : null}
                        <span className="text-xs font-bold text-[#e6d8ff]">
                          {pack.unlocked
                            ? "Full Access"
                            : pack.isAvailable
                            ? `£${pack.priceGbp.toFixed(2)}`
                            : pack.availableAt && !isClassified
                            ? new Intl.DateTimeFormat([], {
                                dateStyle: "medium",
                              }).format(new Date(pack.availableAt))
                            : "To be announced"}
                        </span>
                      </div>
                      {!pack.unlocked && (
                        <LockKeyhole size={15} className="text-[#c99bff]" />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}