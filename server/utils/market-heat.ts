import type { AdditionalPriceSignals } from "./additional-price-signals";
import type { ExternalSourceSignals } from "./external-source-signals";
import type { WikipediaSignals } from "./core-public-observations";

export type MarketHeatState = "normal" | "hot" | "viral";

export type MarketHeat = {
  score: number;
  state: MarketHeatState;
  volatilityMultiplier: number;
  tradePressureMultiplier: number;
  activeSignalCount: number;
  spikingSignalCount: number;
  reason: string;
};

type HeatInput = {
  wikipedia: WikipediaSignals;
  additionalSignals: AdditionalPriceSignals;
  externalSignals: ExternalSourceSignals;
};

type HeatSignal = {
  label: string;
  momentumPercent: number | null;
  weight: number;
  scale: number;
};

const stateConfig: Record<
  MarketHeatState,
  { volatilityMultiplier: number; tradePressureMultiplier: number }
> = {
  normal: { volatilityMultiplier: 1, tradePressureMultiplier: 1 },
  hot: { volatilityMultiplier: 1.8, tradePressureMultiplier: 1.35 },
  viral: { volatilityMultiplier: 2.6, tradePressureMultiplier: 1.75 },
};

function positiveMomentumScore(value: number, scale: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(100, (1 - Math.exp(-value / scale)) * 100);
}

function validMomentum(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function scoreSignals(signals: HeatSignal[]): MarketHeat {
  const active = signals.filter((signal) => signal.momentumPercent !== null);
  const totalWeight = active.reduce((total, signal) => total + signal.weight, 0);
  const weightedScore = totalWeight
    ? active.reduce(
        (total, signal) =>
          total +
          positiveMomentumScore(signal.momentumPercent ?? 0, signal.scale) *
            signal.weight,
        0,
      ) / totalWeight
    : 0;
  const score = Number(Math.max(0, Math.min(100, weightedScore)).toFixed(1));
  const spiking = active
    .filter((signal) => (signal.momentumPercent ?? 0) >= signal.scale * 0.7)
    .sort(
      (first, second) =>
        (second.momentumPercent ?? 0) - (first.momentumPercent ?? 0),
    );

  const state: MarketHeatState =
    score >= 72 && spiking.length >= 2
      ? "viral"
      : score >= 45
        ? "hot"
        : "normal";
  const config = stateConfig[state];
  const leadingSignals = [...active]
    .filter((signal) => (signal.momentumPercent ?? 0) > 0)
    .sort(
      (first, second) =>
        (second.momentumPercent ?? 0) - (first.momentumPercent ?? 0),
    )
    .slice(0, 2);
  const reason =
    state === "normal"
      ? "Real-world attention is within its normal range."
      : `${state === "viral" ? "Multiple real-world signals are surging" : "Real-world attention is elevated"}${
          leadingSignals.length
            ? `: ${leadingSignals
                .map(
                  (signal) =>
                    `${signal.label} +${Math.round(signal.momentumPercent ?? 0)}%`,
                )
                .join(", ")}`
            : ""
        }.`;

  return {
    score,
    state,
    volatilityMultiplier: config.volatilityMultiplier,
    tradePressureMultiplier: config.tradePressureMultiplier,
    activeSignalCount: active.length,
    spikingSignalCount: spiking.length,
    reason,
  };
}

export function getHeatVolatilityMultiplier(state: MarketHeatState) {
  return stateConfig[state].volatilityMultiplier;
}

export function getHeatTradePressureMultiplier(state: MarketHeatState) {
  return stateConfig[state].tradePressureMultiplier;
}

export function normalizeHeatState(value: unknown): MarketHeatState {
  return value === "hot" || value === "viral" ? value : "normal";
}

export function calculateMarketHeat({
  wikipedia,
  additionalSignals,
  externalSignals,
}: HeatInput): MarketHeat {
  return scoreSignals([
    {
      label: "search",
      momentumPercent: validMomentum(additionalSignals.searchMomentumPercent),
      weight: 0.22,
      scale: 45,
    },
    {
      label: "GDELT news",
      momentumPercent: validMomentum(additionalSignals.newsMomentumPercent),
      weight: 0.18,
      scale: 70,
    },
    {
      label: "YouTube",
      momentumPercent: validMomentum(additionalSignals.youtubeMomentumPercent),
      weight: 0.16,
      scale: 22,
    },
    {
      label: "Wikipedia views",
      momentumPercent: validMomentum(wikipedia.pageviews.momentumPercent),
      weight: 0.14,
      scale: 35,
    },
    {
      label: "NewsData",
      momentumPercent: validMomentum(externalSignals.newsdataMomentumPercent),
      weight: 0.08,
      scale: 70,
    },
    {
      label: "Webz",
      momentumPercent: validMomentum(externalSignals.webzMomentumPercent),
      weight: 0.06,
      scale: 70,
    },
    {
      label: "TMDB",
      momentumPercent: validMomentum(externalSignals.tmdbMomentumPercent),
      weight: 0.05,
      scale: 35,
    },
    {
      label: "Last.fm",
      momentumPercent: validMomentum(externalSignals.lastfmMomentumPercent),
      weight: 0.06,
      scale: 20,
    },
    {
      label: "Wikipedia edits",
      momentumPercent: validMomentum(wikipedia.revisions.momentumPercent),
      weight: 0.05,
      scale: 90,
    },
  ]);
}

export function calculateMarketHeatFromMeasurements(
  measurements: Record<string, unknown> | null | undefined,
): MarketHeat {
  const wikipedia = asRecord(measurements?.wikipedia);
  const additional = asRecord(measurements?.additionalSignals);
  const external = asRecord(measurements?.externalSignals);

  return scoreSignals([
    {
      label: "search",
      momentumPercent: validMomentum(additional?.searchMomentumPercent),
      weight: 0.22,
      scale: 45,
    },
    {
      label: "GDELT news",
      momentumPercent: validMomentum(additional?.newsMomentumPercent),
      weight: 0.18,
      scale: 70,
    },
    {
      label: "YouTube",
      momentumPercent: validMomentum(additional?.youtubeMomentumPercent),
      weight: 0.16,
      scale: 22,
    },
    {
      label: "Wikipedia views",
      momentumPercent: validMomentum(wikipedia?.pageviewMomentumPercent),
      weight: 0.14,
      scale: 35,
    },
    {
      label: "NewsData",
      momentumPercent: validMomentum(external?.newsdataMomentumPercent),
      weight: 0.08,
      scale: 70,
    },
    {
      label: "Webz",
      momentumPercent: validMomentum(external?.webzMomentumPercent),
      weight: 0.06,
      scale: 70,
    },
    {
      label: "TMDB",
      momentumPercent: validMomentum(external?.tmdbMomentumPercent),
      weight: 0.05,
      scale: 35,
    },
    {
      label: "Last.fm",
      momentumPercent: validMomentum(external?.lastfmMomentumPercent),
      weight: 0.06,
      scale: 20,
    },
    {
      label: "Wikipedia edits",
      momentumPercent: validMomentum(wikipedia?.editMomentumPercent),
      weight: 0.05,
      scale: 90,
    },
  ]);
}
