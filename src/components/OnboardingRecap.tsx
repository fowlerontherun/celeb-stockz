import { useEffect, useState } from "react";
import { Bell, ChevronRight, Sparkles, Target, X } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type Preferences = {
  market_alerts: boolean;
  weekly_recap: boolean;
  education_tips: boolean;
  onboarding_dismissed: boolean;
};

type Recap = {
  modeledPortfolioValue: number;
  weeklyTradeCount: number;
  heldCategoryCount: number;
  followCount: number;
  inviteCount: number;
};

const defaultPreferences: Preferences = {
  market_alerts: true,
  weekly_recap: true,
  education_tips: true,
  onboarding_dismissed: false,
};

export function OnboardingRecap({ onStartTrading }: { onStartTrading: () => void }) {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [preferencesResponse, recapResponse] = await Promise.all([
        fetch("/api/preferences", { credentials: "include" }),
        fetch("/api/weekly-recap", { credentials: "include" }),
      ]);

      if (!preferencesResponse.ok || !recapResponse.ok) {
        throw new Error("Could not load your practice progress.");
      }

      setPreferences((await preferencesResponse.json()) as Preferences);
      setRecap((await recapResponse.json()) as Recap);
    };

    void load().catch((error: Error) => showError(error.message));
  }, []);

  useEffect(() => {
    if (!recap) return;

    const milestones = [
      [recap.weeklyTradeCount > 0, "first-trade", "First practice trade complete — nice start!"],
      [recap.followCount > 0, "first-follow", "Your first market is now on your watchlist."],
      [recap.inviteCount > 0, "first-invite", "Your first club invite is ready to share."],
    ] as const;

    milestones.forEach(([reached, key, message]) => {
      const storageKey = `celebstockz-milestone-${key}`;
      if (reached && !sessionStorage.getItem(storageKey)) {
        sessionStorage.setItem(storageKey, "shown");
        showSuccess(message);
      }
    });
  }, [recap]);

  const savePreferences = async (next: Preferences) => {
    setPreferences(next);
    setIsSaving(true);

    try {
      const response = await fetch("/api/preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          marketAlerts: next.market_alerts,
          weeklyRecap: next.weekly_recap,
          educationTips: next.education_tips,
          onboardingDismissed: next.onboarding_dismissed,
        }),
      });

      if (!response.ok) throw new Error("Could not save your preferences.");
    } catch (error) {
      setPreferences(preferences);
      showError(error instanceof Error ? error.message : "Could not save your preferences.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!recap) return null;

  return (
    <section className="mt-7 grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
      {!preferences.onboarding_dismissed && preferences.education_tips && (
        <article className="rounded-[26px] border border-[#c99bff]/30 bg-[#291845] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#7c3aed] text-white">
              <Sparkles size={20} />
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void savePreferences({ ...preferences, onboarding_dismissed: true })}
              className="grid h-8 w-8 place-items-center rounded-lg text-[#c7b5d4] transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss education tips permanently"
            >
              <X size={17} />
            </button>
          </div>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]">
            Quick start · optional
          </p>
          <h2 className="font-display mt-2 text-2xl font-black">Make your first practice move.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#d0bedc]">
            Browse a culture category, choose a market, and enter a STKZ amount. Every price is modeled for practice, never real investing.
          </p>
          <button
            type="button"
            onClick={onStartTrading}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#ff7282] px-4 py-3 text-sm font-black text-[#401b2d] transition hover:bg-[#ff8e9a]"
          >
            Explore markets <ChevronRight size={16} />
          </button>
        </article>
      )}

      <article className="rounded-[26px] border border-white/10 bg-[#1e112f] p-5 sm:p-6">
        <div className="flex items-center gap-2 text-[#ffd17b]">
          <Target size={17} />
          <p className="text-xs font-extrabold uppercase tracking-[.17em]">Your modeled week</p>
        </div>
        <p className="font-display mt-3 text-3xl font-black">
          {recap.modeledPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          <span className="text-sm text-[#b9a9c5]">STKZ</span>
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/[.05] p-2"><p className="text-lg font-black">{recap.weeklyTradeCount}</p><p className="text-[10px] font-bold text-[#a99ab7]">7d trades</p></div>
          <div className="rounded-xl bg-white/[.05] p-2"><p className="text-lg font-black">{recap.followCount}</p><p className="text-[10px] font-bold text-[#a99ab7]">following</p></div>
          <div className="rounded-xl bg-white/[.05] p-2"><p className="text-lg font-black">{recap.heldCategoryCount}</p><p className="text-[10px] font-bold text-[#a99ab7]">categories</p></div>
        </div>
      </article>

      <article className="rounded-[26px] border border-white/10 bg-[#1e112f] p-5 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.17em] text-[#c99bff]"><Bell size={15} /> Practice notifications</p><p className="mt-1 text-sm text-[#b9a9c5]">Control alerts and education without losing access to your account.</p></div>
          <div className="flex flex-wrap gap-2">
            {[
              ["market_alerts", "Movement alerts"],
              ["weekly_recap", "Weekly recap"],
              ["education_tips", "Learning tips"],
            ].map(([key, label]) => {
              const preferenceKey = key as keyof Preferences;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isSaving}
                  onClick={() => void savePreferences({ ...preferences, [preferenceKey]: !preferences[preferenceKey] })}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${preferences[preferenceKey] ? "bg-[#7c3aed] text-white" : "border border-white/10 bg-white/5 text-[#b9a9c5]"}`}
                >
                  {preferences[preferenceKey] ? "On · " : "Off · "}{label}
                </button>
              );
            })}
          </div>
        </div>
      </article>
    </section>
  );
}