import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  Save,
  Search,
  Sparkles,
  ToggleLeft,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type Listing = {
  ticker: string;
  name: string;
  category: string;
  tradingPaused: boolean;
  websiteUrl: string;
  youtubeChannelId: string;
};

type AutofillResult = {
  websiteUrl: string;
  youtubeChannelId: string;
  found: {
    website: boolean;
    youtube: boolean;
  };
  preserved: {
    website: boolean;
    youtube: boolean;
  };
};

export function ListingAdmin() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);

  useEffect(() => {
    void fetch("/api/internal/listings", { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json()) as {
          listings?: Listing[];
          statusMessage?: string;
        };

        if (!response.ok || !data.listings) {
          throw new Error(data.statusMessage ?? "Could not load market listings.");
        }

        setListings(data.listings);
        setSelectedTicker(data.listings[0]?.ticker ?? "");
      })
      .catch((error: Error) => showError(error.message))
      .finally(() => setIsLoading(false));
  }, []);

  const filteredListings = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return listings.filter(
      (listing) =>
        !normalized ||
        listing.name.toLowerCase().includes(normalized) ||
        listing.ticker.toLowerCase().includes(normalized),
    );
  }, [listings, query]);

  const selected = listings.find((listing) => listing.ticker === selectedTicker);

  const updateSelected = (changes: Partial<Listing>) => {
    if (!selected) return;

    setListings((current) =>
      current.map((listing) =>
        listing.ticker === selected.ticker ? { ...listing, ...changes } : listing,
      ),
    );
  };

  const autofillListing = async () => {
    if (!selected) return;

    setIsAutofilling(true);

    try {
      const response = await fetch(
        `/api/internal/listings/${selected.ticker}/autofill`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = (await response.json()) as AutofillResult & {
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.statusMessage ?? "Could not look up public listing metadata.",
        );
      }

      updateSelected({
        websiteUrl: data.websiteUrl,
        youtubeChannelId: data.youtubeChannelId,
      });

      const added = [
        !data.preserved.website && data.found.website && "website",
        !data.preserved.youtube && data.found.youtube && "YouTube channel",
      ].filter(Boolean);

      showSuccess(
        added.length
          ? `Added ${added.join(" and ")} from public profile metadata.`
          : "No new public metadata was available; existing details were kept.",
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not look up public listing metadata.",
      );
    } finally {
      setIsAutofilling(false);
    }
  };

  const saveListing = async () => {
    if (!selected) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/internal/listings/${selected.ticker}`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tradingPaused: selected.tradingPaused,
          websiteUrl: selected.websiteUrl,
          youtubeChannelId: selected.youtubeChannelId,
        }),
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not save this listing.");
      }

      showSuccess(`${selected.name}'s listing has been updated.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save this listing.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="mt-7 grid min-h-48 place-items-center rounded-[28px] border border-white/10 bg-[#211230]">
        <LoaderCircle className="animate-spin text-[#c99bff]" />
      </section>
    );
  }

  if (!selected) return null;

  return (
    <section className="mt-7 rounded-[28px] border border-[#c99bff]/25 bg-[#211230] p-5 sm:p-7">
      <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
        <ToggleLeft size={16} /> Listing administration
      </p>
      <h2 className="font-display mt-2 text-2xl font-black">Manage listed people</h2>
      <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">
        Pause one market without affecting the rest, maintain official links, and connect YouTube channel statistics.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <div>
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c99bff]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a person or ticker"
              className="w-full rounded-xl border border-white/10 bg-[#160c25] py-3 pl-10 pr-3 text-sm font-bold text-white outline-none focus:border-[#a97cff]"
            />
          </label>
          <div className="mt-3 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#160c25] p-2">
            {filteredListings.map((listing) => (
              <button
                key={listing.ticker}
                type="button"
                onClick={() => setSelectedTicker(listing.ticker)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                  listing.ticker === selected.ticker
                    ? "bg-[#7c3aed] text-white"
                    : "text-[#e6d8ff] hover:bg-white/[.06]"
                }`}
              >
                <span>
                  <span className="block text-sm font-black">{listing.name}</span>
                  <span className="block text-[10px] font-bold opacity-70">${listing.ticker} · {listing.category}</span>
                </span>
                {listing.tradingPaused && (
                  <span className="rounded-lg bg-[#ff7282]/20 px-2 py-1 text-[10px] font-black text-[#ff9ca5]">
                    PAUSED
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#160c25] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-black">{selected.name}</p>
              <p className="mt-1 text-xs font-bold text-[#c99bff]">${selected.ticker} · {selected.category}</p>
            </div>
            <button
              type="button"
              onClick={() => updateSelected({ tradingPaused: !selected.tradingPaused })}
              className={`rounded-xl px-4 py-2.5 text-xs font-black ${
                selected.tradingPaused
                  ? "bg-[#ff7282] text-[#401b2d]"
                  : "bg-[#183b33] text-[#62e7b6]"
              }`}
            >
              {selected.tradingPaused ? "Trading paused" : "Trading active"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void autofillListing()}
            disabled={isAutofilling}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#c99bff]/35 bg-[#7c3aed]/15 px-4 py-3 text-sm font-black text-[#e6d8ff] transition hover:bg-[#7c3aed]/25 disabled:opacity-50"
          >
            {isAutofilling ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} className="text-[#ffd17b]" />
            )}
            {isAutofilling ? "Looking up public metadata…" : "Auto-fill website & YouTube"}
          </button>
          <p className="mt-2 text-xs leading-5 text-[#9f90ac]">
            Uses public Wikidata records and never overwrites existing listing details.
          </p>

          <label className="mt-5 block text-xs font-bold uppercase tracking-[.13em] text-[#b9a9c5]">
            Official website
            <input
              type="url"
              value={selected.websiteUrl}
              onChange={(event) => updateSelected({ websiteUrl: event.target.value })}
              placeholder="https://example.com"
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm font-semibold text-white outline-none focus:border-[#a97cff]"
            />
          </label>
          {selected.websiteUrl && (
            <a
              href={selected.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#c99bff] hover:text-white"
            >
              Open official website <ExternalLink size={12} />
            </a>
          )}

          <label className="mt-5 block text-xs font-bold uppercase tracking-[.13em] text-[#b9a9c5]">
            YouTube channel ID
            <input
              value={selected.youtubeChannelId}
              onChange={(event) => updateSelected({ youtubeChannelId: event.target.value })}
              placeholder="UC..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 font-mono text-sm font-semibold text-white outline-none focus:border-[#a97cff]"
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-[#9f90ac]">
            Use the channel ID beginning with UC. Connected YouTube statistics remain capped in the practice score.
          </p>

          <button
            type="button"
            onClick={() => void saveListing()}
            disabled={isSaving}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-black text-white transition hover:bg-[#9361f5] disabled:opacity-50"
          >
            {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? "Saving…" : "Save listing"}
          </button>
        </div>
      </div>
    </section>
  );
}