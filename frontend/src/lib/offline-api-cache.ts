/**
 * SmartLivestock Offline API Cache
 * 
 * Automatically captures successful GET responses from the Django backend
 * and serves them when the user is offline or reloading without network connectivity.
 */

const CACHE_PREFIX = "smartlivestock_apicache:";
const INDEX_KEY = "smartlivestock_apicache_index";
const MAX_CACHE_ENTRIES = 150;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEnvelope<T = unknown> {
  timestamp: number;
  data: T;
}

/**
 * Normalizes an API URL and its parameters into a deterministic cache key.
 */
export function buildApiCacheKey(
  url: string,
  params?: Record<string, unknown> | URLSearchParams,
  baseURL?: string
): string {
  if (!url) return "";

  let cleanUrl = url;
  if (baseURL && cleanUrl.startsWith(baseURL)) {
    cleanUrl = cleanUrl.slice(baseURL.length);
  }

  // Strip origin, leading/trailing slashes, and redundant api prefixes
  cleanUrl = cleanUrl.replace(/^https?:\/\/[^\/]+/, "");
  cleanUrl = cleanUrl.replace(/^\/+/, "").replace(/\/+$/, "");

  let queryString = "";
  if (params) {
    if (params instanceof URLSearchParams) {
      queryString = params.toString();
    } else if (typeof params === "object") {
      const sortedKeys = Object.keys(params).sort();
      const searchParams = new URLSearchParams();
      for (const k of sortedKeys) {
        const val = params[k];
        if (val !== undefined && val !== null) {
          searchParams.append(k, String(val));
        }
      }
      queryString = searchParams.toString();
    }
  }

  if (cleanUrl.includes("?")) {
    const [pathPart, urlQuery] = cleanUrl.split("?");
    const combined = new URLSearchParams(urlQuery);
    if (queryString) {
      new URLSearchParams(queryString).forEach((v, k) => combined.append(k, v));
    }
    const sorted = Array.from(combined.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const finalParams = new URLSearchParams();
    sorted.forEach(([k, v]) => finalParams.append(k, v));
    const sortedQuery = finalParams.toString();
    return sortedQuery ? `${CACHE_PREFIX}${pathPart}?${sortedQuery}` : `${CACHE_PREFIX}${pathPart}`;
  }

  return queryString ? `${CACHE_PREFIX}${cleanUrl}?${queryString}` : `${CACHE_PREFIX}${cleanUrl}`;
}

/**
 * Checks if a given request should be cached offline.
 */
export function isCacheableApiRequest(url: string, method?: string): boolean {
  if (method && method.toLowerCase() !== "get") return false;
  if (!url) return false;

  const lower = url.toLowerCase();
  // Never cache authentication tokens, login, or password resets
  if (
    lower.includes("/token/") ||
    lower.includes("token/refresh") ||
    lower.includes("token/verify") ||
    lower.includes("/auth/") ||
    lower.includes("login") ||
    lower.includes("password")
  ) {
    return false;
  }

  return true;
}

/**
 * Saves a successful GET API response into localStorage for offline use.
 */
export function saveApiCache(
  url: string,
  params: Record<string, unknown> | URLSearchParams | undefined,
  data: unknown,
  baseURL?: string
): void {
  if (typeof window === "undefined" || !isCacheableApiRequest(url, "get")) return;

  const key = buildApiCacheKey(url, params, baseURL);
  if (!key) return;

  try {
    const envelope: CacheEnvelope = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(envelope));
    trackCacheKey(key);
  } catch (err) {
    // Quota exceeded: prune older entries and try once more
    console.warn("[SmartLivestock Cache] Quota warning, pruning old cache entries...", err);
    pruneOldCacheEntries();
    try {
      const envelope: CacheEnvelope = {
        timestamp: Date.now(),
        data,
      };
      localStorage.setItem(key, JSON.stringify(envelope));
      trackCacheKey(key);
    } catch {
      // Storage completely full, gracefully skip
    }
  }
}

/**
 * Retrieves a cached GET API response when offline.
 */
export function getApiCache<T = unknown>(
  url: string,
  params?: Record<string, unknown> | URLSearchParams,
  baseURL?: string
): T | null {
  if (typeof window === "undefined") return null;

  const key = buildApiCacheKey(url, params, baseURL);
  if (!key) return null;

  // 1. Try exact key match (with query params)
  const exact = readCacheEntry<T>(key);
  if (exact !== null) return exact;

  // 2. Try match without params if exact didn't match
  if (params) {
    const baseKey = buildApiCacheKey(url, undefined, baseURL);
    const baseMatch = readCacheEntry<T>(baseKey);
    if (baseMatch !== null) return baseMatch;
  }

  // 3. Fallback: normalize "api/" prefix variations
  const hasApiPrefix = url.startsWith("api/") || url.startsWith("/api/");
  const alternateUrl = hasApiPrefix
    ? url.replace(/^\/?api\//, "")
    : `api/${url.replace(/^\/+/, "")}`;
  
  const altKey = buildApiCacheKey(alternateUrl, params, baseURL);
  const altMatch = readCacheEntry<T>(altKey);
  if (altMatch !== null) return altMatch;

  return null;
}

function readCacheEntry<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const envelope: CacheEnvelope<T> = JSON.parse(raw);
    if (!envelope || typeof envelope !== "object") return null;

    // Check expiration (7 days)
    if (Date.now() - envelope.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      untrackCacheKey(key);
      return null;
    }

    return envelope.data;
  } catch {
    return null;
  }
}

function trackCacheKey(key: string): void {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const index: string[] = raw ? JSON.parse(raw) : [];
    if (!index.includes(key)) {
      index.push(key);
      if (index.length > MAX_CACHE_ENTRIES) {
        const removed = index.shift();
        if (removed) localStorage.removeItem(removed);
      }
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  } catch {
    // Ignore index tracking errors
  }
}

function untrackCacheKey(key: string): void {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return;
    const index: string[] = JSON.parse(raw);
    const updated = index.filter((k) => k !== key);
    localStorage.setItem(INDEX_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

function pruneOldCacheEntries(): void {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return;
    const index: string[] = JSON.parse(raw);
    // Remove the oldest 30% of entries
    const pruneCount = Math.ceil(index.length * 0.3);
    const toPrune = index.slice(0, pruneCount);
    const remaining = index.slice(pruneCount);

    toPrune.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(INDEX_KEY, JSON.stringify(remaining));
  } catch {
    // Ignore
  }
}

/**
 * Clears all cached API data (called on user logout).
 */
export function clearApiCache(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) {
      const index: string[] = JSON.parse(raw);
      index.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(INDEX_KEY);
    }
  } catch {
    // Ignore
  }
}
