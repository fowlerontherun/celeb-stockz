import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  Flame,
  Gem,
  Home,
  LayoutGrid,
  Search,
  Sparkles,
  Star,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";

const celebs = [
  { name: "Amara Vale", ticker: "AMARA", price: 38.42, change: 14.8, image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=280&q=85", color: "#f36d72" },
  { name: "Leo March", ticker: "LEO", price: 22.18, change: 8.3, image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=280&q=85", color: "#f0ab4f" },
  { name: "Sienna Rae", ticker: "SIENNA", price: 51.07, change: -3.1, image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=280&q=85", color: "#9c67dd" },
  { name: "Dante Cruz", ticker: "DANTE", price: 17.63, change: 6.9, image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=280&q=85", color: "#49b8a7" },
];

const trendPoints = [52, 49, 58, 53, 62, 60, 72, 68, 79, 76, 88, 85, 96];

function TinyChart({ positive = true }: { positive?: boolean }) {
  const d = trendPoints.map((point, index) => `${index === 0 ? "M" : "L"}${index * 14} ${108 - point}`).join(" ");
  return <svg viewBox="0 0 170 64" className="h-14 w-full overflow-visible" aria-hidden="true"><path d={d} fill="none" stroke={positive ? "#3ed9a3" : "#ff7780"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const Index = () => {
  const [selected, setSelected] = useState(celebs[0]);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState<"Buy" | "Sell">("Buy");
  const [amount, setAmount] = useState("25");
  const [toast, setToast] = useState("");
  const [watching, setWatching] = useState(false);

  const shares = useMemo(() => {
    const value = Number(amount) || 0;
    return (value / selected.price).toFixed(2);
  }, [amount, selected.price]);

  const submitTrade = () => {
    setToast(`${tradeSide} order placed for ${shares} ${selected.ticker} shares`);
    setTradeOpen(false);
    window.setTimeout(() => setToast(""), 3200);
  };

  return (
    <main className="min-h-screen bg-[#120b20] text-[#fff8f2] selection:bg-[#d158c7] selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-white/10 bg-[#170d29] px-5 py-7 lg:flex">
          <div className="flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed] shadow-[0_0_22px_rgba(124,58,237,.5)]"><ChartNoAxesCombined size={20} /></div>
            <span className="font-display text-xl font-black tracking-tight">Celeb<span className="text-[#ff7282]">Stockz</span></span>
          </div>
          <div className="mt-11 space-y-2">
            {[[Home, "Home"], [LayoutGrid, "Markets"], [Wallet, "Portfolio"], [Trophy, "Rankings"], [Users, "Clubs"]].map(([Icon, name], index) => <button key={String(name)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${index === 0 ? "bg-[#7c3aed] text-white shadow-lg" : "text-[#b9acc9] hover:bg-white/5 hover:text-white"}`}><Icon size={18} />{String(name)}</button>)}
          </div>
          <div className="mt-auto rounded-2xl border border-[#f5ab43]/30 bg-[#261631] p-4">
            <div className="flex items-center gap-2 text-[#ffd17b]"><Flame size={17} fill="currentColor" /><span className="text-xs font-extrabold uppercase tracking-[.18em]">On a roll</span></div>
            <p className="mt-3 text-2xl font-black">12 day streak</p>
            <p className="mt-1 text-xs leading-5 text-[#c0b3cb]">Check in tomorrow to unlock 10% off trading fees.</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-3/4 rounded-full bg-[#f5ab43]" /></div>
          </div>
          <p className="mt-5 px-2 text-[10px] leading-4 text-[#7c6d8e]">Synthetic celebrity assets. Entertainment only. Not investment advice.</p>
        </aside>

        <section className="w-full overflow-hidden">
          <header className="flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
            <div className="flex items-center gap-2 lg:hidden"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]"><ChartNoAxesCombined size={19} /></div><span className="font-display text-lg font-black">Celeb<span className="text-[#ff7282]">Stockz</span></span></div>
            <label className="relative hidden w-[310px] lg:block"><Search className="absolute left-4 top-3 text-[#a597b4]" size={17}/><input className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-11 pr-4 text-sm outline-none placeholder:text-[#8e819e] focus:border-[#a97cff]" placeholder="Search celebrities" /></label>
            <div className="ml-auto flex items-center gap-3"><button className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-[#e9dff1]"><Bell size={18}/><i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ff7282]" /></button><button className="hidden rounded-xl border border-[#8a60db]/50 bg-[#291845] px-3 py-2 text-xs font-bold text-[#e6d8ff] sm:block"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3ed9a3]"/>Devnet</button><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eeb19e] text-sm font-black text-[#45253d]">AJ</div></div>
          </header>

          <div className="px-5 pb-28 sm:px-8 lg:px-10">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="mb-1 text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">Your spotlight</p><h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">The market is <span className="text-[#ff7282]">buzzing.</span></h1></div>
              <div className="flex items-center gap-2 rounded-xl border border-[#3ed9a3]/20 bg-[#12382f]/60 px-3 py-2 text-xs font-bold text-[#80ebc5]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#3ed9a3]" /> Markets open · next hype tick in 01:42</div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.42fr_.8fr]">
              <article className="relative min-h-[355px] overflow-hidden rounded-[28px] border border-white/10 bg-[#2a1740] p-6 sm:p-8">
                <img src="https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=85" alt="Premiere lights" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity" />
                <div className="absolute inset-0 bg-[#2a1740]/70" />
                <div className="relative flex h-full flex-col"><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]"><Sparkles size={15} fill="currentColor"/> Hype rising fast</div><div className="mt-auto max-w-sm"><p className="font-display text-3xl font-black leading-none sm:text-5xl">Amara Vale is having a moment.</p><p className="mt-4 text-sm leading-6 text-[#dccfe6]">Premiere week chatter has pushed her hype score to a new 30-day high.</p><button onClick={() => { setSelected(celebs[0]); setTradeOpen(true); }} className="mt-6 rounded-xl bg-[#ff7282] px-5 py-3 text-sm font-extrabold text-[#35132a] transition hover:scale-[1.03]">Trade AMARA <ChevronRight className="ml-1 inline" size={16}/></button></div></div>

              </article>

              <article className="rounded-[28px] border border-white/10 bg-[#1e112f] p-6">
                <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a99ab7]">Portfolio value</p><p className="mt-2 font-display text-4xl font-black">2.847 <span className="text-lg text-[#c4b6cf]">SOL</span></p><p className="mt-2 flex items-center gap-1 text-sm font-bold text-[#3ed9a3]"><ArrowUpRight size={16}/> +0.184 SOL <span className="font-normal text-[#a99ab7]">today</span></p></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#7c3aed]/20 text-[#bd9cff]"><Wallet size={20}/></div></div><div className="mt-6 rounded-2xl bg-white/[.04] px-3 pt-3"><TinyChart/><div className="flex justify-between border-t border-white/5 py-3 text-[10px] font-bold uppercase tracking-wider text-[#82728e]"><span>9 AM</span><span>12 PM</span><span>Now</span></div></div><button className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-[#ebe1f1] hover:bg-white/10">View portfolio</button></article>
            </div>

            <div className="mt-8 grid gap-7 xl:grid-cols-[1.42fr_.8fr]">
              <section><div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-2xl font-black">Hot right now</h2><p className="mt-1 text-sm text-[#a99ab7]">Powered by the internet’s pulse</p></div><button className="text-sm font-bold text-[#c99bff]">See all markets <ChevronRight className="inline" size={16}/></button></div><div className="grid gap-3 sm:grid-cols-2">
                {celebs.map((celeb) => <button key={celeb.ticker} onClick={() => { setSelected(celeb); setTradeOpen(true); }} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1e112f] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#a97cff]/50 hover:bg-[#261638]"><img src={celeb.image} alt={celeb.name} className="h-[60px] w-[60px] rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{celeb.name}</p><p className="mt-0.5 text-[11px] font-bold text-[#9b8ba8]">${celeb.ticker}</p><p className="mt-1 text-sm font-black">{celeb.price.toFixed(2)} <span className="text-xs font-bold text-[#a99ab7]">SOL</span></p></div><div className={`rounded-lg px-2 py-1 text-xs font-extrabold ${celeb.change > 0 ? "bg-[#183b33] text-[#62e7b6]" : "bg-[#482332] text-[#ff9ca5]"}`}>{celeb.change > 0 ? "+" : ""}{celeb.change}%</div></button>)}
              </div>
              <article className="mt-7 rounded-[24px] border border-white/10 bg-[#1e112f] p-5"><div className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]"><Flame size={15} fill="currentColor"/> Daily spark</p><h3 className="mt-2 font-display text-xl font-black">Catch the heat</h3><p className="mt-1 text-sm text-[#b5a6c1]">Trade 3 celebrities with rising hype.</p></div><div className="text-right"><p className="text-lg font-black">2 <span className="text-xs text-[#9b8ba8]">/ 3</span></p><p className="text-[11px] font-bold text-[#ffd17b]">+ 0.05 SOL</p></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 rounded-full bg-[#f5ab43]"/></div></article></section>

              <section className="space-y-5"><article className="rounded-[24px] border border-white/10 bg-[#1e112f] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">This week</p><h2 className="mt-1 font-display text-2xl font-black">Top traders</h2></div><Trophy className="text-[#ffd17b]" size={22}/></div><div className="mt-5 space-y-4">{[["1", "nova.makes.moves", "+4.82 SOL", "#f5ab43"], ["2", "you", "+2.10 SOL", "#bd9cff"], ["3", "milaafterdark", "+1.79 SOL", "#68d9bf"]].map(([rank, name, pnl, color]) => <div key={rank} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-lg text-xs font-black" style={{ backgroundColor: `${color}22`, color }}>{rank}</span><div className="grid h-8 w-8 place-items-center rounded-full bg-[#523666] text-xs font-black">{String(name).slice(0, 1).toUpperCase()}</div><p className="flex-1 text-sm font-bold">{name}</p><p className="text-sm font-black text-[#62e7b6]">{pnl}</p></div>)}</div><button className="mt-5 w-full text-xs font-bold text-[#c99bff]">View leaderboard <ChevronRight className="inline" size={14}/></button></article>
              <article className="overflow-hidden rounded-[24px] border border-[#ff7282]/25 bg-[#301b3c] p-5"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#ff7282] text-[#491d35]"><Gem size={22}/></div><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#ffb6be]">New badge</p><h3 className="font-display text-lg font-black">Trendsetter</h3></div></div><p className="mt-3 text-sm leading-5 text-[#d9c2d4]">You spotted two price breakouts before the crowd this week.</p></article></section>
            </div>
          </div>
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-white/10 bg-[#1a0e2a]/95 px-2 py-3 backdrop-blur lg:hidden"><button className="flex flex-col items-center gap-1 text-[10px] font-bold text-[#c99bff]"><Home size={19}/>Home</button><button className="flex flex-col items-center gap-1 text-[10px] font-bold text-[#897b95]"><LayoutGrid size={19}/>Markets</button><button className="flex flex-col items-center gap-1 text-[10px] font-bold text-[#897b95]"><Wallet size={19}/>Portfolio</button><button className="flex flex-col items-center gap-1 text-[10px] font-bold text-[#897b95]"><Trophy size={19}/>Ranks</button></nav>

      {tradeOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0e0717]/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"><div className="w-full max-w-md rounded-t-[30px] border border-white/10 bg-[#211230] p-6 shadow-2xl sm:rounded-[30px]"><div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]">Live devnet order</p><h2 className="mt-1 font-display text-2xl font-black">Trade {selected.ticker}</h2></div><button onClick={() => setTradeOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[#c7b9d1]"><X size={18}/></button></div><div className="mt-5 flex rounded-xl bg-white/5 p-1">{(["Buy", "Sell"] as const).map((side) => <button onClick={() => setTradeSide(side)} key={side} className={`flex-1 rounded-lg py-2.5 text-sm font-black transition ${tradeSide === side ? side === "Buy" ? "bg-[#3ed9a3] text-[#142c26]" : "bg-[#ff7282] text-[#401b2d]" : "text-[#a89aad]"}`}>{side}</button>)}</div><div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[.04] p-3"><img src={selected.image} alt="" className="h-12 w-12 rounded-xl object-cover"/><div className="flex-1"><p className="font-bold">{selected.name}</p><p className="text-xs text-[#9b8ba8]">{selected.price.toFixed(2)} SOL · +{selected.change}% today</p></div><button onClick={() => setWatching(!watching)} className={`grid h-9 w-9 place-items-center rounded-xl ${watching ? "bg-[#ffd17b] text-[#4c3111]" : "bg-white/5 text-[#c3b5cf]"}`}><Star size={17} fill={watching ? "currentColor" : "none"}/></button></div><label className="mt-5 block text-xs font-bold uppercase tracking-[.13em] text-[#a89aad]">Amount (SOL)<input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="mt-2 w-full rounded-xl border border-white/10 bg-[#140b20] px-4 py-3 text-xl font-black text-white outline-none focus:border-[#a97cff]" /></label><div className="mt-4 space-y-2 rounded-xl bg-white/[.04] p-4 text-sm"><div className="flex justify-between text-[#b6a8c1]"><span>Est. shares</span><strong className="text-white">{shares} {selected.ticker}</strong></div><div className="flex justify-between text-[#b6a8c1]"><span>Platform fee</span><strong className="text-white">0.5%</strong></div><div className="flex justify-between border-t border-white/10 pt-2 font-bold"><span>Order total</span><span>{amount || "0"} SOL</span></div></div><button onClick={submitTrade} className={`mt-5 w-full rounded-xl py-3.5 text-sm font-black ${tradeSide === "Buy" ? "bg-[#3ed9a3] text-[#112b24]" : "bg-[#ff7282] text-[#401b2d]"}`}>{tradeSide} {selected.ticker} on devnet</button><p className="mt-3 text-center text-[10px] leading-4 text-[#81738d]">Devnet uses test SOL. Celebrity shares are synthetic entertainment assets.</p></div></div>}
      {toast && <div className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-[#3ed9a3]/30 bg-[#173a31] px-4 py-3 text-sm font-bold text-[#9cf0cf] shadow-xl">{toast}</div>}
    </main>
  );
};

export default Index;
