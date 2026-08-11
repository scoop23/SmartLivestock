"use client";

import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Farmer Dashboard Analytics types
//
// These mirror the response a backend `/farmer/dashboard/` endpoint will
// eventually return. Keep them in sync with the backend serializer when it is
// implemented.
//
// Honesty rules baked into the contract:
//   - avg_carcass_weight_kg is NULL when no slaughter record can be reliably
//     attributed to the farmer (SlaughterRecord.livestock == NULL is excluded).
//   - milk_production_liters is NULL when there is no approved milk data.
//   - milk_growth_pct is NULL when the month-over-month comparison cannot be
//     calculated.
//   - cattle_trend stays EMPTY because LivestockInventory has no historical
//     snapshots — we never fabricate a herd history.
// ---------------------------------------------------------------------------

export interface FarmerDashboardAnalytics {
  /** Sum of LivestockInventory.quantity for the authenticated farmer. */
  cattle_count: number;
  /** Avg SlaughterRecord.carcass_weight for farmer-owned records; NULL if none. */
  avg_carcass_weight_kg: number | null;
  /** Active DiseaseCase count (PENDING / VERIFIED) for the farmer. */
  active_health_alerts: number;
  /** Approved MILK production (liters) this month; NULL if none. */
  milk_production_liters: number | null;
  /** Month-over-month growth % of milk production; NULL if not calculable. */
  milk_growth_pct: number | null;
  /** Empty while the backend has no historical inventory snapshots. */
  cattle_trend: FarmerTrendPoint[];
  /** Approved MILK production (liters) per month, most recent months first. */
  milk_trend: FarmerTrendPoint[];
}

export interface FarmerTrendPoint {
  period: string; // "YYYY-MM"
  quantity: number;
}

// ---------------------------------------------------------------------------
// MOCK DATA — TEMPORARY
// ---------------------------------------------------------------------------
// TODO(backend): Delete this block once the Django `/farmer/dashboard/`
// endpoint is implemented. It exists only so the dashboard can be previewed.
const MOCK_FARMER_ANALYTICS: FarmerDashboardAnalytics = {
  cattle_count: 42,
  avg_carcass_weight_kg: 245,
  active_health_alerts: 2,
  milk_production_liters: 1240,
  milk_growth_pct: 12.4,
  // Intentionally empty: the backend does not track historical inventory.
  cattle_trend: [],
  milk_trend: [
    { period: "2026-04", quantity: 780 },
    { period: "2026-05", quantity: 850 },
    { period: "2026-06", quantity: 920 },
    { period: "2026-07", quantity: 1100 },
    { period: "2026-08", quantity: 1240 },
  ],
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFarmerDashboardAnalytics(): Promise<FarmerDashboardAnalytics> {
  // TODO(backend): Replace the mock below with the real request once the
  // Django endpoint `/farmer/dashboard/` is implemented:
  //
  //   const res = await api.get("farmer/dashboard/");
  //   return res.data as FarmerDashboardAnalytics;
  //
  await delay(700); // simulate network latency so loading states are visible
  return MOCK_FARMER_ANALYTICS;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFarmerDashboardAnalytics() {
  return useQuery<FarmerDashboardAnalytics>({
    queryKey: ["farmer_analytics"],
    queryFn: fetchFarmerDashboardAnalytics,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Presentation formatting helpers
//
// Small, presentational only. All business calculations stay on the backend.
// ---------------------------------------------------------------------------

export function formatQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/** "2026-08" -> "Aug" */
export function formatPeriodMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Number(y) || 2026, (Number(m) || 1) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "short" },
  );
}
