import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  LoaderCircle,
  PackageOpen,
  Percent,
  Plus,
  Save,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type PackMember = {
  ticker: string;
  name: string;
  category: string;
};

type Pack = {
  id: number;
  name: string;
  price_gbp: string | number;
  available_at: string | null;
  is_published: boolean;
  is_announced: boolean;
  member_count: number;
  members: PackMember[];
};

type MarketListing = {
  ticker: string;
  name: string;
  category: string;
};

type SaleConfig = {
  active: boolean;
  discountPercent: number;
  bannerText: string;
  endsAt: string | null;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function PackManagement() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [availableMarkets, setAvailableMarkets] = useState<MarketListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [selectedTickerToAdd, setSelectedTickerToAdd] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [removingTicker, setRemovingTicker] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Global Sale State
  const [saleActive, setSaleActive] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(30);
  const [bannerText, setBannerText] = useState(
    "🔥 FLASH SALE: All Celebrity Packs are 30% OFF! Unlock 25+ exclusive markets for just £1.39.",
  );
  const [isSavingSale, setIsSavingSale] = useState(false);

  // New Pack Dialog State
  const [isCreatingPack, setIsCreatingPack] = useState(false);
  const [newPackName, setNewPackName] = useState("");
  const [newPackPrice, setNewPackPrice] = useState("1.99");
  const [newPackDate, setNewPackDate] = useState("");
  const [newPackAnnounced, setNewPackAnnounced] = useState(true);
  const [newPackPublished, setNewPackPublished] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [packsRes, marketsRes, saleRes] = await Promise.all([
        fetch("/api/internal/packs", { credentials: "include" }),
        fetch("/api/markets", { credentials: "include" }),
        fetch("/api/packs/sale", { credentials: "include" }),
      ]);

      const packsData = (await packsRes.json()) as {
        packs?: Pack[];
        statusMessage?: string;
      };
      const marketsData = (await marketsRes.json()) as {
        markets?: MarketListing[];
      };
      const saleData = (await saleRes.json()) as SaleConfig;

      if (!packsRes.ok || !packsData.packs) {
        throw new Error(packsData.statusMessage ?? "Could not load celebrity packs.");
      }

      const formattedPacks = packsData.packs.map((p) => ({
        ...p,
        is_announced: Boolean(p.is_announced),
        members: Array.isArray(p.members) ? p.members : [],
      }));

      setPacks(formattedPacks);
      if (formattedPacks.length > 0 && selectedPackId === null) {
        setSelectedPackId(formattedPacks[0].id);
      }

      if (marketsData?.markets) {
        setAvailableMarkets(marketsData.markets);
      }

      if (saleData) {
        setSaleActive(saleData.active);
        setDiscountPercent(saleData.discountPercent || 30);
        if (saleData.bannerText) setBannerText(saleData.bannerText);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load packs.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedPackId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updatePackLocal = (id: number, changes: Partial<Pack>) => {
    setPacks((current) =>
      current.map((pack) =>
        pack.id === id ? { ...pack, ...changes } : pack,
      ),
    );
  };

  const savePack = async (pack: Pack) => {
    const priceGbp = Number(pack.price_gbp);

    if (!Number.isFinite(priceGbp) || priceGbp < 0) {
      showError("Enter a valid pack price.");
      return;
    }

    setSavingId(pack.id);

    try {
      const response = await fetch(`/api/internal/packs/${pack.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          priceGbp,
          availableAt: pack.available_at,
          isPublished: pack.is_published,
          isAnnounced: pack.is_announced,
        }),
      });
      const data = (await response.json()) as {
        price_gbp?: string;
        available_at?: string | null;
        is_published?: boolean;
        is_announced?: boolean;
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not save this pack.");
      }

      updatePackLocal(pack.id, {
        price_gbp: data.price_gbp ?? priceGbp,
        available_at: data.available_at ?? pack.available_at,
        is_published: data.is_published ?? pack.is_published,
        is_announced: data.is_announced ?? pack.is_announced,
      });
      showSuccess(`${pack.name} settings updated.`);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not save this pack.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const saveSaleConfig = async () => {
    setIsSavingSale(true);
    try {
      const response = await fetch("/api/internal/packs/sale", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          active: saleActive,
          discountPercent,
          bannerText,
        }),
      });

      const data = (await response.json()) as { statusMessage?: string };
      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not update sale configuration.");
      }

      showSuccess(
        saleActive
          ? `Pack Sale activated with ${discountPercent}% discount and global banner!`
          : "Pack Sale deactivated.",
      );
      window.dispatchEvent(new Event("packs:sale_updated"));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save sale configuration.");
    } finally {
      setIsSavingSale(false);
    }
  };

  const handleCreatePack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackName.trim()) {
      showError("Please provide a name for the new pack.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/internal/packs", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newPackName.trim(),
          priceGbp: Number(newPackPrice) || 1.99,
          availableAt: newPackDate ? new Date(newPackDate).toISOString() : null,
          isPublished: newPackPublished,
          isAnnounced: newPackAnnounced,
        }),
      });

      const data = (await response.json()) as { id?: number; statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not create pack.");
      }

      showSuccess(`Pack "${newPackName}" created successfully!`);
      setIsCreatingPack(false);
      setNewPackName("");
      setNewPackPrice("1.99");
      setNewPackDate("");
      if (data.id) setSelectedPackId(data.id);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not create pack.");
    } finally {
      setIsLoading(false);
    }
  };

  const addMemberToPack = async () => {
    if (!selectedPackId || !selectedTickerToAdd) return;

    setIsAddingMember(true);
    try {
      const response = await fetch(`/api/internal/packs/${selectedPackId}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker: selectedTickerToAdd }),
      });

      const data = (await response.json()) as { statusMessage?: string };
      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not add celebrity to pack.");
      }

      showSuccess(`Added ${selectedTickerToAdd} to pack.`);
      setSelectedTickerToAdd("");
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not add celebrity.");
    } finally {
      setIsAddingMember(false);
    }
  };

  const removeMemberFromPack = async (packId: number, ticker: string) => {
    setRemovingTicker(ticker);
    try {
      const response = await fetch(`/api/internal/packs/${packId}/members/${ticker}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = (await response.json()) as { statusMessage?: string };
      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not remove celebrity from pack.");
      }

      showSuccess(`Removed ${ticker} from pack.`);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not remove celebrity.");
    } finally {
      setRemovingTicker(null);
    }
  };

  const filteredPacks = packs.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || String(p.id).includes(q);
  });

  const selectedPack = packs.find((p) => p.id === selectedPackId) ?? packs[0];

  const candidateMarkets = availableMarkets.filter(
    (market) => !selectedPack?.members?.some((m) => m.ticker === market.ticker),
  );

  if (isLoading && packs.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Link
          to="/operations"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#c99bff] transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to operations
        </Link>

        <header className="mt-8 flex flex-wrap items-start justify-between gap-4 rounded-[30px] border border-[#ffd17b]/30 bg-[#211230] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ffd17b] text-[#3d2a00]">
              <PackageOpen size={24} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
                52-Week Annual Pack Schedule
              </p>
              <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
                Celebrity packs manager ({packs.length} total)
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c4b4d0]">
                Standard price: <strong>£1.99</strong> per pack. Configure weekly launch dates, run store-wide discount sales with live promotional banners, and manage member rosters.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingPack(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ffd17b] px-5 py-3 text-sm font-black text-[#3d2a00] shadow-lg transition hover:bg-[#ffe29c]"
          >
            <Plus size={16} />
            Create new pack
          </button>
        </header>

        {/* Global Pack Sale & Promotional Banner Manager */}
        <section className="mt-7 rounded-[28px] border border-[#ff4b2b]/40 bg-gradient-to-r from-[#291228] to-[#1c0e2a] p-6 sm:p-7 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff4b2b] text-white">
                <Flame size={24} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ff8e7b]">
                  Storewide Promotion
                </p>
                <h2 className="font-display mt-0.5 text-2xl font-black text-white">
                  Pack Sale & Discount Banner
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSaleActive(!saleActive)}
              className={`rounded-xl px-5 py-2.5 text-xs font-black transition ${
                saleActive
                  ? "bg-[#62e7b6] text-[#112b24] shadow-lg shadow-[#62e7b6]/20"
                  : "bg-white/10 text-[#c4b4d0] hover:bg-white/15"
              }`}
            >
              {saleActive ? "SALE ACTIVE (Broadcast On)" : "SALE OFF"}
            </button>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_2fr]">
            {/* Discount percentage input and presets */}
            <div className="rounded-2xl border border-white/10 bg-[#140a20] p-4">
              <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                Discount Percentage
              </label>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="90"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                  className="w-24 rounded-xl border border-white/10 bg-[#211230] px-3 py-2.5 font-display text-xl font-black text-[#ffd17b] outline-none focus:border-[#ffd17b]"
                />
                <span className="font-display text-xl font-black text-[#ffd17b]">% OFF</span>
              </div>

              {/* Presets */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[15, 25, 30, 50, 70].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setDiscountPercent(pct);
                      setBannerText(
                        `🔥 FLASH SALE: All Celebrity Packs are ${pct}% OFF! Unlock 25+ exclusive markets for just £${(1.99 * (1 - pct / 100)).toFixed(2)}.`,
                      );
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                      discountPercent === pct
                        ? "bg-[#ffd17b] text-[#382600]"
                        : "bg-white/5 text-[#c4b4d0] hover:bg-white/10"
                    }`}
                  >
                    {pct}% OFF
                  </button>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-[#a99ab7]">
                Effective discounted price: <strong className="text-[#62e7b6]">£{(1.99 * (1 - discountPercent / 100)).toFixed(2)}</strong> (Original £1.99)
              </p>
            </div>

            {/* Banner headline text */}
            <div className="rounded-2xl border border-white/10 bg-[#140a20] p-4">
              <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                Global Promotional Banner Headline
              </label>

              <textarea
                rows={2}
                value={bannerText}
                maxLength={200}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="🔥 FLASH SALE: All Celebrity Packs are discounted for a limited time!"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] p-3 text-xs font-bold text-white outline-none focus:border-[#ffd17b]"
              />

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] text-[#a99ab7]">
                  Appears at the top of all pages when active.
                </span>

                <button
                  type="button"
                  disabled={isSavingSale}
                  onClick={() => void saveSaleConfig()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff4b2b] px-5 py-2 text-xs font-black text-white hover:bg-[#ff6347] disabled:opacity-50"
                >
                  {isSavingSale ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
                  Save & Apply Sale
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Modal for Creating New Pack */}
        {isCreatingPack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[28px] border border-[#ffd17b]/30 bg-[#211230] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-[#ffd17b]">
                  <Sparkles size={18} />
                  <h2 className="font-display text-xl font-black">Create Celebrity Pack</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingPack(false)}
                  className="rounded-lg p-1 text-[#c4b4d0] hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreatePack} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                    Pack Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newPackName}
                    onChange={(e) => setNewPackName(e.target.value)}
                    placeholder="e.g. Next-Gen Creators Pack"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#ffd17b]"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                      Price (GBP £)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newPackPrice}
                      onChange={(e) => setNewPackPrice(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#ffd17b]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                      Release Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={newPackDate}
                      onChange={(e) => setNewPackDate(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#ffd17b]"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-white/[.04] p-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={newPackAnnounced}
                      onChange={(e) => setNewPackAnnounced(e.target.checked)}
                      className="rounded border-white/20 bg-[#160c25]"
                    />
                    Announced (Reveal name)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 font-bold">
                    <input
                      type="checkbox"
                      checked={newPackPublished}
                      onChange={(e) => setNewPackPublished(e.target.checked)}
                      className="rounded border-white/20 bg-[#160c25]"
                    />
                    Publish Immediately
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingPack(false)}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-[#c4b4d0] hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#ffd17b] px-5 py-2.5 text-xs font-black text-[#3d2a00] hover:bg-[#ffe29c]"
                  >
                    Save & Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Master-Detail Layout */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          {/* Left Column: All Packs List & Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
                <PackageOpen size={16} /> All packs ({packs.length})
              </h2>

              <div className="relative w-48">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#c99bff]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter packs…"
                  className="w-full rounded-lg border border-white/10 bg-[#160c25] py-1.5 pl-7 pr-2 text-xs font-bold text-white outline-none focus:border-[#ffd17b]"
                />
              </div>
            </div>

            <div className="max-h-[750px] space-y-3 overflow-y-auto pr-1">
              {filteredPacks.map((pack) => {
                const isSelected = selectedPack?.id === pack.id;
                const isSaving = savingId === pack.id;
                const isLive =
                  pack.is_published &&
                  (!pack.available_at || new Date(pack.available_at).getTime() <= Date.now());

                return (
                  <article
                    key={pack.id}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`cursor-pointer rounded-[24px] border p-5 transition ${
                      isSelected
                        ? "border-[#ffd17b] bg-[#291b35] shadow-lg"
                        : "border-white/10 bg-[#160c25] hover:border-white/20 hover:bg-[#1a0e2d]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                            Pack #{pack.id}
                          </span>
                          <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#a99ab7]">
                            {pack.member_count} {pack.member_count === 1 ? "market" : "markets"}
                          </span>
                        </div>
                        <h3 className="font-display mt-1 text-xl font-black text-white">
                          {pack.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${
                            pack.is_announced
                              ? "bg-[#c99bff]/20 text-[#c99bff]"
                              : "bg-white/5 text-[#8a7b97]"
                          }`}
                        >
                          {pack.is_announced ? "ANNOUNCED" : "CLASSIFIED"}
                        </span>
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${
                            isLive
                              ? "bg-[#183b33] text-[#62e7b6]"
                              : "bg-white/[.06] text-[#a99ab7]"
                          }`}
                        >
                          {isLive ? "LIVE" : "DRAFT"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-[#a99ab7]">
                          Price (£)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pack.price_gbp}
                          onChange={(e) => updatePackLocal(pack.id, { price_gbp: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-[#211230] px-3 py-2 text-sm font-black text-white outline-none focus:border-[#ffd17b]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-[#a99ab7]">
                          Release Date
                        </label>
                        <input
                          type="datetime-local"
                          value={toLocalDateTime(pack.available_at)}
                          onChange={(e) =>
                            updatePackLocal(pack.id, {
                              available_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/10 bg-[#211230] px-2 py-2 text-xs font-bold text-white outline-none focus:border-[#ffd17b]"
                        />
                      </div>
                    </div>

                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => updatePackLocal(pack.id, { is_announced: !pack.is_announced })}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                            pack.is_announced ? "bg-[#7c3aed] text-white" : "bg-white/5 text-[#a99ab7]"
                          }`}
                        >
                          {pack.is_announced ? <Eye size={13} /> : <EyeOff size={13} />}
                          {pack.is_announced ? "Revealed" : "Masked"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updatePackLocal(pack.id, { is_published: !pack.is_published })}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                            pack.is_published ? "bg-[#183b33] text-[#62e7b6]" : "bg-white/5 text-[#a99ab7]"
                          }`}
                        >
                          {pack.is_published ? <CheckCircle2 size={13} /> : null}
                          {pack.is_published ? "Published" : "Draft"}
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void savePack(pack)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffd17b] px-3 py-1.5 text-xs font-black text-[#3d2a00] transition hover:bg-[#ffe29c] disabled:opacity-50"
                      >
                        {isSaving ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                        Save
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Right Column: Pack Celebrity Members Roster */}
          <div>
            {selectedPack ? (
              <section className="rounded-[28px] border border-[#ffd17b]/30 bg-[#211230] p-6 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-5">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">
                      Member Roster · Pack #{selectedPack.id}
                    </span>
                    <h2 className="font-display mt-1 text-2xl font-black">
                      {selectedPack.name}
                    </h2>
                    <p className="mt-1 text-xs text-[#c4b4d0]">
                      Celebrities listed here will be exclusively locked to this pack.
                    </p>
                  </div>
                  <span className="rounded-xl bg-[#ffd17b]/15 px-3 py-1.5 text-xs font-black text-[#ffd17b]">
                    {selectedPack.members?.length ?? 0} celebrities
                  </span>
                </div>

                {/* Add Market form */}
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#160c25] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#c99bff]">
                    Assign celebrity to this pack
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select
                      value={selectedTickerToAdd}
                      onChange={(e) => setSelectedTickerToAdd(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#ffd17b]"
                    >
                      <option value="">Select a celebrity market…</option>
                      {candidateMarkets.map((m) => (
                        <option key={m.ticker} value={m.ticker}>
                          {m.name} (${m.ticker}) · {m.category}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isAddingMember || !selectedTickerToAdd}
                      onClick={() => void addMemberToPack()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ffd17b] px-5 py-3 text-xs font-black text-[#3d2a00] transition hover:bg-[#ffe29c] disabled:opacity-50"
                    >
                      {isAddingMember ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}
                      Add to Pack
                    </button>
                  </div>
                </div>

                {/* Member items */}
                <div className="mt-6 max-h-[500px] space-y-2 overflow-y-auto pr-1">
                  {selectedPack.members && selectedPack.members.length > 0 ? (
                    selectedPack.members.map((member) => (
                      <div
                        key={member.ticker}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[.04] px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#7c3aed]/30 font-display text-xs font-black text-[#c99bff]">
                            ${member.ticker.slice(0, 3)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-white">{member.name}</p>
                            <p className="text-[11px] font-semibold text-[#a99ab7]">
                              ${member.ticker} · {member.category}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={removingTicker === member.ticker}
                          onClick={() => void removeMemberFromPack(selectedPack.id, member.ticker)}
                          aria-label={`Remove ${member.name} from pack`}
                          className="rounded-lg border border-[#ff7282]/20 p-2 text-[#ff9ca5] hover:bg-[#ff7282]/15 disabled:opacity-50"
                        >
                          {removingTicker === member.ticker ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.02] p-8 text-center text-xs text-[#a99ab7]">
                      <Users size={24} className="mx-auto mb-2 opacity-50" />
                      No celebrity markets are currently assigned to this pack.
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <div className="grid h-64 place-items-center rounded-[28px] border border-white/10 bg-[#211230] text-sm text-[#a99ab7]">
                Select a pack to manage its members
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}