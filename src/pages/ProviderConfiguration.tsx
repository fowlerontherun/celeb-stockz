import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Globe,
  KeyRound,
  LoaderCircle,
  Play,
  Save,
  ShieldAlert,
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

type ProviderStatus = {
  webz: boolean;
  tmdb: boolean;
  lastfm: boolean;
  sportsdb: boolean;
  gdelt: boolean;
  wikipedia: boolean;
  youtube: boolean;
  googleSearch: boolean;
};

type ProviderKey = "webz" | "tmdb" | "lastfm" | "sportsdb";

const providers: Array<{
  key: ProviderKey;
  label: string;
  authType: string;
  description: string;
  placeholder: string;
  inputName: "webzApiKey" | "tmdbApiKey" | "lastfmApiKey" | "sportsdbApiKey";
  color: string;
}> = [
  {
    key: "webz",
    label: "Webz.io",
    authType: "API Token",
    description: "Global news sentiment and mentions for entertainment figures.",
    placeholder: "Webz.io API token",
    inputName: "webzApiKey",
    color: "text-[#ff9ca5]",
  },
  {
    key: "tmdb",
    label: "The Movie Database (TMDB)",
    authType: "API Key (v3)",
    description: "Actor, director, and television popularity indices.",
    placeholder: "TMDB API key",
    inputName: "tmdbApiKey",
    color: "text-[#72c8ff]",
  },
  {
    key: "lastfm",
    label: "Last.fm",
    authType: "API Key",
    description: "Artist listening counts, global reach, and scrobble momentum.",
    placeholder: "Last.fm API key",
    inputName: "lastfmApiKey",
    color: "text-[#62e7b6]",
  },
  {
    key: "sportsdb",
    label: "TheSportsDB",
    authType: "API Key / Tier Token",
    description: "Athlete recognition, team affiliations, and career validation.",
    placeholder: "TheSportsDB API key (e.g. 3 or premium key)",
    inputName: "sportsdbApiKey",
    color: "text-[#ffd17b]",
  },
];

