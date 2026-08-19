import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Globe,
  KeyRound,
  Newspaper,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  Youtube,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ListingAdmin } from "@/components/ListingAdmin";
import { showError, showSuccess } from "@/utils/toast";

type Source = {
  source_key: string;
  status: string;
  last_checked_at: string | null;
  last_success_at: string | null;
  detail: string | null;
};

type Refresh = {
  started_at: string;
  status: string;
  refreshed_count: number;
  verified_count: number;
  unavailable_count: number;
  flagged_count: number;
};

type EditableSettings = {
  youtubeApiKey: string;
  youtubeChannels: Record<string, string>;
  googleSearchApiKey: string;
  googleSearchEngineId: string;
  marketRefreshSecret: string;
  adminEmails: string;
};

type Operations = {
  sources: Source[];
  recentRefreshes: Refresh[];
  system: {
    tradingPaused: boolean;
    updatedAt: string | null;
    apiConfiguration: {
      youtube: boolean;
      search: boolean;
      marketRefreshSecret: boolean;
    };
    editableSettings: EditableSettings;
  };
  metrics: {
    verifiedSnapshots: number;
    unavailableSnapshots: number;
    flaggedSnapshots: number;
    latestVerifiedAt: string | null;
    averageFreshnessMinutes: number;
    stableSnapshotRate: number;
    latestRefreshSuccessRate: number | null;
    completedTrades: number;
    weeklyTrades: number;
    openOrders: number;
  };
};

type DiagnosticResult = {
  ticker: string;
  name: string;
  wikipediaTitle: string;
  channelMapped: boolean;
  channelId: string | null;
  diagnostics: {
    wikipedia: {
      dailyPageviews: number | null;
      status: "verified" | "unavailable";
      recentRevisions7d: number | null;
      revisionsStatus: "verified" | "unavailable";
    };
    news: {
      mentions7d: number | null;
      status: "verified" | "unavailable";
    };
    search: {
      resultsCount: number | null;
      status: "verified" | "unavailable";
      detail: string;
    };
    youtube: {
      subscribers: number | null;
      views: number | null;
      status: "verified" | "unavailable";
    };
    trades: {
      pressure: number;
      status: "verified";
    };
  };
};

const testableCelebrities = [
  { name: "Taylor Swift", ticker: "TSWIFT" },
  { name: "Adele", ticker: "ADELE" },
  { name: "Dua Lipa", ticker: "DUALIPA" },
  { name: "Ed Sheeran", ticker: "EDSHEERAN" },
  { name: "Harry Styles", ticker: "HSTYLES" },
  { name: "Stormzy", ticker: "STORMZY" },
  { name: "Cristiano Ronaldo", ticker: "CR7" },
  { name: "Jude Bellingham", ticker: "BELLINGHAM" },
  { name: "MrBeast", ticker: "MRBEAST" },
  { name: "KSI", ticker: "KSI" },
  { name: "Cillian Murphy", ticker: "MURPHY" },
  { name: "Anya Taylor-Joy", ticker: "ANYATJ" },
];

