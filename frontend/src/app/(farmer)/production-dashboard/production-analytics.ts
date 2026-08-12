"use client";

import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Production Analytics types
//
// These mirror the response the Django endpoint `/production/analytics/` will
// eventually return. Keep them in sync with the backend serializer when it is
// implemented.
// ---------------------------------------------------------------------------

export type ProductionStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

export type ProductionType = "milk" | "eggs" | "wool";

export const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  milk: "Milk",
  eggs: "Eggs",
  wool: "Wool",
};

export const PRODUCTION_TYPE_UNITS: Record<ProductionType, string> = {
  milk: "L",
  eggs: "pc",
  wool: "kg",
};

export interface ProductionAnalyticsSummary {
  total: number;
  record_count: number;
  estimated_value: number;
  growth_pct: number;
  has_records: boolean;
}

export interface ProductionTrendPoint {
  period: string; // "YYYY-MM"
  quantity: number;
}

export interface ProductionValuePoint {
  period: string; // "YYYY-MM"
  value: number;
}

export interface ProductionTypeAnalytics {
  summary: ProductionAnalyticsSummary;
  trend: ProductionTrendPoint[];
  value_trend: ProductionValuePoint[];
}

export interface RecentProductionRecord {
  id: number;
  record_date: string; // "YYYY-MM-DD"
  quantity: number;
  unit: string; // "LITERS" | ...
  status: ProductionStatus;
}

export interface ProductionAnalytics {
  /** Production types that have at least one approved record. */
  available_types: ProductionType[];
  /** Per-type analytics so the dashboard can switch types without extra requests. */
  by_type: Partial<Record<ProductionType, ProductionTypeAnalytics>>;
  recent_records: RecentProductionRecord[];
}

export const EMPTY_TYPE_ANALYTICS: ProductionTypeAnalytics = {
  summary: {
    total: 0,
    record_count: 0,
    estimated_value: 0,
    growth_pct: 0,
    has_records: false,
  },
  trend: [],
  value_trend: [],
};

// ---------------------------------------------------------------------------
// MOCK DATA — TEMPORARY
// ---------------------------------------------------------------------------
// TODO: (backend): Delete this block once the Django analytics endpoint is
// implemented. It exists only so the dashboard can be previewed today.
// Mock includes eggs so the type selector and the "View more production →"
const MOCK_ANALYTICS: ProductionAnalytics = {
  // link are visible while previewing. A milk-only farm would send
  // ["milk"] and hide both.
  available_types: ["milk", "eggs"],
  // available_types: ["milk"],
  by_type: {
    milk: {
      summary: {
        total: 1250.5,
        record_count: 32,
        estimated_value: 62500,
        growth_pct: 12.5,
        has_records: true,
      },
      trend: [
        { period: "2026-04", quantity: 850 },
        { period: "2026-05", quantity: 920 },
        { period: "2026-06", quantity: 1050 },
        { period: "2026-07", quantity: 1100 },
        { period: "2026-08", quantity: 1250 },
      ],
      value_trend: [
        { period: "2026-04", value: 42500 },
        { period: "2026-05", value: 46000 },
        { period: "2026-06", value: 52500 },
        { period: "2026-07", value: 55000 },
        { period: "2026-08", value: 62500 },
      ],
    },
    // eggs: {
    //   summary: {
    //     total: 420,
    //     record_count: 14,
    //     estimated_value: 3780,
    //     growth_pct: -4.2,
    //     has_records: true,
    //   },
    //   trend: [
    //     { period: "2026-04", quantity: 480 },
    //     { period: "2026-05", quantity: 450 },
    //     { period: "2026-06", quantity: 460 },
    //     { period: "2026-07", quantity: 440 },
    //     { period: "2026-08", quantity: 420 },
    //   ],
    //   value_trend: [
    //     { period: "2026-04", value: 4320 },
    //     { period: "2026-05", value: 4050 },
    //     { period: "2026-06", value: 4140 },
    //     { period: "2026-07", value: 3960 },
    //     { period: "2026-08", value: 3780 },
    //   ],
    // },
  },
  recent_records: [
    { id: 8, record_date: "2026-08-10", quantity: 25, unit: "LITERS", status: "APPROVED" },
    { id: 7, record_date: "2026-08-09", quantity: 23, unit: "LITERS", status: "APPROVED" },
    { id: 6, record_date: "2026-08-08", quantity: 27, unit: "LITERS", status: "PENDING" },
    { id: 5, record_date: "2026-08-07", quantity: 24, unit: "LITERS", status: "APPROVED" },
    { id: 4, record_date: "2026-08-06", quantity: 21, unit: "LITERS", status: "REJECTED" },
  ],
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchProductionAnalytics(): Promise<ProductionAnalytics> {
  // TODO: (backend): Replace the mock below with the real request once the
  // Django endpoint `/production/analytics/` is implemented:
  //
  //   const res = await api.get("production/analytics/");
  //   return res.data as ProductionAnalytics;
  //
  await delay(700); // simulate network latency so loading states are visible
  return MOCK_ANALYTICS;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProductionAnalytics() {
  return useQuery<ProductionAnalytics>({
    queryKey: ["production_analytics"],
    queryFn: fetchProductionAnalytics,
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

export function formatPeso(n: number): string {
  return `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatPesoCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `₱${(n / 1000).toLocaleString(undefined, {
      maximumFractionDigits: Math.abs(n) >= 100000 ? 0 : 1,
    })}K`;
  }
  return `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** "2026-08" -> "Aug" */
export function formatPeriodMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Number(y) || 2026, (Number(m) || 1) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "short" },
  );
}

/** "2026-08-10" -> "Aug 10" */
export function formatRecordDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Number(y) || 2026, (Number(m) || 1) - 1, Number(d) || 1).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );
}
