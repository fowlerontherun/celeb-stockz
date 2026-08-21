import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  EyeOff,
  LoaderCircle,
  Lock,
  PackageOpen,
  Search,
  Users,
  X,
  Zap,
} from "lucide-react";
import { showError } from "@/utils/toast";

type PackMember = {
  ticker: string;
  name: string;
};

type Pack = {
  id: number;
  name: string;
  availableAt: string | null;
  isPublished: boolean;
  isAnnounced: boolean;
  memberCount: number;
  unlocked: boolean;
  isAvailable: boolean;
  members: PackMember[];
};

type StkzBundle = {
  sku: "STKZ_10000" | "STKZ_30000" | "STKZ_75000" | "STKZ_175000";
  amount: number;
  price: string;
  label: string;
};

type PackFilter =
  | "All"
  | "Sports"
  | "UK Culture & TV"
  | "Music & Hip Hop"
  | "Digital & Creators";

const stkzBundles: StkzBundle[] = [
  { sku: "STKZ_10000", amount: 10_000, price: "£1.99", label: "Starter top-up" },
  { sku: "STKZ_30000", amount: 30_000, price: "£4.99", label: "Popular" },
  { sku: "STKZ_75000", amount: 75_000, price: "£9.99", label: "Big bankroll" },
  { sku: "STKZ_175000", amount: 175_000, price: "£19.99", label: "Maximum top-up" },
];