export default function ProviderConfiguration() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [keys, setKeys] = useState({
    webzApiKey: "",
    tmdbApiKey: "",
    lastfmApiKey: "",
    sportsdbApiKey: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/internal/provider-settings", {
      credentials: "include",
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          providers?: ProviderStatus;
          statusMessage?: string;
        };

        if (!response.ok || !data.providers) {
          throw new Error(
            data.statusMessage ?? "Could not load provider configuration.",
          );
        }

        setStatus(data.providers);
      })
      .catch((error: Error) => showError(error.message))
      .finally(() => setIsLoading(false));
  }, []);

  const save = async () => {
    if (!Object.values(keys).some(Boolean)) {
      showError("Enter at least one provider key to save.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/internal/provider-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(keys),
      });
      const data = (await response.json()) as { statusMessage?: string };

      if (!response.ok) {
        throw new Error(data.statusMessage ?? "Could not save provider keys.");
      }

      setKeys({
        webzApiKey: "",
        tmdbApiKey: "",
        lastfmApiKey: "",
        sportsdbApiKey: "",
      });
      setStatus((current) =>
        current
          ? {
              ...current,
              webz: current.webz || Boolean(keys.webzApiKey),
              tmdb: current.tmdb || Boolean(keys.tmdbApiKey),
              lastfm: current.lastfm || Boolean(keys.lastfmApiKey),
              sportsdb: current.sportsdb || Boolean(keys.sportsdbApiKey),
            }
          : current,
      );
      showSuccess("Provider configuration saved securely.");
    } catch (error) {
      showError(
        error instanceof Error ? error.message : "Could not save provider keys.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const testProvider = async (providerName: string) => {
    setTestingProvider(providerName);
    try {
      const response = await fetch("/api/internal/provider-test", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: providerName }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; statusMessage?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.message || data.statusMessage || "Test request failed.");
      }
      showSuccess(`${providerName.toUpperCase()} test: ${data.message}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Provider connection test failed.");
    } finally {
      setTestingProvider(null);
    }
  };

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#120b20] text-[#c99bff]">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#120b20] px-5 py-8 text-[#fff8f2] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/operations"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#c99bff] transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to operations
        </Link>

        <header className="mt-8 rounded-[30px] border border-[#c99bff]/30 bg-[#211230] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#7c3aed] text-white">
              <Database size={23} />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#c99bff]">
                Restricted configuration
              </p>
              <h1 className="font-display mt-2 text-3xl font-black sm:text-4xl">
                External data providers & API keys
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#c4b4d0]">
                All third-party data feeds, API credentials, and open datasets that contribute to the fame-signal calculation model.
              </p>
            </div>
          </div>
        </header>

        {/* Free / Open datasets section */}
        <section className="mt-6 rounded-[26px] border border-[#62e7b6]/30 bg-[#162925] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[#62e7b6]">
            <Globe size={18} />
            <h2 className="font-display text-xl font-black">Built-in open datasets (No API keys required)</h2>
          </div>
          <p className="mt-2 text-sm text-[#c5ded8]">
            These primary signal providers run out of the box with zero external subscription costs or keys.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#62e7b6]">Wikimedia Foundation REST API</span>
                <span className="rounded-lg bg-[#183b33] px-2 py-1 text-[10px] font-black text-[#62e7b6]">LIVE</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#b9ded5]">
                Provides daily pageviews & 7-day revision tracking. Authenticates using a policy-compliant User-Agent header.
              </p>
              <button
                type="button"
                disabled={testingProvider === "wikipedia"}
                onClick={() => void testProvider("wikipedia")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                {testingProvider === "wikipedia" ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={13} />}
                Test connection
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#62e7b6]">GDELT 2.0 Global News API</span>
                <span className="rounded-lg bg-[#183b33] px-2 py-1 text-[10px] font-black text-[#62e7b6]">LIVE</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#b9ded5]">
                Aggregates worldwide broadcast, print, and web news volume for celebrity names with zero API key requirement.
              </p>
              <button
                type="button"
                disabled={testingProvider === "gdelt"}
                onClick={() => void testProvider("gdelt")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                {testingProvider === "gdelt" ? <LoaderCircle size={13} className="animate-spin" /> : <Play size={13} />}
                Test connection
              </button>
            </div>
          </div>
        </section>

        {/* Entertainment Source Key Configurations */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => {
            const configured = status?.[provider.key] ?? false;

            return (
              <article
                key={provider.key}
                className="rounded-[26px] border border-white/10 bg-[#211230] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`font-display text-xl font-black ${provider.color}`}>
                      {provider.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#a99ab7]">
                      Auth: {provider.authType}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#c4b4d0]">
                      {provider.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black ${
                      configured
                        ? "bg-[#183b33] text-[#62e7b6]"
                        : "bg-white/[.06] text-[#a99ab7]"
                    }`}
                  >
                    {configured && <CheckCircle2 size={12} />}
                    {configured ? "CONNECTED" : "OPTIONAL"}
                  </span>
                </div>

                <label className="mt-5 block text-xs font-bold uppercase tracking-[.13em] text-[#b9a9c5]">
                  Update credentials
                  <div className="relative mt-2">
                    <KeyRound
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#c99bff]"
                    />
                    <input
                      type="password"
                      autoComplete="off"
                      value={keys[provider.inputName]}
                      onChange={(event) =>
                        setKeys((current) => ({
                          ...current,
                          [provider.inputName]: event.target.value,
                        }))
                      }
                      placeholder={
                        configured
                          ? "Saved securely — enter only to replace"
                          : provider.placeholder
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#160c25] py-3 pl-10 pr-3 text-sm font-semibold text-white outline-none placeholder:text-[#82738e] focus:border-[#a97cff]"
                    />
                  </div>
                </label>

                {configured && (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      disabled={testingProvider === provider.key}
                      onClick={() => void testProvider(provider.key)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#c99bff] hover:bg-white/10"
                    >
                      {testingProvider === provider.key ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : (
                        <Play size={13} />
                      )}
                      Test saved key
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-[26px] border border-[#ffd17b]/25 bg-[#2a1b32] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[#ffd17b]">
            <ShieldAlert size={18} />
            <p className="text-xs font-extrabold uppercase tracking-[.16em]">
              Security & Storage
            </p>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d8c9d8]">
            All provider API keys and tokens are stored in the server PostgreSQL database and are never delivered to the client browser. Leave a saved field blank to retain the current key.
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isSaving}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-black text-white transition hover:bg-[#9361f5] disabled:opacity-50"
          >
            {isSaving ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? "Saving…" : "Save provider keys"}
          </button>
        </section>
      </div>
    </main>
  );
}