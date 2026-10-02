import type { QueryClient } from "@tanstack/react-query";

// Successful workflow changes can affect live population and dated summaries.
// Inactive queries become stale; active consumers refetch. Detail lists keep
// their own existing mutation updates and pagination keys.
export async function invalidateMunicipalSummaries(client: QueryClient) {
  const keys = [
    ["admin", "analytics"], ["admin", "inventory"], ["admin-inventory-records"],
    ["admin-production-records"], ["admin-incident-records"], ["admin-census-submissions"],
    ["admin-batches-overview"], ["farmer-dashboard-analytics"], ["farmer_analytics"],
  ];
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey })));
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })));
}
