import type { AxiosRequestConfig } from "axios";
import api from "./axios";

// A failed municipal read must not silently use another database. Reuse the
// existing request-local failover guard without changing the shared API client.
export function municipalRead<T = unknown>(url: string, config: AxiosRequestConfig = {}) {
  const pinnedConfig = { ...config, _fallbackRetried: true };
  return api.get<T>(url, pinnedConfig);
}
