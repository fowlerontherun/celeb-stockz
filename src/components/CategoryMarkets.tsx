import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clapperboard,
  Gamepad2,
  Landmark,
  Laugh,
  Lock,
  Music2,
  PackageOpen,
  Search,
  Shirt,
  Trophy,
  Tv,
  X,
} from "lucide-react";
import type { Celebrity } from "@/components/ExperiencePanels";
import { MarketHistoryChart } from "@/components/MarketHistoryChart";

export type MarketCategory =
  | "Music"
  | "Sport"
  | "Film"
  | "TV"
  | "Politics"
  | "Fashion"
  | "Digital"
  | "Comedy";

export type CategorizedCelebrity = Celebrity & {
  category: MarketCategory;
  birthYear: number;
  nationality: string;
  access?: {
    isStandard: boolean;
    isUnlocked: boolean;
    requiredPacks: Array<{ id: number; name: string }>;
  };
  snapshot?: {
    capturedAt: string | null;
    score: number;
    pageviews: number | null;
    movementReason: string;
    refreshStatus: "verified" | "fallback";
  };
};

type Tier = "A" | "B" | "C" | "D";

const categories: Array<{
  name: MarketCategory;
  icon: typeof Music2;
  color: string;
}> = [
  { name: "Music", icon: Music2, color: "text-[#ff9ca5]" },
  { name: "Sport", icon: Trophy, color: "text-[#62e7b6]" },
  { name: "Film", icon: Clapperboard, color: "text-[#ffd17b]" },
  { name: "TV", icon: Tv, color: "text-[#72c8ff]" },
  { name: "Politics", icon: Landmark, color: "text-[#c99bff]" },
  { name: "Fashion", icon: Shirt, color: "text-[#ff9bc8]" },
  { name: "Digital", icon: Gamepad2, color: "text-[#77d7ff]" },
  { name: "Comedy", icon: Laugh, color: "text-[#ffcb78]" },
];

const tierDetails: Record<
  Tier,
  { label: string; description: string; className: string }
> = {
  A: {
    label: "A · Icon",
    description: "100+ STKZ",
    className: "bg-[#ffd17b]/20 text-[#ffd17b]",
  },
  B: {
    label: "B · Headliner",
    description: "60–99.99 STKZ",
    className: "bg-[#c99bff]/20 text-[#d7b9ff]",
  },
  C: {
    label: "C · Rising",
    description: "35–59.99 STKZ",
    className: "bg-[#62e7b6]/15 text-[#80f2c6]",
  },
  D: {
    label: "D · Spotlight",
    description: "Under 35 STKZ",
    className: "bg-[#72c8ff]/15 text-[#9adfff]",
  },
};

function getTier(price: number): Tier {
  if (price >= 100) return "A";
  if (price >= 60) return "B";
  if (price >= 35) return "C";
  return "D";
}

function formatSnapshotTime(capturedAt: string | null | undefined) {
  if (!capturedAt) return "Awaiting first snapshot";

  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(capturedAt));
}

function getAccessBadge(market: CategorizedCelebrity) {
  const access = market.access ?? { isStandard: true, isUnlocked: true, requiredPacks: [] };
  if (access.isStandard) {
    return (
      <span className="rounded-lg px-2 py-1 text-[10px] font-black text-[#fff8f2]">
        Standard market
      </span>
    );
  }
  if (access.isUnlocked) {
    return (
      <span className="rounded-lg px-2 py-1 text-[10px] font-black text-[#62e7b6]">
        Unlocked
      </span>
    );
  }
  const packNames = access.requiredPacks.map((p) => p.name).join(" or ");
  return (
    <span className="rounded-lg px-2 py-1 text-[10px] font-black text-[#ff9ca5]">
      Locked · {packNames}
    </span>
  );
}

