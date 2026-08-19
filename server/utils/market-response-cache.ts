type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let entry: CacheEntry<unknown> | null = null;

export async function getCachedMarketResponse<T>(
  load: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T> {
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }

  const value = await load();
  entry = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  return value;
}

export function clearMarketResponseCache() {
  entry = null;
}