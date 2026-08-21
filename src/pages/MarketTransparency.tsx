import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { MarketDetailPanel } from "@/components/MarketDetailPanel";
import { showError, showSuccess } from "@/utils/toast";

type Market = {
  name: string;
  ticker: string;
  price: number;
  signals: {
    socialFollowersMillions: number;
    hashtagViewsBillions: number;
    trendScore: number;
    monthlySearchesMillions: number;
    newsStories: number;
  };
  snapshot?: {
    capturedAt: string | null;
    refreshStatus: "verified" | "fallback";
    movementReason: string;
  };
};

type RequestType =
  | "profile-correction"
  | "source-correction"
  | "eligibility-review"
  | "removal-request";

const sources = [
  {
    name: "NewsData.io Real-Time News (/latest)",
    coverage: "Global real-time news articles, coverage volume, and publisher reach across entertainment and sports.",
    delay: "Live API querying, cached per day during the scheduled STKZ refresh.",
    limitation: "News frequency measures spotlight and cultural presence, not personal quality or character.",
    href: "https://newsdata.io/docs",
    status: "Live",
  },
  {
    name: "Wikimedia pageviews",
    coverage:
      "Eligible celebrity biography pages with available daily pageview reporting.",
    delay: "Daily source data, captured during the scheduled STKZ refresh.",
    limitation:
      "Interest alone does not measure sentiment or personal value. Missing data never creates a new trade price.",
    href: "https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews",
    status: "Live",
  },
  {
    name: "Wikimedia article activity",
    coverage:
      "Recent public revision activity on eligible biography pages, limited to the latest seven days.",
    delay: "Captured during the scheduled STKZ refresh.",
    limitation:
      "Activity has a small capped influence and is not treated as positive sentiment, popularity, or a measure of personal value.",
    href: "https://www.mediawiki.org/wiki/API:Revisions",
    status: "Live",
  },
  {
    name: "GDELT 2.0 Global News",
    coverage: "Worldwide media broadcast, web, and publication volume indexing.",
    delay: "Captured during the scheduled STKZ refresh.",
    limitation: "Aggregated open dataset measuring broadcast volume.",
    href: "https://www.gdeltproject.org/",
    status: "Live",
  },
  {
    name: "The Movie Database (TMDB)",
    coverage: "Actor and director popularity metrics for Film and TV category markets.",
    delay: "Updated during daily market cycle.",
    limitation: "Only applied to screen categories.",
    href: "https://www.themoviedb.org/documentation/api",
    status: "Live",
  },
  {
    name: "Last.fm Music Reach",
    coverage: "Global listener counts and scrobble momentum for recording artists.",
    delay: "Updated during daily market cycle.",
    limitation: "Only applied to Music category.",
    href: "https://www.last.fm/api",
    status: "Live",
  },
  {
    name: "TheSportsDB",
    coverage: "Professional athlete team validations and player verification.",
    delay: "Updated during daily market cycle.",
    limitation: "Only applied to Sport category.",
    href: "https://www.thesportsdb.com/api.php",
    status: "Live",
  },
];

const requestLabels: Record<RequestType, string> = {
  "profile-correction": "Profile detail correction",
  "source-correction": "Source or mapping correction",
  "eligibility-review": "Eligibility or safety review",
  "removal-request": "Removal or retirement request",
};

