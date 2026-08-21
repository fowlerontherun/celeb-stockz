import {
  getOldestVerifiedSignalObservation,
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

function observationAgeMs(observation: SignalObservation) {
  const timestamp = new Date(observation.capturedAt).getTime();
  return Number.isFinite(timestamp)
    ? Date.now() - timestamp
    : Number.POSITIVE_INFINITY;
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

  const latest = observations[0]?.value;
  const previous = observations[1]?.value;
  const beforePrevious = observations[2]?.value;
  if (
    latest === null ||
    latest === undefined ||
    previous === null ||
    previous === undefined ||
    beforePrevious === null ||
    beforePrevious === undefined
  ) {
    return null;
  }

  const currentDelta = latest - previous;
  const previousDelta = previous - beforePrevious;
  const noiseFloor = Math.max(1, Math.abs(previous) * 0.0001);
  const denominator = Math.max(Math.abs(previousDelta), noiseFloor);

  return clampMomentum(
    ((currentDelta - previousDelta) / denominator) * 100,
  );
}

export async function getStoredMomentumSignal(input: {
  ticker: string;
  provider: string;
  metric: string;
  maxAgeMs: number;
  mode: MomentumMode;
}): Promise<StoredMomentumSignal> {
  const [observations, oldest] = await Promise.all([
    getRecentVerifiedSignalObservations(
      input.ticker,
      input.provider,
      input.metric,
      6,
    ),
    getOldestVerifiedSignalObservation(
      input.ticker,
      input.provider,
      input.metric,
    ),
  ]);
  const latest = observations[0];
  const anchorValue =
    oldest?.value !== null && oldest?.value !== undefined
      ? oldest.value
      : latest?.value ?? null;

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
