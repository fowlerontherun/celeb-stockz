import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, PackageOpen, Sparkles } from "lucide-react";
import { showError } from "@/utils/toast";

type Pack = {
  id: number;
  name: string;
  priceGbp: number;
  availableAt: string | null;
  isPublished: boolean;
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
        const data = (await response.json()) as { packs?: Pack[]; statusMessage?: string };
        if (!response.ok || !data.packs) {
          throw new Error(data.statusMessage ?? "Could not load celebrity packs.");
        }
        setPacks(data.packs);
      })
      .catch((error: Error) => showError(error.message))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link to="/" className="text-sm font-bold text-[#c99bff] hover:text-white">← Back to markets</Link>
        <header className="mt-8 rounded-[30px] border border-[#c99bff]/30 bg-[#211230] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]"><Sparkles size={15} /> Celebrity packs</p>
          <h1 className="font-display mt-3 text-3xl font-black sm:text-5xl">Expand your trading universe.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#c9b8d4]">Standard celebrities remain open to every player. Pack celebrities unlock as their curated collections are released.</p>
        </header>

        {isLoading ? (
          <div className="mt-8 text-sm font-bold text-[#c99bff]">Loading packs…</div>
        ) : (
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <article key={pack.id} className="rounded-[26px] border border-white/10 bg-[#211230] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#7c3aed] text-white"><PackageOpen size={21} /></div>
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${pack.unlocked ? "bg-[#183b33] text-[#62e7b6]" : pack.isAvailable ? "bg-[#ffd17b]/15 text-[#ffd17b]" : "bg-white/5 text-[#a99ab7]"}`}>
                    {pack.unlocked ? "UNLOCKED" : pack.isAvailable ? "AVAILABLE" : "COMING SOON"}
                  </span>
                </div>
                <p className="mt-5 text-xs font-extrabold uppercase tracking-[.13em] text-[#c99bff]">Pack {pack.id}</p>
                <h2 className="font-display mt-1 text-2xl font-black">{pack.name}</h2>
                <p className="mt-2 text-sm text-[#bbaac6]">{pack.memberCount} celebrity markets</p>
                <div className="mt-5 flex items-center justify-between rounded-xl bg-white/[.05] px-3 py-3">
                  <span className="text-sm font-bold">{pack.isAvailable ? `£${pack.priceGbp.toFixed(2)}` : pack.availableAt ? new Intl.DateTimeFormat([], { dateStyle: "medium" }).format(new Date(pack.availableAt)) : "Not scheduled"}</span>
                  {!pack.unlocked && <LockKeyhole size={16} className="text-[#c99bff]" />}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}