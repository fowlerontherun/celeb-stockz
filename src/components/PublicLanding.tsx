import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BarChart3,
  ChartNoAxesCombined,
  Flame,
  Gamepad2,
  LineChart,
  LockKeyhole,
  PackageOpen,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

const howItWorks = [
  {
    icon: WalletCards,
    title: "Start with STKZ",
    body: "Create a free account and receive a practice balance to build your first celebrity portfolio.",
  },
  {
    icon: Search,
    title: "Find your picks",
    body: "Explore celebrity markets across music, sport, film, TV, politics, fashion, digital and comedy.",
  },
  {
    icon: Activity,
    title: "Follow the hype",
    body: "Prices are modelled from changing public-interest signals, saved market snapshots and trend momentum.",
  },
  {
    icon: Trophy,
    title: "Beat the market",
    body: "Grow your portfolio, challenge other players, join leagues and climb the rankings.",
  },
];

const features = [
  {
    icon: LineChart,
    title: "Trading-style charts",
    body: "Track price history, portfolio performance, allocation, exposure and profit or loss in a proper market dashboard.",
  },
  {
    icon: Flame,
    title: "Hype-powered markets",
    body: "Celebrity prices react to modelled popularity signals rather than arbitrary dice rolls.",
  },
  {
    icon: PackageOpen,
    title: "Themed market packs",
    body: "Unlock topical groups built around leagues, events, genres and moments in culture.",
  },
  {
    icon: Users,
    title: "Competitive play",
    body: "Watchlists, battles, custom leagues and rankings turn market predictions into a social game.",
  },
  {
    icon: Zap,
    title: "Fast-moving discovery",
    body: "Top movers and market heat help surface the names whose momentum is changing fastest.",
  },
  {
    icon: ShieldCheck,
    title: "Practice-first economy",
    body: "CelebStockz is a fantasy trading game. Current STKZ balances and celebrity shares are not real investments.",
  },
];

const faqs = [
  {
    q: "What is CelebStockz?",
    a: "CelebStockz is a fantasy celebrity trading game. Players use STKZ to take positions in celebrity markets and try to grow their portfolio as modelled hype and public-interest signals change.",
  },
  {
    q: "Is this real-money investing?",
    a: "No. The current game uses practice STKZ and simulated celebrity shares. They are not securities, investments or ownership in a celebrity.",
  },
  {
    q: "What makes a celebrity price move?",
    a: "Prices are generated from the platform's market model using available public-interest and trend signals, market snapshots and configured pricing rules. The product is designed as a game rather than a prediction of financial value.",
  },
  {
    q: "Which celebrities can I trade?",
    a: "Markets span music, sport, film, TV, politics, fashion, digital creators and comedy, with more names available through themed packs.",
  },
  {
    q: "What are celebrity packs?",
    a: "Packs group extra markets around a theme such as a sport, event, genre or cultural moment. They let the market catalogue expand without making every player screen overwhelming.",
  },
  {
    q: "How do I win?",
    a: "There is no single finish line. The core goal is to grow your portfolio and outperform other players through rankings, leagues and competitive game modes.",
  },
  {
    q: "Can I play for free?",
    a: "Yes. New accounts currently receive a practice STKZ balance so players can learn the market and start trading without buying anything.",
  },
  {
    q: "Is CelebStockz affiliated with the celebrities listed?",
    a: "No affiliation or endorsement is implied unless the platform explicitly states otherwise for a particular partnership.",
  },
];

