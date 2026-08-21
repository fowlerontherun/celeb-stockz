import { sql } from "./db";
import {
  celebrityMarkets,
  calculateMarketPrice,
  type CelebrityMarket,
} from "./markets";
import { getMarketMetadata, isEligibleMarket } from "./market-metadata";
import {
  getAdditionalPriceSignals,
  getAdditionalSignalBoost,
  type AdditionalPriceSignals,
} from "./additional-price-signals";
import {
  getExternalSignalBoost,
  getExternalSourceSignals,
  type ExternalSourceSignals,
} from "./external-source-signals";
import {
  getStoredWikipediaSignals,
  getWikipediaSignalBoost,
  type WikipediaSignals,
} from "./core-public-observations";
import { getLivePriceMap } from "./live-prices";

type SnapshotRow = {
  ticker: string;
  captured_at: string;
  price_stkz: string;
  score: string;
  daily_change: string;
  pageviews: string | null;
  source_measurements: Record<string, unknown>;
  refresh_status: "verified" | "unavailable" | "flagged";
};

const DAILY_MOVE_CAP = 35;
const REVIEW_MOVE_THRESHOLD = 60;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function hasFiniteMetric(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function describePageviewChange(
  current: number | null,
  previous: number | null,
  status: "verified" | "unavailable",
  momentumPercent: number | null,
) {
  if (status === "unavailable" || current === null) {
    return "Stored Wikipedia pageviews were unavailable; other verified signals continued pricing.";
  }

  if (momentumPercent !== null) {
    return `Wikipedia pageview momentum was ${momentumPercent >= 0 ? "up" : "down"} ${Math.abs(momentumPercent).toFixed(1)}% versus its recent observation baseline.`;
  }

  if (previous === null || previous <= 0) {
    return "Wikipedia interest was verified from the latest stored observation.";
  }

  const change = ((current - previous) / previous) * 100;
  return `Wikipedia views ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}%.`;
}

function describeEditActivity(
  recentEdits: number | null,
  momentumPercent: number | null,
) {
  if (recentEdits === null) {
    return "Article activity was unavailable and did not affect the score.";
  }

  if (momentumPercent !== null) {
    return `Wikipedia edit activity momentum was ${momentumPercent >= 0 ? "up" : "down"} ${Math.abs(momentumPercent).toFixed(1)}%.`;
  }

  if (recentEdits === 0) {
    return "No recent article edits added to the score.";
  }

  return `${recentEdits} recent public article edit${recentEdits === 1 ? "" : "s"} supplied stored activity context.`;
}

function describeAdditionalSignals(signals: AdditionalPriceSignals) {
  const active = [
    signals.statuses.news === "verified" && "GDELT news momentum",
    signals.statuses.search === "verified" && "search momentum",
    signals.statuses.youtube === "verified" && "official channel momentum",
  ].filter(Boolean);

  return active.length
    ? `${active.join(", ")} supplied dynamic supplementary context.`
    : "Optional news, search, and official channel signals were unavailable and did not affect the score.";
}

function describeExternalSignals(signals: ExternalSourceSignals) {
  const active = [
    signals.statuses.newsdata === "verified" && "NewsData.io momentum",
    signals.statuses.webz === "verified" && "Webz news momentum",
    signals.statuses.tmdb === "verified" && "TMDB screen momentum",
    signals.statuses.lastfm === "verified" && "Last.fm music momentum",
  ].filter(Boolean);

  return active.length
    ? `${active.join(", ")} supplied additional market momentum.`
    : "Optional entertainment-source signals were unavailable and did not affect the score.";
}

function getVerifiedPublicSignalGroups(
  wikipedia: WikipediaSignals,
  additionalSignals: AdditionalPriceSignals,
  externalSignals: ExternalSourceSignals,
) {
  const groups = new Set<string>();

  if (wikipedia.pageviews.status === "verified") {
    groups.add("wikipedia-pageviews");
  }
  if (wikipedia.revisions.status === "verified") {
    groups.add("wikipedia-revisions");
  }
  if (additionalSignals.statuses.news === "verified") groups.add("gdelt");
  if (additionalSignals.statuses.search === "verified") groups.add("search");
  if (additionalSignals.statuses.youtube === "verified") groups.add("youtube");
  if (externalSignals.statuses.newsdata === "verified") groups.add("newsdata");
  if (externalSignals.statuses.webz === "verified") groups.add("webz");
  if (externalSignals.statuses.tmdb === "verified") groups.add("tmdb");
  if (externalSignals.statuses.lastfm === "verified") groups.add("lastfm");

  return [...groups];
}

function getPreviousVerifiedSignalGroups(previous: SnapshotRow | null) {
  if (!previous) return null;

  const measurements = asRecord(previous.source_measurements);
  if (!measurements) return null;

  const sourceConfidence = asRecord(measurements.sourceConfidence);
  const explicitGroups = sourceConfidence?.verifiedGroups;
  if (Array.isArray(explicitGroups)) {
    return explicitGroups.filter(
      (group): group is string => typeof group === "string" && Boolean(group),
    );
  }

  const groups = new Set<string>();
  const wikipedia = asRecord(measurements.wikipedia);
  if (
    wikipedia &&
    (wikipedia.pageviewsStatus === "verified" ||
      hasFiniteMetric(wikipedia, "dailyPageviews"))
  ) {
    groups.add("wikipedia-pageviews");
  }
  if (
    wikipedia &&
    (wikipedia.editActivityStatus === "verified" ||
      hasFiniteMetric(wikipedia, "recentEdits"))
  ) {
    groups.add("wikipedia-revisions");
  }

  const additional = asRecord(measurements.additionalSignals);
  const additionalStatuses = asRecord(additional?.statuses);
  if (additionalStatuses?.news === "verified") groups.add("gdelt");
  if (additionalStatuses?.search === "verified") groups.add("search");
  if (additionalStatuses?.youtube === "verified") groups.add("youtube");

  const external = asRecord(measurements.externalSignals);
  const externalStatuses = asRecord(external?.statuses);
  for (const provider of ["newsdata", "webz", "tmdb", "lastfm"]) {
    if (externalStatuses?.[provider] === "verified") groups.add(provider);
  }

  return groups.size ? [...groups] : null;
}

function calculateTransparentScore(
  market: CelebrityMarket,
  wikipedia: WikipediaSignals,
  additionalSignals: AdditionalPriceSignals,
  externalSignals: ExternalSourceSignals,
) {
  return Number(
    (
      calculateMarketPrice(market.signals) +
      getWikipediaSignalBoost(wikipedia) +
      getAdditionalSignalBoost(additionalSignals) +
      getExternalSignalBoost(externalSignals)
    ).toFixed(4),
  );
}

async function getLatestVerifiedSnapshot(ticker: string) {
  const rows = await sql<SnapshotRow[]>`
    SELECT ticker, captured_at, price_stkz, score, daily_change, pageviews, source_measurements, refresh_status
    FROM market_snapshots
    WHERE ticker = ${ticker} AND refresh_status = 'verified'
    ORDER BY captured_at DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getLatestVerifiedPrices() {
  const [rows, livePrices] = await Promise.all([
    sql<Pick<SnapshotRow, "ticker" | "price_stkz">[]>`
      SELECT DISTINCT ON (ticker) ticker, price_stkz
      FROM market_snapshots
      WHERE refresh_status = 'verified'
      ORDER BY ticker, captured_at DESC
    `,
    getLivePriceMap(),
  ]);
  const prices = new Map(rows.map((row) => [row.ticker, Number(row.price_stkz)]));
  for (const [ticker, live] of livePrices) prices.set(ticker, live.price);
  return prices;
}

export async function refreshMarketSnapshots() {
  const startedAt = new Date().toISOString();
  const eligibleMarkets = celebrityMarkets.filter(isEligibleMarket);
  let verifiedCount = 0;
  let unavailableCount = 0;
  let flaggedCount = 0;

  for (const market of eligibleMarkets) {
    const metadata = getMarketMetadata(market);
    const [wikipedia, additionalSignals, externalSignals, previous] =
      await Promise.all([
        getStoredWikipediaSignals(market),
        getAdditionalPriceSignals(market),
        getExternalSourceSignals(market),
        getLatestVerifiedSnapshot(market.ticker),
      ]);

    const pageviews = wikipedia.pageviews.value;
    const recentEdits = wikipedia.revisions.value;
    const previousPageviews =
      previous?.pageviews === null || previous?.pageviews === undefined
        ? null
        : Number(previous.pageviews);
    const verifiedGroups = getVerifiedPublicSignalGroups(
      wikipedia,
      additionalSignals,
      externalSignals,
    );
    const previousVerifiedGroups = getPreviousVerifiedSignalGroups(previous);
    const missingPreviouslyVerifiedGroups = previousVerifiedGroups
      ? previousVerifiedGroups.filter((group) => !verifiedGroups.includes(group))
      : [];
    const addedVerifiedGroups = previousVerifiedGroups
      ? verifiedGroups.filter((group) => !previousVerifiedGroups.includes(group))
      : [];
    const confidenceDegraded = missingPreviouslyVerifiedGroups.length > 0;
    const sourceCoverageChanged =
      previousVerifiedGroups !== null &&
      (missingPreviouslyVerifiedGroups.length > 0 || addedVerifiedGroups.length > 0);
    const previousVerifiedCount = previousVerifiedGroups?.length ?? null;

    const wikipediaMeasurement = {
      article: metadata.wikipediaTitle,
      dailyPageviews: pageviews,
      previousDailyPageviews: previousPageviews,
      pageviewsStatus: wikipedia.pageviews.status,
      pageviewAnchor: wikipedia.pageviews.anchorValue,
      pageviewMomentumPercent: wikipedia.pageviews.momentumPercent,
      recentEdits,
      editActivityStatus: wikipedia.revisions.status,
      editAnchor: wikipedia.revisions.anchorValue,
      editMomentumPercent: wikipedia.revisions.momentumPercent,
      storage: "market_signal_observations",
    };

    if (verifiedGroups.length === 0) {
      unavailableCount += 1;
      const fallbackPrice = previous
        ? Number(previous.price_stkz)
        : calculateMarketPrice(market.signals);
      const fallbackScore = previous ? Number(previous.score) : fallbackPrice;

      await sql`
        INSERT INTO market_snapshots (ticker, price_stkz, score, daily_change, pageviews, official_reach, source_measurements, refresh_status)
        VALUES (
          ${market.ticker}, ${fallbackPrice}, ${fallbackScore}, 0, ${pageviews},
          ${market.signals.socialFollowersMillions * 1_000_000},
          ${JSON.stringify({
            wikipedia: wikipediaMeasurement,
            additionalSignals,
            externalSignals,
            sourceConfidence: {
              verifiedGroups,
              verifiedCount: 0,
              previousVerifiedGroups,
              previousVerifiedCount,
              missingPreviouslyVerifiedGroups,
              addedVerifiedGroups,
              degradedFromPrevious: previousVerifiedGroups !== null,
              changedFromPrevious: previousVerifiedGroups !== null,
            },
            fallback: {
              capturedAt: previous?.captured_at ?? null,
              reason:
                "No verified public signal groups were available; retained the last approved price instead of inventing movement.",
            },
          })}::jsonb,
          'unavailable'
        )
      `;
      continue;
    }

    const score = calculateTransparentScore(
      market,
      wikipedia,
      additionalSignals,
      externalSignals,
    );
    const previousPrice = previous ? Number(previous.price_stkz) : score;
    const targetRawMove = previousPrice
      ? ((score - previousPrice) / previousPrice) * 100
      : 0;
    const rawMove = sourceCoverageChanged ? 0 : targetRawMove;
    const coverageReason = sourceCoverageChanged
      ? ` Public-signal coverage changed (${[
          missingPreviouslyVerifiedGroups.length
            ? `missing ${missingPreviouslyVerifiedGroups.join(", ")}`
            : "",
          addedVerifiedGroups.length
            ? `added ${addedVerifiedGroups.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("; ")}); price movement was held for this snapshot so provider availability is not mistaken for celebrity momentum.`
      : "";
    const movementReason = `${describePageviewChange(
      pageviews,
      previousPageviews,
      wikipedia.pageviews.status,
      wikipedia.pageviews.momentumPercent,
    )} ${describeEditActivity(
      recentEdits,
      wikipedia.revisions.momentumPercent,
    )} ${describeAdditionalSignals(additionalSignals)} ${describeExternalSignals(
      externalSignals,
    )}${coverageReason}`;

    if (previous && Math.abs(rawMove) > REVIEW_MOVE_THRESHOLD) {
      flaggedCount += 1;
      await sql`
        INSERT INTO market_snapshots (ticker, price_stkz, score, daily_change, pageviews, official_reach, source_measurements, refresh_status)
        VALUES (
          ${market.ticker}, ${previousPrice}, ${score}, 0, ${pageviews},
          ${market.signals.socialFollowersMillions * 1_000_000},
          ${JSON.stringify({
            wikipedia: wikipediaMeasurement,
            additionalSignals,
            externalSignals,
            sourceConfidence: {
              verifiedGroups,
              verifiedCount: verifiedGroups.length,
              previousVerifiedGroups,
              previousVerifiedCount,
              missingPreviouslyVerifiedGroups,
              addedVerifiedGroups,
              degradedFromPrevious: confidenceDegraded,
              changedFromPrevious: sourceCoverageChanged,
            },
            anomaly: {
              rawMove: Number(rawMove.toFixed(3)),
              targetRawMove: Number(targetRawMove.toFixed(3)),
              reason: "Movement exceeds manual-review threshold",
            },
          })}::jsonb,
          'flagged'
        )
      `;
      continue;
    }

    const dailyChange = Math.max(
      -DAILY_MOVE_CAP,
      Math.min(DAILY_MOVE_CAP, rawMove),
    );
    const price = Number(
      Math.max(1, previousPrice * (1 + dailyChange / 100)).toFixed(2),
    );
    verifiedCount += 1;

    await sql`
      INSERT INTO market_snapshots (ticker, price_stkz, score, daily_change, pageviews, official_reach, source_measurements, refresh_status)
      VALUES (
        ${market.ticker}, ${price}, ${score}, ${dailyChange}, ${pageviews},
        ${market.signals.socialFollowersMillions * 1_000_000},
        ${JSON.stringify({
          wikipedia: wikipediaMeasurement,
          additionalSignals,
          externalSignals,
          sourceConfidence: {
            verifiedGroups,
            verifiedCount: verifiedGroups.length,
            previousVerifiedGroups,
            previousVerifiedCount,
            missingPreviouslyVerifiedGroups,
            addedVerifiedGroups,
            degradedFromPrevious: confidenceDegraded,
            changedFromPrevious: sourceCoverageChanged,
          },
          movementReason,
          priceMovementModel: "stored-observation-snapshot-v3",
          officialPlatformReach: {
            value: market.signals.socialFollowersMillions * 1_000_000,
            status: "modeled-baseline",
          },
        })}::jsonb,
        'verified'
      )
    `;
  }

  const status = unavailableCount || flaggedCount ? "degraded" : "healthy";
  await sql`
    INSERT INTO market_source_health (source_key, status, last_checked_at, last_success_at, detail)
    VALUES ('public-price-signals', ${status}, now(), ${verifiedCount > 0 ? new Date().toISOString() : null}, ${`${verifiedCount} verified, ${unavailableCount} without usable public signals, ${flaggedCount} flagged`})
    ON CONFLICT (source_key) DO UPDATE
    SET status = EXCLUDED.status, last_checked_at = EXCLUDED.last_checked_at, last_success_at = EXCLUDED.last_success_at, detail = EXCLUDED.detail
  `;
  await sql`
    INSERT INTO market_refresh_log (started_at, completed_at, status, refreshed_count, verified_count, unavailable_count, flagged_count, detail)
    VALUES (${startedAt}, now(), ${status}, ${eligibleMarkets.length}, ${verifiedCount}, ${unavailableCount}, ${flaggedCount}, ${"Stored multi-source observation refresh; price calculation performs no third-party network requests."})
  `;

  return {
    refreshed: eligibleMarkets.length,
    verifiedCount,
    unavailableCount,
    flaggedCount,
    refreshedAt: new Date().toISOString(),
  };
}

export async function getSnapshotMarkets() {
  const eligibleMarkets = celebrityMarkets.filter(isEligibleMarket);
  const [rows, livePrices] = await Promise.all([
    sql<SnapshotRow[]>`
      SELECT DISTINCT ON (ticker) ticker, captured_at, price_stkz, score, daily_change, pageviews, source_measurements, refresh_status
      FROM market_snapshots
      WHERE refresh_status = 'verified'
      ORDER BY ticker, captured_at DESC
    `,
    getLivePriceMap(),
  ]);
  const snapshots = new Map(rows.map((row) => [row.ticker, row]));

  return eligibleMarkets.map((market) => {
    const snapshot = snapshots.get(market.ticker);
    const live = livePrices.get(market.ticker);
    const measurements = snapshot?.source_measurements;
    const sourceReason =
      typeof measurements?.movementReason === "string"
        ? measurements.movementReason
        : "Using the current approved public-signal pricing baseline.";
    const movementReason = live
      ? `${sourceReason} Live price ticks incorporate only changes in current practice-trade pressure between external observation refreshes.`
      : sourceReason;

    return {
      ...market,
      price: live?.price ??
        (snapshot ? Number(snapshot.price_stkz) : calculateMarketPrice(market.signals)),
      change: live?.dailyChange ??
        (snapshot ? Number(snapshot.daily_change) : market.change),
      metadata: getMarketMetadata(market),
      snapshot: snapshot
        ? {
            capturedAt: live?.updatedAt ?? snapshot.captured_at,
            sourceCapturedAt: live?.sourceCapturedAt ?? snapshot.captured_at,
            score: Number(snapshot.score),
            pageviews: snapshot.pageviews ? Number(snapshot.pageviews) : null,
            movementReason,
            refreshStatus: "verified" as const,
          }
        : {
            capturedAt: live?.updatedAt ?? null,
            sourceCapturedAt: live?.sourceCapturedAt ?? null,
            score: live?.price ?? calculateMarketPrice(market.signals),
            pageviews: null,
            movementReason:
              "Waiting for the first approved public-signal snapshot.",
            refreshStatus: "fallback" as const,
          },
    };
  });
}

export async function getRecentSnapshotHistory(ticker: string) {
  const rows = await sql<SnapshotRow[]>`
    SELECT ticker, captured_at, price_stkz, score, daily_change, pageviews, source_measurements, refresh_status
    FROM market_snapshots
    WHERE ticker = ${ticker} AND refresh_status = 'verified'
    ORDER BY captured_at DESC
    LIMIT 20
  `;

  return rows.reverse().map((row) => ({
    capturedAt: row.captured_at,
    price: Number(row.price_stkz),
    change: Number(row.daily_change),
    pageviews: row.pageviews ? Number(row.pageviews) : null,
  }));
}