export function CategoryMarkets({
  markets,
  onTrade,
}: {
  markets: CategorizedCelebrity[];
  onTrade: (market: CategorizedCelebrity) => void;
}) {
  const [activeCategory, setActiveCategory] =
    useState<MarketCategory>("Music");
  const [activeTier, setActiveTier] = useState<"All" | Tier>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const visibleMarkets = useMemo(
    () =>
      markets.filter(
        (market) =>
          market.category === activeCategory &&
          (activeTier === "All" || getTier(market.price) === activeTier) &&
          (!normalizedQuery ||
            market.name.toLowerCase().includes(normalizedQuery) ||
            market.ticker.toLowerCase().includes(normalizedQuery)),
      ),
    [activeCategory, activeTier, markets, normalizedQuery],
  );

  const allTierButtonClass = `rounded-xl px-3 py-2 text-xs font-black transition ${
    activeTier === "All"
      ? "bg-white text-[#251433]"
      : "border border-white/10 bg-white/[.04] text-[#b9acc9]"
  }`;

  const tierButtonClass = (tier: Tier) => `rounded-xl px-3 py-2 text-xs font-black transition ${
    activeTier === tier
      ? tierDetails[tier].className
      : "border border-white/10 bg-white/[.04] text-[#b9acc9]"
  }`;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            Explore live markets
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Browse by culture.
          </h1>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-[#b9a9c5]">
          {markets.length} eligible markets
        </p>
      </div>

      <label className="relative mt-6 block">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#c99bff]"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search celebrity or ticker…"
          className="w-full rounded-2xl border border-white/10 bg-[#1e112f] py-3 pl-11 pr-11 text-sm font-semibold text-[#fff8f2] outline-none transition placeholder:text-[#897b95] focus:border-[#a97cff] focus:ring-2 focus:ring-[#7c3aed]/30"
          aria-label="Search celebrity markets"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear market search"
            className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#b9acc9] transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </label>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {categories.map(({ name, icon: Icon, color }) => (
          <button
            key={name}
            type="button"
            onClick={() => setActiveCategory(name)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              activeCategory === name
                ? "bg-[#7c3aed] text-white shadow-lg"
                : "border border-white/10 bg-white/[.04] text-[#b9acc9] hover:bg-white/10"
            }`}
          >
            <Icon
              size={17}
              className={activeCategory === name ? "text-white" : color}
            />
            {name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTier("All")}
          className={allTierButtonClass}
        >
          All tiers
        </button>
        {(Object.keys(tierDetails) as Tier[]).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setActiveTier(tier)}
            className={tierButtonClass(tier)}
          >
            {tierDetails[tier].label}
          </button>
        ))}
      </div>

      {visibleMarkets.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/15 bg-white/[.03] p-8 text-center text-sm text-[#b9acc9]">
          No markets match this filter.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMarkets.map((market) => {
            const age = new Date().getFullYear() - market.birthYear;
            const tier = getTier(market.price);
            const verified = market.snapshot?.refreshStatus === "verified";

            return (
              <article
                key={market.ticker}
                role="button"
                tabIndex={0}
                onClick={() => onTrade(market)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onTrade(market);
                  }
                }}
                className="cursor-pointer overflow-hidden rounded-[24px] border border-white/10 bg-[#1e112f] transition duration-200 hover:-translate-y-1 hover:border-[#a97cff]/60 hover:bg-[#24143a] hover:shadow-xl hover:shadow-[#0b0512]/30 focus:outline-none focus:ring-2 focus:ring-[#a97cff]"
                aria-label={`View details for ${market.name}`}
              >
                <div className="relative flex h-48 items-center justify-center bg-[#160c25] p-3">
                  <img
                    src={market.image}
                    alt={market.name}
                    className="h-full w-full object-contain"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-lg px-2 py-1 text-[10px] font-black ${tierDetails[tier].className}`}
                  >
                    Tier {tier}
                  </span>
                  {market.access && !market.access.isUnlocked && (
                    <Lock
                      className="absolute right-3 bottom-3 w-5 h-5 text-[#ff9ca5] shrink-0"
                    />
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl font-black">
                        {market.name}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-[#9f90ac]">
                        ${market.ticker} · {market.category}
                      </p>
                      <p className="mt-1 text-xs text-[#c4b4d0]">
                        {market.nationality} · {age} years old
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-black ${
                        market.change > 0
                          ? "bg-[#183b33] text-[#62e7b6]"
                          : "bg-[#482332] text-[#ff9ca5]"
                      }`}
                    >
                      {market.change > 0 ? "+" : ""}
                      {market.change.toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-3">
                    <MarketHistoryChart
                      ticker={market.ticker}
                      price={market.price}
                      change={market.change}
                    />
                    <div className="mt-2 rounded-xl bg-white/[.04] px-3 py-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#c99bff]">
                        Why it moved
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#c4b4d0]">
                        {market.snapshot?.movementReason}
                      </p>
                      <p
                        className={`mt-1 text-[10px] font-bold ${
                          verified ? "text-[#62e7b6]" : "text-[#ffd17b]"}
                        `}
                      >
                        {verified ? "Verified snapshot" : "Safe fallback"} ·{" "}
                        {formatSnapshotTime(market.snapshot?.capturedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-black">
                        {market.price.toFixed(2)}{" "}
                        <span className="text-xs text-[#aaa0b4]">STKZ</span>
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-[#9f90ac]">
                        {tierDetails[tier].description}
                      </p>
                    </div>
                    <span className="rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-black text-white">
                      {market.access && !market.access.isUnlocked ? (
                        <>
                          <Lock className="mr-1 h-4 w-4" />
                          View details
                        </>
                      ) : (
                        "View details"
                      )}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}