export type SearchTrendStatus = "verified" | "unavailable";

export type SearchTrendResult = {
  status: SearchTrendStatus;
  latestInterest: number | null;
  baselineInterest: number | null;
  momentumPercent: number | null;
  points: number;
  costUsd: number | null;
  detail: string;
};

const ENDPOINT =
  "https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live";

function safeKeyword(value: string) {
  return value
    .replace(/[<>|"\-+=~!:*()[\]{}]/g, " ")
    .replaceAll(",", " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function unavailable(detail: string): SearchTrendResult {
  return {
    status: "unavailable",
    latestInterest: null,
    baselineInterest: null,
    momentumPercent: null,
    points: 0,
    costUsd: null,
    detail,
  };
}

function basicAuthorization(login: string, password: string) {
  return `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export async function fetchSearchTrend(
  celebrityName: string,
  login: string,
  password: string,
): Promise<SearchTrendResult> {
  const cleanName = safeKeyword(celebrityName);
  if (!login || !password) {
    return unavailable("DataForSEO API login/password are not configured.");
  }
  if (cleanName.length < 2) {
    return unavailable("Celebrity name could not be converted into a valid trends keyword.");
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: basicAuthorization(login, password),
        "content-type": "application/json",
      },
      body: JSON.stringify([
        {
          keywords: [cleanName],
          time_range: "past_30_days",
          type: "web",
          item_types: ["google_trends_graph"],
          tag: `celeb-stockz:${cleanName}`,
        },
      ]),
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    const root = asRecord(payload);
    const rootStatus = Number(root?.status_code);
    const tasks = Array.isArray(root?.tasks) ? root.tasks : [];
    const task = asRecord(tasks[0]);
    const taskStatus = Number(task?.status_code);

    if (!response.ok || rootStatus !== 20000 || taskStatus !== 20000) {
      const message =
        (typeof task?.status_message === "string" && task.status_message) ||
        (typeof root?.status_message === "string" && root.status_message) ||
        `DataForSEO returned HTTP ${response.status}.`;
      return unavailable(message.replaceAll(login, "[redacted]").replaceAll(password, "[redacted]"));
    }

    const results = Array.isArray(task?.result) ? task.result : [];
    const result = asRecord(results[0]);
    const items = Array.isArray(result?.items) ? result.items : [];
    const graph = items
      .map(asRecord)
      .find((item) => item?.type === "google_trends_graph");
    const data = Array.isArray(graph?.data) ? graph.data : [];
    const values = data
      .map(asRecord)
      .filter((point) => point?.missing_data !== true)
      .map((point) => {
        const rawValues = Array.isArray(point?.values) ? point.values : [];
        return Number(rawValues[0]);
      })
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);

    if (!values.length) {
      return unavailable("DataForSEO responded successfully but returned no usable Google Trends graph values.");
    }

    const latestInterest = values.at(-1) ?? 0;
    const prior = values.slice(Math.max(0, values.length - 15), -1);
    const baselineInterest = prior.length
      ? prior.reduce((sum, value) => sum + value, 0) / prior.length
      : latestInterest;
    const denominator = Math.max(10, baselineInterest);
    const rawMomentum = ((latestInterest - baselineInterest) / denominator) * 100;
    const momentumPercent = Number(
      Math.max(-100, Math.min(300, rawMomentum)).toFixed(2),
    );
    const cost = Number(task?.cost ?? root?.cost);

    return {
      status: "verified",
      latestInterest,
      baselineInterest: Number(baselineInterest.toFixed(2)),
      momentumPercent,
      points: values.length,
      costUsd: Number.isFinite(cost) ? cost : null,
      detail: "DataForSEO Google Trends returned a 30-day interest series successfully.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    return unavailable(
      message.replaceAll(login, "[redacted]").replaceAll(password, "[redacted]"),
    );
  }
}
