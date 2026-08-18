import { useMemo, useState } from "react";
import {
  Clapperboard,
  Gamepad2,
  Landmark,
  Laugh,
  Music2,
  Shirt,
  Trophy,
  Tv,
} from "lucide-react";
import type { Celebrity } from "@/components/ExperiencePanels";
import { PriceChart } from "@/components/PriceChart";

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

const tierDetails: Record<Tier, { label: string; description: string; className: string }> = {
  A: { label: "A · Icon", description: "100+ STKZ", className: "bg-[#ffd17b]/20 text-[#ffd17b]" },
  B: { label: "B · Headliner", description: "60–99.99 STKZ", className: "bg-[#c99bff]/20 text-[#d7b9ff]" },
  C: { label: "C · Rising", description: "35–59.99 STKZ", className: "bg-[#62e7b6]/15 text-[#80f2c6]" },
  D: { label: "D · Spotlight", description: "Under 35 STKZ", className: "bg-[#72c8ff]/15 text-[#9adfff]" },
};

function getTier(price: number): Tier {
  if (price >= 100) return "A";
  if (price >= 60) return "B";
  if (price >= 35) return "C";
  return "D";
}

export function CategoryMarkets({
  markets,
  onTrade,
}: {
  markets: CategorizedCelebrity[];
  onTrade: (market: CategorizedCelebrity) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<MarketCategory>("Music");
  const [activeTier, setActiveTier] = useState<"All" | Tier>("All");

  const visibleMarkets = useMemo(
    () =>
      markets.filter(
        (market) =>
          market.category === activeCategory &&
          (activeTier === "All" || getTier(market.price) === activeTier),
      ),
    [activeCategory, activeTier, markets],
  );

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">
            Explore modeled markets
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">
            Browse by culture.
          </h1>
        </div>
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-[#b9a9c5]">
          {markets.length} markets · modeled signals
        </p>
      </div>

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
          className={`rounded-xl px-3 py-2 text-xs font-black transition ${
            activeTier === "All"
              ? "bg-white text-[#251433]"
              : "border border-white/10 bg-white/[.04] text-[#b9acc9]"
          }`}
        >
          All tiers
        </button>
        {(Object.keys(tierDetails) as Tier[]).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setActiveTier(tier)}
            className={`rounded-xl px-3 py-2 text-xs font-black transition ${
              activeTier === tier
                ? tierDetails[tier].className
                : "border border-white/10 bg-white/[.04] text-[#b9acc9]"
            }`}
          >
            {tierDetails[tier].label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-[#9788a4]">
        A-tier icons are priced at 100+ STKZ; B, C, and D tiers offer lower
        modeled entry prices.
      </p>

      {visibleMarkets.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/15 bg-white/[.03] p-8 text-center text-sm text-[#b9acc9]">
          No {activeTier === "All" ? "" : `${activeTier}-tier `}markets are in
          this category yet. Try another tier or category.
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleMarkets.map((market) => {
            const age = new Date().getFullYear() - market.birthYear;
            const tier = getTier(market.price);

            return (
              <article
                key={market.ticker}
                className="overflow-hidden rounded-[24px] border border-white/10 bg-[#1e112f]"
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
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl font-black">{market.name}</p>
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
                      {market.change}%
                    </span>
                  </div>

                  <div className="mt-3">
                    <PriceChart
                      price={market.price}
                      change={market.change}
                      ticker={market.ticker}
                    />
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#81738d]">
                      Modeled 7-day movement
                    </p>
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
                    <button
                      type="button"
                      onClick={() => onTrade(market)}
                      className="rounded-xl bg-[#7c3aed] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#9361f5]"
                    >
                      Buy / sell
                    </button>
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