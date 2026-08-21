import { Buffer } from "node:buffer";

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
  "https://api.dataforseo.com/v3/keywords_data/dataforseo_trends/explore/live";
const MAX_KEYWORDS_PER_REQUEST = 5;
const FORBIDDEN_KEYWORD_CHARACTERS = '<>|"-+=~!:*()[]{}';

function safeKeyword(value: string) {
  return [...value]
    .map((character) =>
      character === "," || FORBIDDEN_KEYWORD_CHARACTERS.includes(character)
        ? " "
        : character,
    )
    .join("")
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

function calculateTrendResult(
  values: number[],
  allocatedCostUsd: number | null,
): SearchTrendResult {
  if (!values.length) {
    return unavailable(
      "DataForSEO responded successfully but returned no usable trend values.",
    );
  }

  const latestInterest = values[values.length - 1] ?? 0;
  const prior = values.slice(Math.max(0, values.length - 15), -1);
  const baselineInterest = prior.length
    ? prior.reduce((sum, value) => sum + value, 0) / prior.length
    : latestInterest;
  const denominator = Math.max(10, baselineInterest);
  const rawMomentum = ((latestInterest - baselineInterest) / denominator) * 100;
  const momentumPercent = Number(
    Math.max(-100, Math.min(300, rawMomentum)).toFixed(2),
  );

  return {
    status: "verified",
    latestInterest,
    baselineInterest: Number(baselineInterest.toFixed(2)),
    momentumPercent,
    points: values.length,
    costUsd: allocatedCostUsd,
    detail:
      "DataForSEO Trends returned a 30-day web-interest series successfully.",
  };
}

export async function fetchSearchTrends(
  celebrityNames: string[],
  login: string,
  password: string,
): Promise<Map<string, SearchTrendResult>> {
  const names = celebrityNames.slice(0, MAX_KEYWORDS_PER_REQUEST);
  const output = new Map<string, SearchTrendResult>();

  if (!login || !password) {
    for (const name of names) {
      output.set(name, unavailable("DataForSEO API login/password are not configured."));
    }
    return output;
  }

  const cleanEntries = names.map((name) => ({ name, keyword: safeKeyword(name) }));
  const validEntries = cleanEntries.filter((entry) => entry.keyword.length >= 2);
  for (const entry of cleanEntries) {
    if (entry.keyword.length < 2) {
      output.set(
        entry.name,
        unavailable("Celebrity name could not be converted into a valid trends keyword."),
      );
    }
  }

  if (!validEntries.length) return output;

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
          keywords: validEntries.map((entry) => entry.keyword),
          time_range: "past_30_days",
          type: "web",
          tag: `celeb-stockz:${validEntries.map((entry) => entry.keyword).join("|")}`.slice(
            0,
            255,
          ),
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
      const safeMessage = message
        .replaceAll(login, "[redacted]")
        .replaceAll(password, "[redacted]");
      for (const entry of validEntries) {
        output.set(entry.name, unavailable(safeMessage));
      }
      return output;
    }

    const results = Array.isArray(task?.result) ? task.result : [];
    const result = asRecord(results[0]);
    const items = Array.isArray(result?.items) ? result.items : [];
    const graph = items
      .map(asRecord)
      .find((item) => item?.type === "dataforseo_trends_graph");
    const data = Array.isArray(graph?.data) ? graph.data : [];
    const taskCost = Number(task?.cost ?? root?.cost);
    const allocatedCost = Number.isFinite(taskCost)
      ? Number((taskCost / validEntries.length).toFixed(8))
      : null;

    validEntries.forEach((entry, keywordIndex) => {
      const values = data
        .map(asRecord)
        .filter((point) => point?.missing_data !== true)
        .map((point) => {
          const rawValues = Array.isArray(point?.values) ? point.values : [];
          return Number(rawValues[keywordIndex]);
        })
        .filter(
          (value) => Number.isFinite(value) && value >= 0 && value <= 100,
        );

      output.set(entry.name, calculateTrendResult(values, allocatedCost));
    });

    return output;
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Connection failed")
      .replaceAll(login, "[redacted]")
      .replaceAll(password, "[redacted]");
    for (const entry of validEntries) {
      output.set(entry.name, unavailable(message));
    }
    return output;
  }
}

export async function fetchSearchTrend(
  celebrityName: string,
  login: string,
  password: string,
): Promise<SearchTrendResult> {
  const results = await fetchSearchTrends(
    [celebrityName],
    login,
    password,
  );
  return (
    results.get(celebrityName) ??
    unavailable("DataForSEO returned no result for the requested celebrity.")
  );
}