export default function MarketTransparency() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedTicker, setSelectedTicker] = useState("");
  const [requestType, setRequestType] =
    useState<RequestType>("profile-correction");
  const [requestDetail, setRequestDetail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetch("/api/markets", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load market data.");
        return response.json() as Promise<{ markets: Market[] }>;
      })
      .then((data) => {
        setMarkets(data.markets);
        setSelectedTicker(data.markets[0]?.ticker ?? "");
      })
      .catch((error: Error) => showError(error.message));
  }, []);

  const selected = markets.find((market) => market.ticker === selectedTicker);

  const submitCorrection = async () => {
    if (requestDetail.trim().length < 10) {
      showError("Please add at least 10 characters so the review is actionable.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market-corrections", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ticker: selectedTicker,
          requestType,
          detail: requestDetail,
        }),
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not submit your request.");
      }

      setRequestDetail("");
      showSuccess("Your market review request has been submitted.");
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : "Could not submit your review request.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!selected) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#c99bff] hover:text-white"
        >
          <ArrowLeft size={16} /> Back to markets
        </Link>
        <p className="mt-8 text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
          Open methodology
        </p>
        <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
          Market data, explained.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#c4b4d0]">
          STKZ is an entertainment-only practice score, not an investment,
          security, or investment recommendation.
        </p>

        <label className="mt-7 block text-xs font-extrabold uppercase tracking-[.14em] text-[#b9a9c5]">
          Select a market
          <select
            value={selectedTicker}
            onChange={(event) => setSelectedTicker(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#211230] px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#a97cff]"
          >
            {markets.map((market) => (
              <option key={market.ticker} value={market.ticker}>
                {market.name} · {market.ticker}
              </option>
            ))}
          </select>
        </label>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <p className="font-display text-2xl font-black">{selected.name}</p>
          <p className="mt-1 text-sm text-[#b9a9c5]">
            ${selected.ticker} · {selected.price.toFixed(2)} STKZ
          </p>
          <MarketDetailPanel market={selected} />
        </section>

        <section className="mt-6 rounded-[28px] border border-[#c99bff]/25 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#c99bff]">
            <ShieldCheck size={19} />
            <p className="text-xs font-extrabold uppercase tracking-[.18em]">
              Editorial policy
            </p>
          </div>
          <h2 className="font-display mt-3 text-2xl font-black">
            How a market stays eligible
          </h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[#cdbed7] sm:grid-cols-2">
            <p className="rounded-2xl bg-white/[.04] p-4">
              Markets represent living public figures with clear public
              relevance, an identifiable biography source, and a reviewed
              category mapping.
            </p>
            <p className="rounded-2xl bg-white/[.04] p-4">
              We periodically review eligibility, safety, duplicate profiles,
              signal coverage, and source quality. Ineligible markets are
              paused for new practice trades while historical activity remains
              traceable.
            </p>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#a99ab7]">
            Addition, pause, retirement, and source-review decisions are
            retained in the internal market review record. Modeled prices never
            represent a person's financial value.
          </p>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <div className="flex items-center gap-2 text-[#ff9ca5]">
            <ClipboardCheck size={19} />
            <p className="text-xs font-extrabold uppercase tracking-[.18em]">
              Corrections and removals
            </p>
          </div>
          <h2 className="font-display mt-3 text-2xl font-black">
            Request a market review
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">
            Flag an inaccurate profile, incorrect source mapping, eligibility
            concern, or removal request. Each submission is retained for
            editorial review.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-[.13em] text-[#b9a9c5]">
              Review type
              <select
                value={requestType}
                onChange={(event) =>
                  setRequestType(event.target.value as RequestType)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#160c25] px-3 py-3 text-sm font-bold normal-case tracking-normal text-white outline-none focus:border-[#a97cff]"
              >
                {Object.entries(requestLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-xl bg-white/[.04] p-3 text-xs leading-5 text-[#c4b4d0]">
              This request applies to <b className="text-white">{selected.name}</b>
              <br />
              <span className="text-[#c99bff]">${selected.ticker}</span>
            </div>
          </div>
          <textarea
            value={requestDetail}
            maxLength={1500}
            onChange={(event) => setRequestDetail(event.target.value)}
            placeholder="Describe what needs attention and include a public source when useful."
            className="mt-4 min-h-28 w-full rounded-xl border border-white/10 bg-[#160c25] px-4 py-3 text-sm text-white outline-none placeholder:text-[#82738e] focus:border-[#a97cff]"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] font-bold text-[#9f90ac]">
              {requestDetail.length}/1500 characters
            </p>
            <button
              type="button"
              disabled={isSubmitting || requestDetail.trim().length < 10}
              onClick={() => void submitCorrection()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#ff7282] px-4 py-3 text-sm font-black text-[#401b2d] transition hover:bg-[#ff8e9a] disabled:opacity-50"
            >
              <Send size={15} />
              {isSubmitting ? "Submitting…" : "Submit review"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#211230] p-5 sm:p-7">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
            Source register
          </p>
          <h2 className="font-display mt-2 text-2xl font-black">
            What informs STKZ prices
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">
            Every source is documented before it can affect a practice-market
            price. Inputs are normalized so one platform cannot dominate
            movement.
          </p>
          <div className="mt-5 space-y-3">
            {sources.map((source) => (
              <article
                key={source.name}
                className="rounded-2xl bg-white/[.04] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold">{source.name}</h3>
                  <span
                    className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                      source.status === "Live"
                        ? "bg-[#183b33] text-[#62e7b6]"
                        : "bg-[#ffd17b]/15 text-[#ffd17b]"
                    }`}
                  >
                    {source.status}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-xs leading-5">
                  <div>
                    <dt className="font-black text-[#c99bff]">Coverage</dt>
                    <dd className="text-[#c4b4d0]">{source.coverage}</dd>
                  </div>
                  <div>
                    <dt className="font-black text-[#c99bff]">Delay</dt>
                    <dd className="text-[#c4b4d0]">{source.delay}</dd>
                  </div>
                  <div>
                    <dt className="font-black text-[#c99bff]">
                      Limitations
                    </dt>
                    <dd className="text-[#c4b4d0]">{source.limitation}</dd>
                  </div>
                </dl>
                {source.href && (
                  <a
                    href={source.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#c99bff] hover:text-white"
                  >
                    Review source documentation <ExternalLink size={12} />
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}