const sportsPackIds = new Set([3, 7, 8, 9, 10, 11, 18, 19, 27, 28, 29, 30]);
const ukCulturePackIds = new Set([1, 2, 4, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
const musicPackIds = new Set([1, 6, 15, 16, 21, 22, 25, 36, 37, 38, 39, 40]);
const creatorPackIds = new Set([5, 23, 33, 34, 35]);

function packMatchesFilter(pack: Pack, filter: PackFilter) {
  if (filter === "Sports") return sportsPackIds.has(pack.id);
  if (filter === "UK Culture & TV") return ukCulturePackIds.has(pack.id);
  if (filter === "Music & Hip Hop") return musicPackIds.has(pack.id);
  if (filter === "Digital & Creators") return creatorPackIds.has(pack.id);
  return true;
}

function formatAvailableDate(value: string | null) {
  if (!value) return "Available now";
  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function Packs() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PackFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
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
    window.addEventListener("packs:sale_updated", loadPacks);
    return () => window.removeEventListener("packs:sale_updated", loadPacks);
  }, []);

  const beginCheckout = async (body: object, key: string) => {
    setBusyKey(key);
    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        statusMessage?: string;
      };
      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.statusMessage ?? "Checkout could not be started.");
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Checkout could not be started.");
      setBusyKey(null);
    }
  };

  const filteredPacks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return packs.filter((pack) => {
      if (!packMatchesFilter(pack, activeFilter)) return false;
      if (!query) return true;
      return (
        pack.name.toLowerCase().includes(query) ||
        pack.members?.some(
          (member) =>
            member.name.toLowerCase().includes(query) ||
            member.ticker.toLowerCase().includes(query),
        )
      );
    });
  }, [activeFilter, packs, searchQuery]);

  const unlockedCount = packs.filter((pack) => pack.unlocked).length;
  const availableCount = packs.filter((pack) => pack.isAvailable && !pack.unlocked).length;

  return (
    <main className="min-h-screen bg-[#120b20] px-4 py-6 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="text-sm font-bold text-[#c99bff] hover:text-white">
            ← Back to markets
          </Link>
          <Link
            to="/store"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-[#e6d8ff] hover:bg-white/10"
          >
            Account reset & store details
          </Link>
        </div>

        <header className="mt-7 rounded-[30px] border border-[#c99bff]/30 bg-[#211230] p-6 sm:p-8">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
            <CalendarDays size={15} /> CelebStockz Store
          </p>
          <h1 className="font-display mt-2 text-3xl font-black sm:text-5xl">
            Packs & <span className="text-[#ffd17b]">STKZ</span>
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#c9b8d4]">
            Top up your closed-loop game currency or permanently unlock celebrity collections. STKZ has no cash value and cannot be withdrawn or redeemed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[#e6d8ff]">52 weekly packs</span>
            <span className="rounded-xl border border-[#62e7b6]/30 bg-[#162725] px-3 py-2 text-[#62e7b6]">{availableCount} available now</span>
            <span className="rounded-xl border border-[#c99bff]/30 bg-[#291845] px-3 py-2 text-[#c99bff]">{unlockedCount} unlocked</span>
          </div>
        </header>

        <section className="mt-6 rounded-[28px] border border-[#ffd17b]/30 bg-[#24162c] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.16em] text-[#ffd17b]">
                <Coins size={16} /> Buy STKZ
              </p>
              <h2 className="font-display mt-1 text-2xl font-black sm:text-3xl">Add to your trading bankroll</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c8b8cc]">
                Purchased STKZ never expires. Game-earned STKZ is spent first, so any unspent paid balance is preserved if you reset your game.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stkzBundles.map((bundle) => (
              <article key={bundle.sku} className="rounded-2xl border border-white/10 bg-[#160c25] p-4">
                <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#c99bff]">{bundle.label}</p>
                <p className="font-display mt-2 text-2xl font-black">{bundle.amount.toLocaleString()}</p>
                <p className="text-xs font-black text-[#ffd17b]">STKZ</p>
                <button
                  type="button"
                  disabled={busyKey !== null}
                  onClick={() => void beginCheckout({ type: "stkz", sku: bundle.sku }, bundle.sku)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#9361f5] disabled:opacity-50"
                >
                  {busyKey === bundle.sku ? <LoaderCircle size={16} className="animate-spin" /> : <Coins size={15} />}
                  {busyKey === bundle.sku ? "Opening Stripe…" : `Buy · ${bundle.price}`}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#c99bff]">Celebrity collections</p>
              <h2 className="font-display mt-1 text-3xl font-black">Browse celebrity packs</h2>
              <p className="mt-1 text-sm text-[#a99ab7]">Available packs unlock permanently for £1.99 each.</p>
            </div>
            <div className="relative min-w-[230px]">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c99bff]" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search packs or celebrities…"
                className="w-full rounded-xl border border-white/10 bg-[#160c25] py-2.5 pl-9 pr-3 text-xs font-bold text-white outline-none focus:border-[#c99bff]"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["All", "Sports", "UK Culture & TV", "Music & Hip Hop", "Digital & Creators"] as PackFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition ${
                  activeFilter === filter
                    ? "bg-[#7c3aed] text-white"
                    : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <div className="mt-8 grid min-h-48 place-items-center text-[#c99bff]">
            <LoaderCircle className="animate-spin" size={24} />
          </div>
        ) : filteredPacks.length === 0 ? (
          <div className="mt-8 rounded-[26px] border border-dashed border-white/10 bg-white/[.02] p-10 text-center text-sm text-[#a99ab7]">
            No packs match your current search and filter.
          </div>
        ) : (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPacks.map((pack) => {
              const isClassified = !pack.unlocked && !pack.isAvailable && !pack.isAnnounced;
              const checkoutKey = `pack-${pack.id}`;
              return (
                <article
                  key={pack.id}
                  className={`flex flex-col justify-between rounded-[24px] border p-5 ${
                    pack.unlocked
                      ? "border-[#62e7b6]/30 bg-[#162725]"
                      : isClassified
                      ? "border-white/10 bg-[#190d26]/85"
                      : "border-white/10 bg-[#211230]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className={`grid h-10 w-10 place-items-center rounded-xl ${pack.unlocked ? "bg-[#62e7b6]/20 text-[#62e7b6]" : "bg-[#7c3aed]/25 text-[#c99bff]"}`}>
                        {pack.unlocked ? <CheckCircle2 size={19} /> : isClassified ? <EyeOff size={18} /> : <PackageOpen size={19} />}
                      </div>
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${pack.unlocked ? "bg-[#62e7b6]/15 text-[#62e7b6]" : pack.isAvailable ? "bg-[#ffd17b]/15 text-[#ffd17b]" : "bg-white/5 text-[#9f90ac]"}`}>
                        {pack.unlocked ? "UNLOCKED" : pack.isAvailable ? "AVAILABLE" : "UPCOMING"}
                      </span>
                    </div>
                    <p className="mt-4 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#c99bff]">Week {pack.id}</p>
                    <h3 className="font-display mt-1 text-xl font-black">{isClassified ? `Classified Pack #${pack.id}` : pack.name}</h3>
                    <p className="mt-2 text-sm text-[#bbaac6]">
                      {isClassified ? "Theme and roster will be revealed closer to release." : `${pack.memberCount} celebrity markets`}
                    </p>
                    {!isClassified && pack.members?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInspectingPack(pack)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#ffd17b] hover:underline"
                      >
                        <Users size={13} /> View roster <ChevronRight size={13} />
                      </button>
                    )}
                  </div>

                  <div className="mt-5 border-t border-white/10 pt-4">
                    {pack.unlocked ? (
                      <Link to="/" className="inline-flex items-center gap-2 text-xs font-black text-[#62e7b6]">
                        <CheckCircle2 size={14} /> Trade unlocked markets
                      </Link>
                    ) : pack.isAvailable ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-display text-lg font-black text-[#ffd17b]">£1.99</span>
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() => void beginCheckout({ type: "pack", packId: pack.id }, checkoutKey)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#ffd17b] px-4 py-2.5 text-xs font-black text-[#3d2a00] disabled:opacity-50"
                        >
                          {busyKey === checkoutKey ? <LoaderCircle size={14} className="animate-spin" /> : <Zap size={14} />}
                          {busyKey === checkoutKey ? "Opening…" : "Buy Pack"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs text-[#8c7b9a]">
                        <span className="flex items-center gap-1.5"><Lock size={13} /> {formatAvailableDate(pack.availableAt)}</span>
                        <span className="font-black text-[#ffd17b]">£1.99</span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {inspectingPack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setInspectingPack(null)}>
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-[28px] border border-[#c99bff]/30 bg-[#211230] p-6" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">Week {inspectingPack.id} · {inspectingPack.members.length} markets</p>
                  <h2 className="font-display mt-1 text-2xl font-black">{inspectingPack.name}</h2>
                  {inspectingPack.availableAt && <p className="mt-1 flex items-center gap-1 text-xs text-[#a99ab7]"><Clock size={12} /> {formatAvailableDate(inspectingPack.availableAt)}</p>}
                </div>
                <button type="button" onClick={() => setInspectingPack(null)} className="rounded-lg p-1 text-[#c4b4d0] hover:bg-white/10"><X size={18} /></button>
              </div>

              <div className="mt-4 grid flex-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {inspectingPack.members.map((member) => (
                  <div key={member.ticker} className="rounded-xl border border-white/5 bg-white/[.03] p-3">
                    <p className="text-xs font-black text-white">{member.name}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-[#8f809e]">${member.ticker}</p>
                  </div>
                ))}
              </div>

              {!inspectingPack.unlocked && inspectingPack.isAvailable && (
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <span className="font-display text-xl font-black text-[#ffd17b]">£1.99</span>
                  <button
                    type="button"
                    disabled={busyKey !== null}
                    onClick={() => void beginCheckout({ type: "pack", packId: inspectingPack.id }, `pack-${inspectingPack.id}`)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffd17b] px-5 py-2.5 text-xs font-black text-[#3d2a00] disabled:opacity-50"
                  >
                    {busyKey === `pack-${inspectingPack.id}` ? <LoaderCircle size={14} className="animate-spin" /> : <Zap size={14} />}
                    {busyKey === `pack-${inspectingPack.id}` ? "Opening Stripe…" : "Buy Pack · £1.99"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
