// Internal cache entry holding data and its expiration timestamp
class CacheEntry<T> {
  constructor(public data: T, public expiry: number) {}
}

// In-memory cache with TTL support and in-flight request deduplication
class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, new CacheEntry(data, Date.now() + ttlMs));
  }

  async fetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const inFlight = this.inFlight.get(key);
    if (inFlight) return inFlight as Promise<T>;

    const promise = fetcher().then(data => {
      this.set(key, data, ttlMs);
      this.inFlight.delete(key);
      return data;
    }).catch(err => {
      this.inFlight.delete(key);
      throw err;
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  invalidateAll(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton API cache instance
export const apiCache = new ApiCache();

// Default TTL values (in milliseconds) for different cache categories
export const CACHE_TTL = {
  ROLES: 15 * 60 * 1000,
  SERVICES: 15 * 60 * 1000,
  ORGANIZATIONS: 15 * 60 * 1000,
  USERS: 5 * 60 * 1000,
  DASHBOARD: 2 * 60 * 1000,
};
