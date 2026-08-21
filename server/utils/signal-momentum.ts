import {
  getRecentVerifiedSignalObservations,
  type SignalObservation,
} from "./signal-observations";

export type MomentumMode = "level" | "counter-velocity";
export type MomentumStatus = "verified" | "unavailable";

export type StoredMomentumSignal = {
  value: number | null;
  anchorValue: number | null;
  momentumPercent: number | null;
  status: MomentumStatus;
  sampleCount: number;
  capturedAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function observationAgeMs(observation: SignalObservation) {
  const timestamp = new Date(observation.capturedAt).getTime();
  return Number.isFinite(timestamp)
    ? Date.now() - timestamp
    : Number.POSITIVE_INFINITY;
}

function elapsedDays(newer: SignalObservation, older: SignalObservation) {
  const newerTime = new Date(newer.capturedAt).getTime();
  const olderTime = new Date(older.capturedAt).getTime();
  if (!Number.isFinite(newerTime) || !Number.isFinite(olderTime)) return null;
  const elapsed = (newerTime - olderTime) / DAY_MS;
  return elapsed > 0 ? Math.max(1 / 24, elapsed) : null;
}

function clampMomentum(value: number) {
  return Number(Math.max(-250, Math.min(400, value)).toFixed(3));
}

function levelMomentum(observations: SignalObservation[]) {
  const latest = observations[0]?.value;
  const priorValues = observations
    .slice(1, 6)
    .map((observation) => observation.value)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (latest === null || latest === undefined || !priorValues.length) return null;

  const baseline =
    priorValues.reduce((sum, value) => sum + value, 0) / priorValues.length;
  const denominator = Math.max(1, Math.abs(baseline));
  return clampMomentum(((latest - baseline) / denominator) * 100);
}

function counterVelocityMomentum(observations: SignalObservation[]) {
  if (observations.length < 3) return null;

  const latestObservation = observations[0];
  const previousObservation = observations[1];
  const beforePreviousObservation = observations[2];
  const latest = latestObservation?.value;
  const previous = previousObservation?.value;
  const beforePrevious = beforePreviousObservation?.value;
  if (
    !latestObservation ||
    !previousObservation ||
    !beforePreviousObservation ||
    latest === null ||
    latest === undefined ||
    previous === null ||
    previous === undefined ||
    beforePrevious === null ||
    beforePrevious === undefined
  ) {
    return null;
  }

  const currentDays = elapsedDays(latestObservation, previousObservation);
  const previousDays = elapsedDays(
    previousObservation,
    beforePreviousObservation,
  );
  if (currentDays === null || previousDays === null) return null;

  const currentRate = (latest - previous) / currentDays;
  const previousRate = (previous - beforePrevious) / previousDays;
  const noiseFloor = Math.max(1, Math.abs(previous) * 0.0001);
  const denominator = Math.max(Math.abs(previousRate), noiseFloor);

  return clampMomentum(((currentRate - previousRate) / denominator) * 100);
}

function readAnchorValue(observations: SignalObservation[]) {
  const latestAnchor = Number(observations[0]?.metadata?.anchorValue);
  if (Number.isFinite(latestAnchor)) return latestAnchor;

  const fallback = observations[observations.length - 1]?.value;
  return fallback !== null && fallback !== undefined && Number.isFinite(fallback)
    ? fallback
    : null;
}

export async function getStoredMomentumSignal(input: {
  ticker: string;
  provider: string;
  metric: string;
  maxAgeMs: number;
  mode: MomentumMode;
}): Promise<StoredMomentumSignal> {
  const observations = await getRecentVerifiedSignalObservations(
    input.ticker,
    input.provider,
    input.metric,
    6,
  );
  const latest = observations[0];
  const anchorValue = readAnchorValue(observations);

  if (
    !latest ||
    latest.value === null ||
    observationAgeMs(latest) > input.maxAgeMs
  ) {
    return {
      value: null,
      anchorValue,
      momentumPercent: null,
      status: "unavailable",
      sampleCount: observations.length,
      capturedAt: latest?.capturedAt ?? null,
    };
  }

  const momentumPercent =
    input.mode === "counter-velocity"
      ? counterVelocityMomentum(observations)
      : levelMomentum(observations);

  return {
    value: latest.value,
    anchorValue,
    momentumPercent,
    status: "verified",
    sampleCount: observations.length,
    capturedAt: latest.capturedAt,
  };
}

export function combineMomentum(
  values: Array<{ value: number | null; weight?: number }>,
) {
  const available = values.filter(
    (item): item is { value: number; weight?: number } =>
      item.value !== null && Number.isFinite(item.value),
  );
  if (!available.length) return null;

  const weightTotal = available.reduce(
    (total, item) => total + Math.max(0, item.weight ?? 1),
    0,
  );
  if (weightTotal <= 0) return null;

  return Number(
    (
      available.reduce(
        (total, item) =>
          total + item.value * Math.max(0, item.weight ?? 1),
        0,
      ) / weightTotal
    ).toFixed(3),
  );
}