function MarketPreview() {
  const rows = [
    ["TSWIFT", "108.15", "+12.6%"],
    ["BELLINGHAM", "65.84", "+14.2%"],
    ["ADELE", "45.76", "+8.4%"],
  ];

  return (
    <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#160c25] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9f90ac]">Market watch</p>
          <p className="mt-1 text-sm font-black">Trending celebrity markets</p>
        </div>
        <span className="rounded-lg bg-[#183b33] px-2 py-1 text-[10px] font-black text-[#78e8bd]">DEMO</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-2 text-[10px] font-black uppercase tracking-[.12em] text-[#756783]">
        <span>Market</span><span>Price</span><span>Move</span>
      </div>
      {rows.map(([ticker, price, move]) => (
        <div key={ticker} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2b1741] text-[10px] font-black text-[#c99bff]">{ticker.slice(0, 2)}</span>
            <span className="text-xs font-black">{ticker}</span>
          </div>
          <span className="text-xs font-bold text-[#e7ddef]">{price}</span>
          <span className="rounded-md bg-[#183b33] px-2 py-1 text-[10px] font-black text-[#78e8bd]">{move}</span>
        </div>
      ))}
    </div>
  );
}

function PortfolioPreview() {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[#160c25] p-4 shadow-2xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9f90ac]">Portfolio value</p>
          <p className="mt-1 text-2xl font-black">14,842.60 <span className="text-xs text-[#8e809a]">STKZ</span></p>
        </div>
        <span className="rounded-lg bg-[#183b33] px-2 py-1 text-[10px] font-black text-[#78e8bd]">+8.7%</span>
      </div>
      <div className="mt-5 flex h-24 items-end gap-1.5 rounded-2xl border border-white/5 bg-[#120b20] px-3 pb-3 pt-4">
        {[24, 31, 28, 38, 42, 39, 50, 47, 58, 63, 61, 72, 77, 74, 86, 91].map((height, index) => (
          <div key={index} className="flex-1 rounded-t bg-[#7c3aed]/70" style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[.04] p-3"><p className="text-[9px] font-black uppercase text-[#7f708c]">Cash</p><p className="mt-1 text-xs font-black">4,120</p></div>
        <div className="rounded-xl bg-white/[.04] p-3"><p className="text-[9px] font-black uppercase text-[#7f708c]">Invested</p><p className="mt-1 text-xs font-black">10,722</p></div>
        <div className="rounded-xl bg-white/[.04] p-3"><p className="text-[9px] font-black uppercase text-[#7f708c]">P&L</p><p className="mt-1 text-xs font-black text-[#78e8bd]">+1,187</p></div>
      </div>
    </div>
  );
}

function HypePreview() {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[#160c25] p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9f90ac]">Why it moved</p>
          <p className="mt-1 text-sm font-black">Signal momentum</p>
        </div>
        <Flame size={20} className="text-[#ff7282]" />
      </div>
      <div className="mt-4 space-y-3">
        {[["Trend score", 92], ["Search interest", 78], ["Social momentum", 86], ["News activity", 64]].map(([label, value]) => (
          <div key={String(label)}>
            <div className="flex items-center justify-between text-[10px] font-bold text-[#aa9ab5]"><span>{label}</span><span>{value}</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-[#ff7282]" style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicLanding() {
  return (
    <main className="min-h-screen bg-[#120b20] text-[#fff8f2]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#120b20]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#7c3aed]"><ChartNoAxesCombined size={20} /></span>
            <span className="font-display text-xl font-black">Celeb<span className="text-[#ff7282]">Stockz</span></span>
          </a>
          <nav className="hidden items-center gap-6 text-xs font-black text-[#b9a9c5] md:flex">
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#screens" className="transition hover:text-white">Screens</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth/sign-in" className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-[#e9dff1] transition hover:bg-white/10 sm:inline-flex">Sign in</Link>
            <Link to="/auth/sign-up" className="rounded-xl bg-[#ff7282] px-4 py-2.5 text-xs font-black text-[#401b2d] transition hover:bg-[#ff8f9b]">Play free</Link>
          </div>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-[#7c3aed]/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1280px] gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c99bff]/20 bg-[#7c3aed]/10 px-3 py-2 text-[11px] font-black uppercase tracking-[.16em] text-[#c99bff]"><Sparkles size={14} /> Fantasy celebrity trading</div>
            <h1 className="font-display mt-6 max-w-3xl text-5xl font-black leading-[.95] sm:text-6xl lg:text-7xl">Trade fame. Predict hype. <span className="text-[#ff7282]">Beat the market.</span></h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#c0b2ca] sm:text-lg">CelebStockz turns celebrity culture into a competitive fantasy market. Build a portfolio, back the names you think are about to trend and see whether your picks can outperform everyone else.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth/sign-up" className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#9061ef]">Create free account <ArrowRight size={16} /></Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-black text-[#eadff1] transition hover:bg-white/10">See how it works</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-[#9f90ac]">
              <span className="inline-flex items-center gap-2"><Gamepad2 size={15} className="text-[#c99bff]" /> Free practice play</span>
              <span className="inline-flex items-center gap-2"><LockKeyhole size={15} className="text-[#c99bff]" /> No real-money investing</span>
              <span className="inline-flex items-center gap-2"><BarChart3 size={15} className="text-[#c99bff]" /> Trading-style analytics</span>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-[#7c3aed]/20 to-[#ff7282]/10 blur-2xl" />
            <div className="relative rounded-[32px] border border-white/10 bg-[#211230]/90 p-3 shadow-2xl sm:p-5">
              <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-black uppercase tracking-[.16em] text-[#81718e]"><span>Product preview</span><span>Illustrative UI</span></div>
              <PortfolioPreview />
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">How it works</p>
          <h2 className="font-display mt-2 text-3xl font-black sm:text-4xl">A market game built around cultural momentum.</h2>
          <p className="mt-4 text-sm leading-6 text-[#ad9db8]">You are not buying a real celebrity. You are making a game prediction about attention, momentum and market movement.</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {howItWorks.map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="rounded-[24px] border border-white/10 bg-[#1b1029] p-5">
              <div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#7c3aed]/20 text-[#c99bff]"><Icon size={19} /></span><span className="text-xs font-black text-[#5f526a]">0{index + 1}</span></div>
              <h3 className="font-display mt-5 text-xl font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#a99ab5]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="border-y border-white/10 bg-[#170d29]">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ff9ca5]">Built for replayability</p><h2 className="font-display mt-2 text-3xl font-black sm:text-4xl">More than a list of celebrity prices.</h2></div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-[24px] border border-white/10 bg-[#211230] p-5"><Icon size={21} className="text-[#c99bff]" /><h3 className="font-display mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-[#aa9ab6]">{body}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section id="screens" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">Inside the game</p><h2 className="font-display mt-2 text-3xl font-black sm:text-4xl">See the market before you join it.</h2></div><p className="max-w-md text-sm leading-6 text-[#9f90ac]">These lightweight previews mirror the market, portfolio and signal experiences available after sign-in.</p></div>
        <div className="mt-9 grid gap-5 lg:grid-cols-3"><MarketPreview /><PortfolioPreview /><HypePreview /></div>
      </section>

      <section className="border-y border-white/10 bg-[#1a0f2a]">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ff9ca5]">Think you can spot the next move?</p><h2 className="font-display mt-2 text-3xl font-black">Start with 10,000 practice STKZ.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#ad9db8]">Build a portfolio, learn what drives the market model and find out whether your celebrity picks can beat the crowd.</p></div>
          <Link to="/auth/sign-up" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff7282] px-6 py-3.5 text-sm font-black text-[#401b2d] transition hover:bg-[#ff8d99]">Start trading free <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[960px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="text-center"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">FAQ</p><h2 className="font-display mt-2 text-3xl font-black sm:text-4xl">Before you make your first trade.</h2></div>
        <div className="mt-9 space-y-3">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border border-white/10 bg-[#1b1029] p-5 open:bg-[#211230]"><summary className="cursor-pointer list-none pr-7 text-sm font-black marker:hidden">{q}</summary><p className="mt-3 max-w-3xl text-sm leading-6 text-[#aa9ab5]">{a}</p></details>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#0f0819]">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-6 px-5 py-8 text-xs text-[#776985] sm:px-8 md:flex-row md:items-center">
          <div><p className="font-display text-base font-black text-[#e8deef]">Celeb<span className="text-[#ff7282]">Stockz</span></p><p className="mt-1">Fantasy celebrity markets for entertainment and game play.</p></div>
          <div className="flex flex-wrap gap-4 font-bold"><a href="#how-it-works" className="hover:text-white">How it works</a><a href="#features" className="hover:text-white">Features</a><a href="#faq" className="hover:text-white">FAQ</a><Link to="/auth/sign-in" className="hover:text-white">Sign in</Link></div>
        </div>
      </footer>
    </main>
  );
}
