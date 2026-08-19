import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LoaderCircle, TriangleAlert, Youtube } from "lucide-react";
import { showError } from "@/utils/toast";

type Result = {
  ticker: string;
  name: string;
  channelMapped: boolean;
  channelId: string | null;
  youtubeConfiguration: {
    apiKeySaved: boolean;
    mappingSaved: boolean;
    channelId: string | null;
  };
  diagnostics: {
    youtube: {
      subscribers: number | null;
      views: number | null;
      status: "verified" | "unavailable";
      detail: string;
    };
  };
};

const celebrities = [
  ["TSWIFT", "Taylor Swift"],
  ["MRBEAST", "MrBeast"],
  ["KSI", "KSI"],
  ["DUALIPA", "Dua Lipa"],
  ["EDSHEERAN", "Ed Sheeran"],
  ["HSTYLES", "Harry Styles"],
] as const;

export default function YoutubeDiagnostics() {
  const [ticker, setTicker] = useState("KSI");
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/internal/market-test-signals", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = (await response.json()) as Result & { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not run the YouTube diagnostic.");
      }

      setResult(data);
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not run the YouTube diagnostic.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isVerified = result?.diagnostics.youtube.status === "verified";

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/operations"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#c99bff] transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to market control center
        </Link>

        <header className="mt-8 rounded-[30px] border border-[#ff9ca5]/25 bg-[#211230] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff7282] text-[#401b2d]">
              <Youtube size={24} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.17em] text-[#ffb2bc]">
                Restricted diagnostics
              </p>
              <h1 className="font-display mt-1 text-3xl font-black">
                YouTube connection check
              </h1>
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-[#cbbbd4]">
            This test confirms what the server can actually read after saving
            your settings. API keys remain hidden.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <select
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#ff7282]"
            >
              {celebrities.map(([value, label]) => (
                <option key={value} value={value}>
                  {label} (${value})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void runDiagnostic()}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff7282] px-5 py-3 text-sm font-black text-[#401b2d] transition hover:bg-[#ff8e9a] disabled:opacity-50"
            >
              {isLoading && <LoaderCircle size={16} className="animate-spin" />}
              {isLoading ? "Testing connection…" : "Run full diagnostic"}
            </button>
          </div>
        </header>

        {result && (
          <section className="mt-6 space-y-5">
            <article
              className={`rounded-[28px] border p-6 ${
                isVerified
                  ? "border-[#62e7b6]/35 bg-[#16332d]"
                  : "border-[#ff7282]/35 bg-[#361a31]"
              }`}
            >
              <div className="flex items-start gap-3">
                {isVerified ? (
                  <CheckCircle2 className="shrink-0 text-[#62e7b6]" size={23} />
                ) : (
                  <TriangleAlert className="shrink-0 text-[#ff9ca5]" size={23} />
                )}
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#c99bff]">
                    Provider result · {result.name}
                  </p>
                  <h2 className="font-display mt-1 text-2xl font-black">
                    {isVerified ? "YouTube statistics received" : "YouTube needs attention"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[#eadbe5]">
                    {result.diagnostics.youtube.detail}
                  </p>
                </div>
              </div>
            </article>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["API key saved", result.youtubeConfiguration.apiKeySaved],
                ["Ticker mapping saved", result.youtubeConfiguration.mappingSaved],
                ["Provider response", isVerified],
              ].map(([label, passed]) => (
                <article
                  key={label as string}
                  className={`rounded-2xl border p-4 ${
                    passed
                      ? "border-[#62e7b6]/25 bg-[#183b33]"
                      : "border-[#ff7282]/25 bg-[#2e1830]"
                  }`}
                >
                  <p className="text-xs font-bold text-[#cdbed7]">{label as string}</p>
                  <p className={`mt-2 font-display text-xl font-black ${passed ? "text-[#62e7b6]" : "text-[#ff9ca5]"}`}>
                    {passed ? "Detected" : "Not ready"}
                  </p>
                </article>
              ))}
            </div>

            <article className="rounded-[28px] border border-white/10 bg-[#211230] p-6">
              <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#c99bff]">
                Exact channel lookup
              </p>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-4">
                  <dt className="font-bold text-[#cbbbd4]">Selected ticker</dt>
                  <dd className="font-mono font-black">{result.ticker}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-4">
                  <dt className="font-bold text-[#cbbbd4]">Saved channel ID</dt>
                  <dd className="max-w-full break-all font-mono font-black text-[#ffd17b]">
                    {result.channelId ?? "No matching saved mapping"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-4">
                  <dt className="font-bold text-[#cbbbd4]">Subscribers</dt>
                  <dd className="font-black">
                    {result.diagnostics.youtube.subscribers?.toLocaleString() ?? "Not returned"}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="font-bold text-[#cbbbd4]">Channel views</dt>
                  <dd className="font-black">
                    {result.diagnostics.youtube.views?.toLocaleString() ?? "Not returned"}
                  </dd>
                </div>
              </dl>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}