function formatDate(value: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat([], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFreshness(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "Not available";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} hr`;
}

function diagnosticStatusClass(status: "verified" | "unavailable") {
  return status === "verified" ? "text-[#62e7b6]" : "text-[#ffd17b]";
}

export default function MarketOperations() {
  const [data, setData] = useState<Operations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingTrading, setIsUpdatingTrading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTriggeringRefresh, setIsTriggeringRefresh] = useState(false);
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [youtubeChannelsJson, setYoutubeChannelsJson] = useState("");
  const [googleSearchApiKey, setGoogleSearchApiKey] = useState("");
  const [googleSearchEngineId, setGoogleSearchEngineId] = useState("");
  const [marketRefreshSecret, setMarketRefreshSecret] = useState("");
  const [adminEmails, setAdminEmails] = useState("");
  const [selectedTestTicker, setSelectedTestTicker] = useState("TSWIFT");
  const [isTestingSignals, setIsTestingSignals] = useState(false);
  const [testResult, setTestResult] = useState<DiagnosticResult | null>(null);

  const loadOperations = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/internal/market-operations", {
        credentials: "include",
      });
      const payload = (await response.json()) as Operations & {
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.statusMessage ?? "Could not load market operations.",
        );
      }

      setData(payload);
      setYoutubeApiKey(payload.system.editableSettings.youtubeApiKey);
      setYoutubeChannelsJson(
        JSON.stringify(payload.system.editableSettings.youtubeChannels, null, 2),
      );
      setGoogleSearchApiKey(payload.system.editableSettings.googleSearchApiKey);
      setGoogleSearchEngineId(
        payload.system.editableSettings.googleSearchEngineId,
      );
      setMarketRefreshSecret(
        payload.system.editableSettings.marketRefreshSecret,
      );
      setAdminEmails(payload.system.editableSettings.adminEmails);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not load market operations.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let parsedChannels: Record<string, string> = {};

    try {
      if (youtubeChannelsJson.trim()) {
        const parsed = JSON.parse(youtubeChannelsJson) as unknown;
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          throw new Error("Channel mappings must be a JSON object.");
        }
        parsedChannels = parsed as Record<string, string>;
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Channel mappings must contain valid JSON.",
      );
      return;
    }

    setIsSavingSettings(true);

    try {
      const response = await fetch("/api/internal/market-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          youtubeApiKey,
          youtubeChannels: parsedChannels,
          googleSearchApiKey,
          googleSearchEngineId,
          marketRefreshSecret,
          adminEmails,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.statusMessage ?? "Could not save data service settings.",
        );
      }

      showSuccess("Data service settings saved and signal cache cleared.");
      await loadOperations();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not save data service settings.",
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const triggerManualRefresh = async () => {
    if (
      !window.confirm(
        "Trigger an immediate market refresh using the current configured signals?",
      )
    ) {
      return;
    }

    setIsTriggeringRefresh(true);

    try {
      const response = await fetch("/api/internal/market-refresh-trigger", {
        method: "POST",
        credentials: "include",
      });
      const result = (await response.json()) as {
        verifiedCount?: number;
        unavailableCount?: number;
        flaggedCount?: number;
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(result.statusMessage ?? "Market refresh failed.");
      }

      showSuccess(
        `Refresh complete: ${result.verifiedCount ?? 0} verified, ${
          result.unavailableCount ?? 0
        } unavailable, ${result.flaggedCount ?? 0} flagged.`,
      );
      await loadOperations();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not complete market refresh.",
      );
    } finally {
      setIsTriggeringRefresh(false);
    }
  };

  const runSignalTest = async () => {
    setIsTestingSignals(true);

    try {
      const response = await fetch("/api/internal/market-test-signals", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker: selectedTestTicker }),
      });
      const result = (await response.json()) as DiagnosticResult & {
        statusMessage?: string;
      };

      if (!response.ok) {
        throw new Error(result.statusMessage ?? "Signal test failed.");
      }

      setTestResult(result);
      showSuccess(`Live diagnostic complete for ${result.name}.`);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not run live signal test.",
      );
    } finally {
      setIsTestingSignals(false);
    }
  };

  const updateTradingStatus = async () => {
    if (!data) return;

    const nextPaused = !data.system.tradingPaused;
    const action = nextPaused ? "pause" : "resume";

    if (
      !window.confirm(
        `Are you sure you want to ${action} new practice trades for all users?`,
      )
    ) {
      return;
    }

    setIsUpdatingTrading(true);

    try {
      const response = await fetch("/api/internal/trading-status", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: nextPaused }),
      });
      const result = (await response.json()) as {
        tradingPaused?: boolean;
        updatedAt?: string;
        statusMessage?: string;
      };

      if (!response.ok || typeof result.tradingPaused !== "boolean") {
        throw new Error(
          result.statusMessage ?? "Could not update trading status.",
        );
      }

      setData((current) =>
        current
          ? {
              ...current,
              system: {
                ...current.system,
                tradingPaused: result.tradingPaused,
                updatedAt: result.updatedAt ?? current.system.updatedAt,
              },
            }
          : current,
      );

      showSuccess(
        result.tradingPaused
          ? "New practice trades are paused."
          : "New practice trades are live.",
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not update trading status.",
      );
    } finally {
      setIsUpdatingTrading(false);
    }
  };

  const staleSourceCount = useMemo(
    () =>
      (data?.sources ?? []).filter((source) => {
        if (!source.last_success_at) return true;
        return (
          Date.now() - new Date(source.last_success_at).getTime() >
          8 * 60 * 60 * 1000
        );
      }).length,
    [data],
  );

  if (isLoading && !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <RefreshCw className="animate-spin" />
      </main>
    );
  }

  if (!data) return null;

  const metricCards = [
    [
      "Refresh success",
      data.metrics.latestRefreshSuccessRate === null
        ? "—"
        : `${data.metrics.latestRefreshSuccessRate}%`,
      "Latest approved cycle",
    ],
    [
      "Average freshness",
      formatFreshness(data.metrics.averageFreshnessMinutes),
      "Across latest verified snapshots",
    ],
    [
      "Price stability",
      `${data.metrics.stableSnapshotRate.toFixed(1)}%`,
      "Snapshots inside the movement cap",
    ],
    ["Stale sources", String(staleSourceCount), "Older than eight hours"],
    ["Flagged movements", String(data.metrics.flaggedSnapshots), "Held for review"],
    [
      "Completed trades",
      String(data.metrics.completedTrades),
      `${data.metrics.weeklyTrades} in the last seven days`,
    ],
    ["Open orders", String(data.metrics.openOrders), "Evaluated after verified snapshots"],
  ];

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link to="/" className="text-sm font-bold text-[#c99bff] transition hover:text-white">
              ← Back to markets
            </Link>
            <p className="mt-7 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
              <ShieldCheck size={15} /> Restricted operations
            </p>
            <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
              Market control center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c4b4d0]">
              Configure data providers, test live signals, control practice trading, and monitor the health of the market refresh system.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void triggerManualRefresh()} disabled={isTriggeringRefresh} className="inline-flex items-center gap-2 rounded-xl bg-[#ff7282] px-4 py-3 text-sm font-black text-[#401b2d] shadow-lg transition hover:bg-[#ff8f9c] disabled:opacity-50">
              <Zap size={16} className={isTriggeringRefresh ? "animate-spin" : ""} />
              {isTriggeringRefresh ? "Refreshing…" : "Run refresh now"}
            </button>
            <button type="button" onClick={() => void loadOperations()} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black transition hover:bg-white/10 disabled:opacity-50">
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              Refresh view
            </button>
          </div>
        </header>

        <section className={`mt-8 rounded-[28px] border p-5 sm:flex sm:items-center sm:justify-between sm:p-7 ${data.system.tradingPaused ? "border-[#ff7282]/40 bg-[#391b35]" : "border-[#62e7b6]/30 bg-[#15362f]"}`}>
          <div className="flex gap-4">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${data.system.tradingPaused ? "bg-[#ff7282] text-[#401b2d]" : "bg-[#62e7b6] text-[#112b24]"}`}>
              {data.system.tradingPaused ? <PauseCircle size={24} /> : <PlayCircle size={24} />}
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.16em]">Global practice trading</p>
              <h2 className="font-display mt-1 text-2xl font-black">{data.system.tradingPaused ? "New trades are paused" : "Trading is live"}</h2>
              <p className="mt-1 text-sm text-[#e4d3e2]">{data.system.tradingPaused ? "Market buys, sells, and new orders are blocked." : "Users can place market, limit, and stop orders normally."}</p>
            </div>
          </div>

          <button type="button" disabled={isUpdatingTrading} onClick={() => void updateTradingStatus()} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition disabled:opacity-50 sm:mt-0 sm:w-auto ${data.system.tradingPaused ? "bg-[#62e7b6] text-[#112b24] hover:bg-[#83efc8]" : "bg-[#ff7282] text-[#401b2d] hover:bg-[#ff8e9a]"}`}>
            {data.system.tradingPaused ? <PlayCircle size={17} /> : <PauseCircle size={17} />}
            {isUpdatingTrading ? "Updating…" : data.system.tradingPaused ? "Resume trading" : "Pause trading"}
          </button>
        </section>

        <ListingAdmin />

        <section className="mt-7 rounded-[28px] border border-[#62e7b6]/30 bg-[#162725] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#62e7b6]">
            <Activity size={20} />
            <p className="text-xs font-extrabold uppercase tracking-[.18em]">Live signal diagnostics</p>
          </div>
          <h2 className="font-display mt-2 text-2xl font-black">Test celebrity data feeds</h2>
          <p className="mt-2 text-sm leading-6 text-[#c4ded8]">Check Wikipedia, GDELT, Google Search, YouTube, and practice-trade signals for a selected celebrity.</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <select value={selectedTestTicker} onChange={(event) => setSelectedTestTicker(event.target.value)} className="rounded-xl border border-white/15 bg-[#121f1d] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#62e7b6]">
              {testableCelebrities.map((celebrity) => <option key={celebrity.ticker} value={celebrity.ticker}>{celebrity.name} (${celebrity.ticker})</option>)}
            </select>
            <button type="button" disabled={isTestingSignals} onClick={() => void runSignalTest()} className="inline-flex items-center gap-2 rounded-xl bg-[#62e7b6] px-5 py-3 text-sm font-black text-[#112b24] transition hover:bg-[#80ecc8] disabled:opacity-50">
              <Zap size={16} className={isTestingSignals ? "animate-spin" : ""} />
              {isTestingSignals ? "Testing…" : "Test live signals"}
            </button>
          </div>

          {testResult && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f1b19] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h3 className="font-display text-lg font-black">{testResult.name} (${testResult.ticker})</h3>
                  <p className="text-xs text-[#a4c9c0]">Wikipedia: <span className="font-mono">{testResult.wikipediaTitle}</span></p>
                </div>
                <span className={`rounded-lg px-2 py-1 text-xs font-black ${testResult.channelMapped ? "bg-[#183b33] text-[#62e7b6]" : "bg-white/5 text-[#a4c9c0]"}`}>{testResult.channelMapped ? `YouTube mapped (${testResult.channelId})` : "No YouTube mapping"}</span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DiagnosticCard icon={<Globe size={14} />} label="Wikipedia views" value={testResult.diagnostics.wikipedia.dailyPageviews === null ? "—" : testResult.diagnostics.wikipedia.dailyPageviews.toLocaleString()} detail="Yesterday's pageviews" status={testResult.diagnostics.wikipedia.status} />
                <DiagnosticCard icon={<Globe size={14} />} label="Article edits" value={testResult.diagnostics.wikipedia.recentRevisions7d === null ? "—" : String(testResult.diagnostics.wikipedia.recentRevisions7d)} detail="Revisions in the last seven days" status={testResult.diagnostics.wikipedia.revisionsStatus} />
                <DiagnosticCard icon={<Newspaper size={14} />} label="GDELT news" value={testResult.diagnostics.news.mentions7d === null ? "—" : testResult.diagnostics.news.mentions7d.toLocaleString()} detail="Global media mentions" status={testResult.diagnostics.news.status} />
                <DiagnosticCard icon={<Search size={14} />} label="Google Search" value={testResult.diagnostics.search.resultsCount === null ? "Unavailable" : testResult.diagnostics.search.resultsCount.toLocaleString()} detail={testResult.diagnostics.search.detail} status={testResult.diagnostics.search.status} />
                <DiagnosticCard icon={<Youtube size={14} />} label="YouTube stats" value={testResult.diagnostics.youtube.subscribers === null ? "Channel or key required" : `${(testResult.diagnostics.youtube.subscribers / 1_000_000).toFixed(1)}M subscribers`} detail={testResult.diagnostics.youtube.views === null ? "Official channel statistics" : `${(testResult.diagnostics.youtube.views / 1_000_000).toFixed(0)}M views`} status={testResult.diagnostics.youtube.status} />
                <div className="rounded-xl bg-white/[.04] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-[#e6f4f1]"><TrendingUp size={14} className="text-[#c99bff]" />Practice trades</span>
                    <span className="text-[10px] font-black uppercase text-[#62e7b6]">Verified</span>
                  </div>
                  <p className="mt-2 text-xl font-black">{testResult.diagnostics.trades.pressure >= 0 ? "+" : ""}{testResult.diagnostics.trades.pressure.toFixed(3)}</p>
                  <p className="mt-0.5 text-[11px] text-[#8ea8a2]">24-hour STKZ order pressure</p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-7 rounded-[28px] border border-[#c99bff]/30 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#ffd17b]">
            <KeyRound size={20} />
            <p className="text-xs font-extrabold uppercase tracking-[.18em]">Data services and credentials</p>
          </div>
          <h2 className="font-display mt-2 text-2xl font-black">Connect external data feeds</h2>
          <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">These values are stored server-side and used by the scheduled market refresh.</p>

          <form onSubmit={saveSettings} className="mt-6 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-[#160c25] p-5">
              <div className="flex items-center gap-2 text-[#ff9ca5]"><Youtube size={18} /><h3 className="font-display text-lg font-black">YouTube Data API</h3></div>
              <label className="mt-4 block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">API key<input type="password" value={youtubeApiKey} onChange={(event) => setYoutubeApiKey(event.target.value)} placeholder="AIzaSy…" className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm text-white outline-none focus:border-[#a97cff]" /></label>
              <label className="mt-4 block text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">Channel mappings JSON<textarea rows={5} value={youtubeChannelsJson} onChange={(event) => setYoutubeChannelsJson(event.target.value)} placeholder={'{\n  "TSWIFT": "UC..."\n}'} className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] p-3 font-mono text-xs text-[#e6d8ff] outline-none focus:border-[#a97cff]" /></label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#160c25] p-5">
              <div className="flex items-center gap-2 text-[#62e7b6]"><Search size={18} /><h3 className="font-display text-lg font-black">Google Custom Search</h3></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">API key<input type="password" value={googleSearchApiKey} onChange={(event) => setGoogleSearchApiKey(event.target.value)} placeholder="AIzaSy…" className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm text-white outline-none focus:border-[#a97cff]" /></label>
                <label className="text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">Search engine ID<input value={googleSearchEngineId} onChange={(event) => setGoogleSearchEngineId(event.target.value)} placeholder="0123456789abcdef:xyz" className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm text-white outline-none focus:border-[#a97cff]" /></label>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#160c25] p-5">
              <div className="flex items-center gap-2 text-[#ffd17b]"><ShieldCheck size={18} /><h3 className="font-display text-lg font-black">Security and admin access</h3></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">Refresh webhook secret<input type="password" value={marketRefreshSecret} onChange={(event) => setMarketRefreshSecret(event.target.value)} placeholder="Webhook secret" className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm text-white outline-none focus:border-[#a97cff]" /></label>
                <label className="text-xs font-bold uppercase tracking-[.12em] text-[#b9a9c5]">Admin emails<input value={adminEmails} onChange={(event) => setAdminEmails(event.target.value)} placeholder="admin@example.com" className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm text-white outline-none focus:border-[#a97cff]" /></label>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={isSavingSettings} className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#8f57f6] disabled:opacity-50">
                <Save size={16} />
                {isSavingSettings ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map(([label, value, detail]) => <article key={label} className="rounded-[22px] border border-white/10 bg-[#211230] p-5"><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#a99ab7]">{label}</p><p className="font-display mt-3 text-2xl font-black">{value}</p><p className="mt-2 text-xs text-[#c4b4d0]">{detail}</p></article>)}
        </section>

        <section className="mt-7 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-[#62e7b6]" /><h2 className="font-display text-2xl font-black">Source health</h2></div>
          <div className="mt-5 space-y-3">
            {data.sources.map((source) => {
              const healthy = source.status === "healthy";
              return <article key={source.source_key} className="flex flex-col gap-3 rounded-2xl bg-white/[.04] p-4 sm:flex-row sm:items-center"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${healthy ? "bg-[#183b33] text-[#62e7b6]" : "bg-[#482332] text-[#ff9ca5]"}`}>{healthy ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</div><div className="min-w-0 flex-1"><p className="font-black">{source.source_key}</p><p className="mt-1 text-xs text-[#b9a9c5]">{source.detail ?? "No source detail recorded."}</p></div><div className="text-xs text-[#b9a9c5] sm:text-right"><p className="font-bold text-[#fff8f2]">{source.status}</p><p className="mt-1">Success: {formatDate(source.last_success_at)}</p></div></article>;
            })}
          </div>
        </section>

        <section className="mt-7 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2"><Clock3 size={18} className="text-[#ffd17b]" /><h2 className="font-display text-2xl font-black">Recent refreshes</h2></div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1.3fr_.7fr_.7fr] gap-3 border-b border-white/10 bg-white/[.04] px-4 py-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#a99ab7] sm:grid-cols-[1.5fr_.8fr_.7fr_.7fr_.7fr]"><span>Started</span><span>Status</span><span className="text-right">Verified</span><span className="hidden text-right sm:block">Unavailable</span><span className="hidden text-right sm:block">Flagged</span></div>
            {data.recentRefreshes.map((refresh) => <div key={refresh.started_at} className="grid grid-cols-[1.3fr_.7fr_.7fr] gap-3 border-b border-white/5 px-4 py-4 text-xs last:border-0 sm:grid-cols-[1.5fr_.8fr_.7fr_.7fr_.7fr]"><span className="text-[#c4b4d0]">{formatDate(refresh.started_at)}</span><span className={refresh.status === "healthy" ? "font-black text-[#62e7b6]" : "font-black text-[#ff9ca5]"}>{refresh.status}</span><span className="text-right font-black">{refresh.verified_count}/{refresh.refreshed_count}</span><span className="hidden text-right text-[#ff9ca5] sm:block">{refresh.unavailable_count}</span><span className="hidden text-right text-[#ffd17b] sm:block">{refresh.flagged_count}</span></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}

function DiagnosticCard({ icon, label, value, detail, status }: { icon: React.ReactNode; label: string; value: string; detail: string; status: "verified" | "unavailable" }) {
  return (
    <div className="rounded-xl bg-white/[.04] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-[#e6f4f1]"><span className={diagnosticStatusClass(status)}>{icon}</span>{label}</span>
        <span className={`text-[10px] font-black uppercase ${diagnosticStatusClass(status)}`}>{status}</span>
      </div>
      <p className="mt-2 text-xl font-black">{value}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-[#8ea8a2]">{detail}</p>
    </div>
  );
}