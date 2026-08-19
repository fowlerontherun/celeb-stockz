import { sql } from "./db";
import { celebrityMarkets, type CelebrityMarket } from "./markets";
import { getProviderSettings } from "./provider-settings";

type ProviderName = "webz" | "tmdb" | "lastfm" | "sportsdb";
type SignalStatus = "verified" | "unavailable";

export type ExternalSourceSignals = {
  webzNews: number | null;
  tmdbPopularity: number | null;
  lastfmListeners: number | null;
  sportsdbMatch: boolean | null;
  statuses: Record<ProviderName, SignalStatus>;
};

type CacheRow = { value: string | null; status: SignalStatus };

const DAILY_MARKET_LIMIT = 20;

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function stableHash(value: string) {
  return [...value].reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
    17,
  );
}

function supportsProvider(provider: ProviderName, market: CelebrityMarket) {
  return !(
    (provider === "tmdb" && !["Film", "TV"].includes(market.category)) ||
    (provider === "lastfm" && market.category !== "Music") ||
    (provider === "sportsdb" && market.category !== "Sport")
  );
}

function shouldRequest(provider: ProviderName, market: CelebrityMarket) {
  return celebrityMarkets
    .filter((item) => supportsProvider(provider, item))
    .sort(
      (first, second) =>
        stableHash(`${currentDate()}:${provider}:${first.ticker}`) -
        stableHash(`${currentDate()}:${provider}:${second.ticker}`),
    )
    .slice(0, DAILY_MARKET_LIMIT)
    .some((item) => item.ticker === market.ticker);
}

async function fromCache(provider: ProviderName, ticker: string) {
  const rows = await sql<CacheRow[]>`
    SELECT value, status
    FROM market_external_signal_cache
    WHERE provider = ${provider}
      AND ticker = ${ticker}
      AND captured_on = ${currentDate()}
  `;
  return rows[0] ?? null;
}

async function cache(
  provider: ProviderName,
  ticker: string,
  value: number | null,
  status: SignalStatus,
  detail: string,
) {
  await sql`
    INSERT INTO market_external_signal_cache (
      provider, ticker, captured_on, value, status, detail, updated_at
    )
    VALUES (
      ${provider}, ${ticker}, ${currentDate()}, ${value}, ${status}, ${detail}, now()
    )
    ON CONFLICT (provider, ticker, captured_on) DO UPDATE
    SET value = EXCLUDED.value,
        status = EXCLUDED.status,
        detail = EXCLUDED.detail,
        updated_at = now()
  `;
}

async function loadNumber(
  provider: ProviderName,
  market: CelebrityMarket,
  request: () => Promise<number | null>,
): Promise<{ value: number | null; status: SignalStatus }> {
  const existing = await fromCache(provider, market.ticker);
  if (existing) {
    return {
      value: existing.value === null ? null : Number(existing.value),
      status: existing.status,
    };
  }

  if (!supportsProvider(provider, market) || !shouldRequest(provider, market)) {
    return { value: null, status: "unavailable" };
  }

  try {
    const value = await request();
    const valid = value !== null && Number.isFinite(value) && value >= 0;
    await cache(provider, market.ticker, valid ? value : null, valid ? "verified" : "unavailable", valid ? "Daily provider response cached." : "Provider returned no usable public signal.");
    return { value: valid ? value : null, status: valid ? "verified" : "unavailable" };
  } catch {
    await cache(provider, market.ticker, null, "unavailable", "Provider request was unavailable.");
    return { value: null, status: "unavailable" };
  }
}

async function webzNews(name: string, apiKey: string) {
  if (!apiKey) return null;
  const url = new URL("https://api.webz.io/newsApiLite");
  url.searchParams.set("token", apiKey);
  url.searchParams.set("q", `"${name}"`);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  return Number(((await response.json()) as { totalResults?: number }).totalResults);
}

async function tmdbPopularity(name: string, apiKey: string) {
  if (!apiKey) return null;
  const url = new URL("https://api.themoviedb.org/3/search/person");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", name);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: Array<{ name?: string; popularity?: number }> };
  const match = data.results?.find((item) => item.name?.toLowerCase() === name.toLowerCase());
  return typeof match?.popularity === "number" ? match.popularity : null;
}

async function lastfmListeners(name: string, apiKey: string) {
  if (!apiKey) return null;
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "artist.getinfo");
  url.searchParams.set("artist", name);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  return Number(((await response.json()) as { artist?: { stats?: { listeners?: string } } }).artist?.stats?.listeners);
}

async function sportsdbMatch(name: string, apiKey: string) {
  if (!apiKey) return null;
  const url = new URL(`https://www.thesportsdb.com/api/v1/json/${apiKey}/searchplayers.php`);
  url.searchParams.set("p", name);
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const data = (await response.json()) as { player?: Array<{ strPlayer?: string }> };
  return data.player?.some((player) => player.strPlayer?.toLowerCase() === name.toLowerCase()) ? 1 : null;
}

export async function getExternalSourceSignals(market: CelebrityMarket): Promise<ExternalSourceSignals> {
  const settings = await getProviderSettings();
  const [webz, tmdb, lastfm, sportsdb] = await Promise.all([
    loadNumber("webz", market, () => webzNews(market.name, settings.webzApiKey)),
    loadNumber("tmdb", market, () => tmdbPopularity(market.name, settings.tmdbApiKey)),
    loadNumber("lastfm", market, () => lastfmListeners(market.name, settings.lastfmApiKey)),
    loadNumber("sportsdb", market, () => sportsdbMatch(market.name, settings.sportsdbApiKey)),
  ]);

  return {
    webzNews: webz.value,
    tmdbPopularity: tmdb.value,
    lastfmListeners: lastfm.value,
    sportsdbMatch: sportsdb.value === null ? null : sportsdb.value > 0,
    statuses: { webz: webz.status, tmdb: tmdb.status, lastfm: lastfm.status, sportsdb: sportsdb.status },
  };
}

export function getExternalSignalBoost(signals: ExternalSourceSignals) {
  const news = signals.webzNews === null ? 0 : Math.min(2.5, Math.log10(signals.webzNews + 1) * 0.5);
  const screen = signals.tmdbPopularity === null ? 0 : Math.min(1.5, Math.log10(signals.tmdbPopularity + 1) * 0.45);
  const music = signals.lastfmListeners === null ? 0 : Math.min(1.5, Math.log10(signals.lastfmListeners + 1) * 0.16);
  const sport = signals.sportsdbMatch ? 0.25 : 0;
  return Number((news + screen + music + sport).toFixed(4));
}