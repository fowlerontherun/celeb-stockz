import { useEffect, useMemo, useState } from "react";
import { BookOpenText, CircleGauge, Plus, Target } from "lucide-react";
import type { CategorizedCelebrity } from "@/components/CategoryMarkets";
import { showError, showSuccess } from "@/utils/toast";

type Wallet = {
  balanceStkz: number;
  positions: Array<{ ticker: string; quantity: number }>;
};

type JournalEntry = {
  id: number;
  ticker: string;
  entryType: "note" | "entry" | "exit";
  note: string;
  createdAt: string;
};

type Goal = {
  type: "first_trade" | "watchlist" | "categories";
  targetValue: number;
  progress: number;
};

const goalLabels = {
  first_trade: "Complete live trades",
  watchlist: "Follow markets",
  categories: "Hold market categories",
};

export function PracticeTools({ markets }: { markets: CategorizedCelebrity[] }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [ticker, setTicker] = useState(markets[0]?.ticker ?? "");
  const [entryType, setEntryType] = useState<JournalEntry["entryType"]>("note");
  const [note, setNote] = useState("");
  const [scenarioTicker, setScenarioTicker] = useState(markets[0]?.ticker ?? "");
  const [scenarioMove, setScenarioMove] = useState("10");
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    try {
      const [walletResponse, journalResponse, goalResponse] = await Promise.all([
        fetch("/api/wallet", { credentials: "include" }),
        fetch("/api/practice/journal", { credentials: "include" }),
        fetch("/api/practice/goal", { credentials: "include" }),
      ]);
      if (!walletResponse.ok || !journalResponse.ok || !goalResponse.ok) {
        throw new Error("Could not load your live tools.");
      }
      setWallet(await walletResponse.json() as Wallet);
      setEntries((await journalResponse.json() as { entries: JournalEntry[] }).entries);
      setGoal((await goalResponse.json() as { goal: Goal }).goal);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not load your live tools.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const allocation = useMemo(() => {
    if (!wallet) return [];
    const grouped = new Map<string, number>();
    wallet.positions.forEach((position) => {
      const market = markets.find((item) => item.ticker === position.ticker);
      if (!market) return;
      grouped.set(market.category, (grouped.get(market.category) ?? 0) + position.quantity * market.price);
    });
    const total = [...grouped.values()].reduce((sum, value) => sum + value, 0);
    return [...grouped.entries()]
      .map(([category, value]) => ({ category, value, share: total ? (value / total) * 100 : 0 }))
      .sort((first, second) => second.value - first.value);
  }, [markets, wallet]);

  const scenario = markets.find((market) => market.ticker === scenarioTicker);
  const simulatedMove = Math.max(-50, Math.min(50, Number(scenarioMove) || 0));
  const simulatedPrice = scenario ? scenario.price * (1 + simulatedMove / 100) : 0;

  const saveEntry = async () => {
    if (!note.trim()) {
      showError("Write a short note before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/practice/journal", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker, entryType, note }),
      });
      const data = await response.json() as JournalEntry & { statusMessage?: string };
      if (!response.ok) throw new Error(data.statusMessage ?? "Could not save your journal entry.");
      setEntries((current) => [data, ...current]);
      setNote("");
      showSuccess("Live trade note saved.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save your journal entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateGoal = async (type: Goal["type"], targetValue: number) => {
    try {
      const response = await fetch("/api/practice/goal", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, targetValue }),
      });
      if (!response.ok) throw new Error("Could not save your goal.");
      await load();
      showSuccess("Live trade goal updated.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save your goal.");
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#c99bff]">Live studio</p>
      <h1 className="font-display mt-1 text-3xl font-black sm:text-4xl">Build your trading muscle.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#b8a9c4]">Journal your thinking, track a personal goal, and explore hypothetical modeled moves. Nothing here is financial advice or a market forecast.</p>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        <section className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
          <div className="flex items-center gap-2"><Target className="text-[#ffd17b]" size={19} /><h2 className="font-display text-2xl font-black">Your live goal</h2></div>
          {goal && <><p className="mt-4 text-sm font-bold">{goalLabels[goal.type]}</p><p className="mt-1 text-sm text-[#b9a9c5]">{goal.progress} of {goal.targetValue} complete</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#ff7282]" style={{ width: `${Math.min(100, (goal.progress / goal.targetValue) * 100)}%` }} /></div></>}
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_5rem]">
            <select value={goal?.type ?? "first_trade"} onChange={(event) => goal && void updateGoal(event.target.value as Goal["type"], goal.targetValue)} className="rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm font-bold outline-none focus:border-[#a97cff]">
              {Object.entries(goalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input type="number" min="1" max="20" value={goal?.targetValue ?? 1} onChange={(event) => goal && void updateGoal(goal.type, Number(event.target.value))} className="rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm font-black outline-none focus:border-[#a97cff]" aria-label="Goal target" />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
          <div className="flex items-center gap-2"><CircleGauge className="text-[#62e7b6]" size={19} /><h2 className="font-display text-2xl font-black">Category allocation</h2></div>
          {allocation.length ? <div className="mt-5 space-y-3">{allocation.map((item) => <div key={item.category}><div className="flex justify-between text-sm"><span className="font-bold">{item.category}</span><span className="text-[#c4b4d0]">{item.share.toFixed(0)}% · {item.value.toFixed(0)} STKZ</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#62e7b6]" style={{ width: `${item.share}%` }} /></div></div>)}</div> : <p className="mt-5 text-sm leading-6 text-[#b9a9c5]">Your category mix will appear after you hold a live-market position.</p>}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-6">
          <div className="flex items-center gap-2"><BookOpenText className="text-[#c99bff]" size={19} /><h2 className="font-display text-2xl font-black">Trade journal</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <select value={ticker} onChange={(event) => setTicker(event.target.value)} className="rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm font-bold outline-none focus:border-[#a97cff]">{markets.map((market) => <option key={market.ticker} value={market.ticker}>{market.ticker}</option>)}</select>
            <select value={entryType} onChange={(event) => setEntryType(event.target.value as JournalEntry["entryType"])} className="rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm font-bold outline-none focus:border-[#a97cff]"><option value="note">Observation</option><option value="entry">Entry idea</option><option value="exit">Exit reflection</option></select>
          </div>
          <textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Why does this market have your attention?" className="mt-3 min-h-24 w-full rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm outline-none focus:border-[#a97cff]" />
          <button type="button" onClick={() => void saveEntry()} disabled={isSaving} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-3 text-sm font-black disabled:opacity-50"><Plus size={16} />{isSaving ? "Saving…" : "Save note"}</button>
          <div className="mt-5 space-y-2">{entries.slice(0, 4).map((entry) => <article key={entry.id} className="rounded-xl bg-white/[.04] p-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#c99bff]">{entry.ticker} · {entry.entryType}</p><p className="mt-1 text-sm text-[#e7dbea]">{entry.note}</p></article>)}</div>
        </section>

        <section className="rounded-[28px] border border-[#ffd17b]/25 bg-[#2a1b32] p-5 sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ffd17b]">Live only</p>
          <h2 className="font-display mt-2 text-2xl font-black">Modeled move simulator</h2>
          <p className="mt-2 text-sm leading-6 text-[#d8c9d8]">Explore a simple percentage change against the latest displayed live snapshot. It never changes a market price or your holdings.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <select value={scenarioTicker} onChange={(event) => setScenarioTicker(event.target.value)} className="rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm font-bold outline-none focus:border-[#ffd17b]">{markets.map((market) => <option key={market.ticker} value={market.ticker}>{market.name}</option>)}</select>
            <label className="rounded-xl border border-white/10 bg-[#160c25] px-3 py-2 text-xs font-bold text-[#b9a9c5]">Signal change %<input value={scenarioMove} onChange={(event) => setScenarioMove(event.target.value)} inputMode="decimal" className="mt-1 w-full bg-transparent text-lg font-black text-white outline-none" /></label>
          </div>
          <div className="mt-5 rounded-2xl bg-white/[.07] p-4"><p className="text-xs font-bold text-[#cbbccc]">Illustrative {scenario?.ticker} snapshot</p><p className="font-display mt-1 text-3xl font-black">{simulatedPrice.toFixed(2)} <span className="text-sm text-[#cbbccc]">STKZ</span></p><p className="mt-1 text-xs font-bold text-[#ffd17b]">{simulatedMove >= 0 ? "+" : ""}{simulatedMove.toFixed(1)}% from the current modeled snapshot</p></div>
        </section>
      </div>
    </div>
  );
}