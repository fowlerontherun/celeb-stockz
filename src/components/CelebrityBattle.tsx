import { useMemo, useState } from "react";
import {
  ArrowRight,
  Flame,
  Globe,
  Newspaper,
  Radio,
  Search,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";
import { getCountryInfo } from "@/components/CategoryMarkets";

type CelebrityMarket = CategorizedCelebrity & {
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
};

type Props = {
  markets: CelebrityMarket[];
  onTrade: (market: CelebrityMarket) => void;
};

const battlePresets: Array<{ name: string; t1: string; t2: string }> = [
  { name: "Pop Royalty", t1: "TSWIFT", t2: "DUALIPA" },
  { name: "Galáctico Showdown", t1: "BELLINGHAM", t2: "CR7" },
  { name: "Creator Titans", t1: "MRBEAST", t2: "KSI" },
  { name: "UK Drama Leads", t1: "PMESCAL", t2: "BKEOGHAN" },
  { name: "No. 10 Rivals", t1: "STARMER", t2: "SUNAK" },
];

export function CelebrityBattle({ markets, onTrade }: Props) {
  const [ticker1, setTicker1] = useState("TSWIFT");
  const [ticker2, setTicker2] = useState("DUALIPA");

  const celeb1 = useMemo(
    () => markets.find((m) => m.ticker === ticker1) ?? markets[0],
    [markets, ticker1],
  );

  const celeb2 = useMemo(
    () => markets.find((m) => m.ticker === ticker2) ?? markets[1] ?? markets[0],
    [markets, ticker2],
  );

  const stats = useMemo(() => {
    if (!celeb1 || !celeb2) return [];

    return [
      {
        label: "Market Price",
        v1: celeb1.price,
        v2: celeb2.price,
        display1: `${celeb1.price.toFixed(2)} STKZ`,
        display2: `${celeb2.price.toFixed(2)} STKZ`,
        icon: TrendingUp,
      },
      {
        label: "24h Momentum",
        v1: celeb1.change,
        v2: celeb2.change,
        display1: `${celeb1.change > 0 ? "+" : ""}${celeb1.change.toFixed(1)}%`,
        display2: `${celeb2.change > 0 ? "+" : ""}${celeb2.change.toFixed(1)}%`,
        icon: Flame,
      },
      {
        label: "Social Reach",
        v1: celeb1.signals.socialFollowersMillions,
        v2: celeb2.signals.socialFollowersMillions,
        display1: `${celeb1.signals.socialFollowersMillions}M followers`,
        display2: `${celeb2.signals.socialFollowersMillions}M followers`,
        icon: Users,
      },
      {
        label: "Hashtag Views",
        v1: celeb1.signals.hashtagViewsBillions,
        v2: celeb2.signals.hashtagViewsBillions,
        display1: `${celeb1.signals.hashtagViewsBillions}B views`,
        display2: `${celeb2.signals.hashtagViewsBillions}B views`,
        icon: Radio,
      },
      {
        label: "Trend Index",
        v1: celeb1.signals.trendScore,
        v2: celeb2.signals.trendScore,
        display1: `${celeb1.signals.trendScore}/100`,
        display2: `${celeb2.signals.trendScore}/100`,
        icon: Zap,
      },
      {
        label: "Monthly Searches",
        v1: celeb1.signals.monthlySearchesMillions,
        v2: celeb2.signals.monthlySearchesMillions,
        display1: `${celeb1.signals.monthlySearchesMillions}M searches`,
        display2: `${celeb2.signals.monthlySearchesMillions}M searches`,
        icon: Search,
      },
      {
        label: "News Coverage",
        v1: celeb1.signals.newsStories,
        v2: celeb2.signals.newsStories,
        display1: `${celeb1.signals.newsStories} articles`,
        display2: `${celeb2.signals.newsStories} articles`,
        icon: Newspaper,
      },
    ];
  }, [celeb1, celeb2]);

  if (!celeb1 || !celeb2) return null;

  const country1 = getCountryInfo(celeb1.nationality);
  const country2 = getCountryInfo(celeb2.nationality);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ff7282]">
            Head-to-Head Spotlight
          </p>
          <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl flex items-center gap-3">
            <span>Culture Battles</span>
            <Swords className="text-[#ffd17b]" size={28} />
          </h1>
          <p className="mt-2 text-sm text-[#c4b4d0]">
            Compare two celebrities side-by-side and trade the icon you think has higher culture momentum.
          </p>
        </div>

        {/* Battle Presets */}
        <div className="flex flex-wrap gap-1.5">
          {battlePresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setTicker1(preset.t1);
                setTicker2(preset.t2);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                ticker1 === preset.t1 && ticker2 === preset.t2
                  ? "bg-[#ffd17b] text-[#382600] font-black"
                  : "border border-white/10 bg-white/5 text-[#c4b4d0] hover:bg-white/10"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="grid gap-3 sm:grid-cols-2 rounded-[24px] border border-white/10 bg-[#1e112f] p-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[.14em] text-[#ff9ca5]">
            Celebrity 1
          </label>
          <select
            value={ticker1}
            onChange={(e) => setTicker1(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#ff7282]"
          >
            {markets.map((m) => (
              <option key={`c1-${m.ticker}`} value={m.ticker}>
                {m.name} (${m.ticker}) · {m.category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-[.14em] text-[#62e7b6]">
            Celebrity 2
          </label>
          <select
            value={ticker2}
            onChange={(e) => setTicker2(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#62e7b6]"
          >
            {markets.map((m) => (
              <option key={`c2-${m.ticker}`} value={m.ticker}>
                {m.name} (${m.ticker}) · {m.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Versus Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Card 1 */}
        <article className="relative overflow-hidden rounded-[28px] border border-[#ff7282]/30 bg-gradient-to-b from-[#2a1324] to-[#1a0c1b] p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#140713] p-1.5 border border-white/10">
              <img
                src={celeb1.image}
                alt={celeb1.name}
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = `/api/celebrity-images/${encodeURIComponent(celeb1.ticker)}`;
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#ff9ca5]">
                ${celeb1.ticker} · {celeb1.category}
              </span>
              <h3 className="font-display truncate text-2xl font-black text-white">
                {celeb1.name}
              </h3>
              <p className="mt-0.5 text-xs text-[#d8c3d3]">
                {country1.flag} {country1.label} · Age {new Date().getFullYear() - celeb1.birthYear}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-black/30 p-4 border border-white/5">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#b9a9b7]">Price</p>
              <p className="font-display text-3xl font-black text-[#ff9ca5]">
                {celeb1.price.toFixed(2)} <span className="text-xs text-[#d8c3d3]">STKZ</span>
              </p>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                celeb1.change >= 0 ? "bg-[#183b33] text-[#62e7b6]" : "bg-[#482332] text-[#ff9ca5]"
              }`}
            >
              {celeb1.change >= 0 ? "+" : ""}{celeb1.change.toFixed(1)}% 24h
            </span>
          </div>

          <button
            type="button"
            onClick={() => onTrade(celeb1)}
            className="mt-5 w-full rounded-xl bg-[#ff7282] py-3 text-sm font-black text-[#401b2d] shadow-lg transition active:scale-95 hover:bg-[#ff8e9a]"
          >
            Trade {celeb1.ticker}
          </button>
        </article>

        {/* Card 2 */}
        <article className="relative overflow-hidden rounded-[28px] border border-[#62e7b6]/30 bg-gradient-to-b from-[#132822] to-[#0c1a17] p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#081512] p-1.5 border border-white/10">
              <img
                src={celeb2.image}
                alt={celeb2.name}
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = `/api/celebrity-images/${encodeURIComponent(celeb2.ticker)}`;
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#62e7b6]">
                ${celeb2.ticker} · {celeb2.category}
              </span>
              <h3 className="font-display truncate text-2xl font-black text-white">
                {celeb2.name}
              </h3>
              <p className="mt-0.5 text-xs text-[#bdd8d0]">
                {country2.flag} {country2.label} · Age {new Date().getFullYear() - celeb2.birthYear}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-baseline justify-between rounded-2xl bg-black/30 p-4 border border-white/5">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#9dbcb3]">Price</p>
              <p className="font-display text-3xl font-black text-[#62e7b6]">
                {celeb2.price.toFixed(2)} <span className="text-xs text-[#bdd8d0]">STKZ</span>
              </p>
            </div>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-black ${
                celeb2.change >= 0 ? "bg-[#183b33] text-[#62e7b6]" : "bg-[#482332] text-[#ff9ca5]"
              }`}
            >
              {celeb2.change >= 0 ? "+" : ""}{celeb2.change.toFixed(1)}% 24h
            </span>
          </div>

          <button
            type="button"
            onClick={() => onTrade(celeb2)}
            className="mt-5 w-full rounded-xl bg-[#62e7b6] py-3 text-sm font-black text-[#112b24] shadow-lg transition active:scale-95 hover:bg-[#83efc8]"
          >
            Trade {celeb2.ticker}
          </button>
        </article>
      </div>

      {/* Metric-by-Metric Breakdown Table */}
      <section className="rounded-[28px] border border-white/10 bg-[#1e112f] p-5 sm:p-7 shadow-xl">
        <h3 className="font-display text-xl font-black text-white">
          Signal & Reach Telemetry Breakdown
        </h3>
        <p className="mt-1 text-xs text-[#a99ab7]">
          Compare real-time verifiable telemetry feeds driving each celebrity's practice pricing.
        </p>

        <div className="mt-5 space-y-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const is1Higher = stat.v1 > stat.v2;
            const is2Higher = stat.v2 > stat.v1;
            const total = Math.max(0.01, Math.abs(stat.v1) + Math.abs(stat.v2));
            const pct1 = Math.round((Math.abs(stat.v1) / total) * 100);
            const pct2 = 100 - pct1;

            return (
              <div key={stat.label} className="rounded-2xl border border-white/5 bg-white/[.02] p-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className={is1Higher ? "font-black text-[#ff9ca5]" : "text-[#c4b4d0]"}>
                    {stat.display1}
                  </span>

                  <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#a99ab7]">
                    <Icon size={13} /> {stat.label}
                  </span>

                  <span className={is2Higher ? "font-black text-[#62e7b6]" : "text-[#c4b4d0]"}>
                    {stat.display2}
                  </span>
                </div>

                {/* Comparative Ratio Bar */}
                <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-black/40">
                  <div
                    className="bg-[#ff7282] transition-all duration-500"
                    style={{ width: `${pct1}%` }}
                  />
                  <div
                    className="bg-[#62e7b6] transition-all duration-500"
                    style={{ width: `${pct2}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}