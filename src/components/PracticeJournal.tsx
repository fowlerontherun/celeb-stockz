import { useCallback, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Flag, LoaderCircle, Plus, Send, Target } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type GoalType = "first_trade" | "watchlist" | "categories";

type GoalData = {
  type: GoalType;
  targetValue: number;
  progress: number;
};

type JournalEntry = {
  id: number;
  ticker: string;
  entryType: "note" | "entry" | "exit";
  note: string;
  createdAt: string;
};

const goalDescriptions: Record<GoalType, { title: string; subtitle: string }> = {
  first_trade: {
    title: "Execute Practice Trades",
    subtitle: "Complete your target number of market trades.",
  },
  watchlist: {
    title: "Build Watchlist",
    subtitle: "Follow emerging cultural market tickers.",
  },
  categories: {
    title: "Diversify Across Categories",
    subtitle: "Hold positions in music, sports, film, TV, digital, or fashion.",
  },
};

export function PracticeJournal({
  availableTickers,
}: {
  availableTickers: string[];
}) {
  const [goal, setGoal] = useState<GoalData | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Note State
  const [selectedTicker, setSelectedTicker] = useState(availableTickers[0] ?? "TSWIFT");
  const [entryType, setEntryType] = useState<"note" | "entry" | "exit">("note");
  const [noteContent, setNoteContent] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Edit Goal State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>("first_trade");
  const [targetValue, setTargetValue] = useState(5);
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [goalRes, journalRes] = await Promise.all([
        fetch("/api/practice/goal", { credentials: "include" }),
        fetch("/api/practice/journal", { credentials: "include" }),
      ]);

      if (goalRes.ok) {
        const data = (await goalRes.json()) as { goal: GoalData };
        setGoal(data.goal);
        setGoalType(data.goal.type);
        setTargetValue(data.goal.targetValue);
      }

      if (journalRes.ok) {
        const data = (await journalRes.json()) as { entries: JournalEntry[] };
        setEntries(data.entries);
      }
    } catch {
      // Ignore background errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveGoal = async () => {
    setIsSavingGoal(true);
    try {
      const response = await fetch("/api/practice/goal", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: goalType, targetValue }),
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not save goal.");
      }

      showSuccess("Practice trading goal updated.");
      setIsEditingGoal(false);
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save goal.");
    } finally {
      setIsSavingGoal(false);
    }
  };

  const addJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      showError("Please enter your journal note.");
      return;
    }

    setIsSubmittingNote(true);
    try {
      const response = await fetch("/api/practice/journal", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker,
          entryType,
          note: noteContent.trim(),
        }),
      });
      const data = (await response.json()) as JournalEntry & { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not save journal entry.");
      }

      showSuccess("Journal entry recorded.");
      setNoteContent("");
      await loadData();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Could not save entry.");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-48 place-items-center">
        <LoaderCircle className="animate-spin text-[#c99bff]" />
      </div>
    );
  }

  const goalComplete = goal ? goal.progress >= goal.targetValue : false;
  const progressPercent = goal
    ? Math.min(100, Math.round((goal.progress / goal.targetValue) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Mastery Goal Card */}
      {goal && (
        <section className="rounded-[24px] border border-[#c99bff]/30 bg-[#25143a] p-5 sm:p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#7c3aed] text-white">
                <Target size={20} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#c99bff]">
                  Practice Goal
                </p>
                <h3 className="font-display mt-0.5 text-xl font-black text-white">
                  {goalDescriptions[goal.type]?.title ?? "Trading Target"}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEditingGoal(!isEditingGoal)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#d8c1ff] hover:bg-white/10"
            >
              {isEditingGoal ? "Close" : "Change Goal"}
            </button>
          </div>

          {!isEditingGoal ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#c4b4d0]">
                  {goalDescriptions[goal.type]?.subtitle}
                </span>
                <span className={goalComplete ? "font-black text-[#62e7b6]" : "text-[#ffd17b]"}>
                  {goal.progress} / {goal.targetValue} ({progressPercent}%)
                </span>
              </div>

              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/40">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    goalComplete ? "bg-[#62e7b6]" : "bg-gradient-to-r from-[#7c3aed] to-[#c99bff]"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {goalComplete && (
                <p className="mt-2.5 inline-flex items-center gap-1 text-xs font-black text-[#62e7b6]">
                  <CheckCircle2 size={14} /> Goal accomplished! Set a new target to keep improving.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#160c25] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                    Goal Type
                  </label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value as GoalType)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#211230] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#c99bff]"
                  >
                    <option value="first_trade">Practice Trades Completed</option>
                    <option value="watchlist">Markets on Watchlist</option>
                    <option value="categories">Distinct Categories Held</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">
                    Target Quantity (1–20)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value) || 1)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#211230] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#c99bff]"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGoal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-[#a99ab7] hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingGoal}
                  onClick={() => void saveGoal()}
                  className="rounded-lg bg-[#7c3aed] px-4 py-1.5 text-xs font-black text-white hover:bg-[#9361f5] disabled:opacity-50"
                >
                  {isSavingGoal ? "Saving…" : "Save Goal"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. Log Trade Rationale Entry Form */}
      <section className="rounded-[24px] border border-white/10 bg-[#1e112f] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[#ffd17b]">
          <BookOpen size={18} />
          <h3 className="font-display text-lg font-black text-white">
            Log Trade Thesis & Notes
          </h3>
        </div>
        <p className="mt-1 text-xs text-[#a99ab7]">
          Document why you bought or sold a celebrity asset to build discipline and analyze decisions over time.
        </p>

        <form onSubmit={addJournalEntry} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase text-[#a99ab7]">
                Market
              </label>
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#140b20] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#c99bff]"
              >
                {availableTickers.map((t) => (
                  <option key={t} value={t}>
                    ${t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-[#a99ab7]">
                Entry Type
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as "note" | "entry" | "exit")}
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#140b20] px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#c99bff]"
              >
                <option value="entry">Trade Entry (Why I bought)</option>
                <option value="exit">Trade Exit (Why I sold)</option>
                <option value="note">Market Observation / Sentiment</option>
              </select>
            </div>
          </div>

          <div>
            <textarea
              rows={3}
              maxLength={1000}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="e.g. Bought after seeing massive festival buzz and high Wikipedia activity surge…"
              className="w-full rounded-xl border border-white/10 bg-[#140b20] p-3 text-xs font-medium text-white outline-none placeholder:text-[#6a5b78] focus:border-[#c99bff]"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#8a7b97]">
              {noteContent.length}/1000 characters
            </span>

            <button
              type="submit"
              disabled={isSubmittingNote || !noteContent.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-4 py-2 text-xs font-black text-white hover:bg-[#9361f5] disabled:opacity-50"
            >
              {isSubmittingNote ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />}
              Save to Journal
            </button>
          </div>
        </form>
      </section>

      {/* 3. Recorded Entries List */}
      <section className="rounded-[24px] border border-white/10 bg-[#1e112f] p-5 sm:p-6">
        <h4 className="font-display text-base font-black text-white">
          Past Journal Entries ({entries.length})
        </h4>

        {entries.length === 0 ? (
          <p className="mt-3 text-xs text-[#8f7e9f]">
            No journal entries recorded yet. Use the form above to document your trading thesis.
          </p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {entries.map((entry) => {
              const badgeColor =
                entry.entryType === "entry"
                  ? "bg-[#183b33] text-[#62e7b6]"
                  : entry.entryType === "exit"
                  ? "bg-[#482332] text-[#ff9ca5]"
                  : "bg-[#7c3aed]/20 text-[#d7b9ff]";

              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-white/5 bg-white/[.02] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-black text-white">
                        ${entry.ticker}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${badgeColor}`}
                      >
                        {entry.entryType}
                      </span>
                    </div>

                    <span className="text-[10px] text-[#8a7b97]">
                      {new Intl.DateTimeFormat([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(entry.createdAt))}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[#d5c7df] whitespace-pre-wrap">
                    {entry.note}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}