"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

// ---------------------------------------------------------------------------
// Production Analytics types
// ---------------------------------------------------------------------------

export type ProductionStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

export type ProductionType = "milk" | "meat" | "eggs" | "wool";

export const PRODUCTION_TYPE_LABELS: Record<ProductionType, string> = {
  milk: "Dairy Milk",
  meat: "Meat & Carcass",
  eggs: "Eggs",
  wool: "Wool",
};

export const PRODUCTION_TYPE_UNITS: Record<ProductionType, string> = {
  milk: "L",
  meat: "kg",
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
  /** Production types that have at least one record. */
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
// Real production records (from GET production/records/)
// ---------------------------------------------------------------------------

export interface ProductionRecordItem {
  id: number;
  barangayName?: string | null;
  farmerName: string | null;
  livestockId: number; 
  livestockTypeName: string | null;
  productionType: ProductionType;
  quantity: number;
  unit: string; // "LITERS" | "PIECES" | "KILOGRAMS"
  recordDate: string; // "YYYY-MM-DD"
  notes: string;
  status: ProductionStatus;
  reviewRemarks: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface ApiProductionRecord {
  id: number;
  barangay_name?: string | null;
  farmer_name: string;
  livestock: number;
  livestock_type_name?: string | null;
  production_type?: string;
  quantity: string | number;
  unit: string;
  record_date: string;
  notes?: string;
  status: ProductionStatus;
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export const mapProductionRecord = (item: ApiProductionRecord): ProductionRecordItem => ({
  id: item.id,
  barangayName: item.barangay_name ?? null,
  farmerName: item.farmer_name ?? null,
  livestockId: item.livestock,
  livestockTypeName: item.livestock_type_name ?? null,
  productionType: (item.production_type ?? "milk").toLowerCase() as ProductionType,
  quantity: Number(item.quantity) || 0,
  unit: item.unit,
  recordDate: item.record_date,
  notes: item.notes ?? "",
  status: item.status,
  reviewRemarks: item.review_remarks ?? null,
  reviewedByName: item.reviewed_by_name ?? null,
  reviewedAt: item.reviewed_at ?? null,
  createdAt: item.created_at,
});

export async function fetchProductionRecords(): Promise<ProductionRecordItem[]> {
  try {
    const response = await api.get("production/records/");
    const data = response.data as ApiProductionRecord[];
    if (Array.isArray(data)) {
      return data.map(mapProductionRecord);
    }
  } catch (err) {
    console.error("Error fetching production records:", err);
  }
  return [];
}

export async function deleteProductionRecord(id: number): Promise<void> {
  await api.delete(`production/records/${id}/`);
}

// Estimated market prices per unit (in PHP)
const ESTIMATED_UNIT_PRICES: Record<ProductionType, number> = {
  milk: 50,  // PHP 50 per liter
  meat: 320, // PHP 320 per kg
  eggs: 9,   // PHP 9 per piece
  wool: 250  // PHP 250 per kg
};

export function computeProductionAnalytics(records: ProductionRecordItem[]): ProductionAnalytics {
  const typesFound = new Set<ProductionType>();
  const groupedByType: Record<string, ProductionRecordItem[]> = {};

  records.forEach((rec) => {
    const t = rec.productionType;
    typesFound.add(t);
    if (!groupedByType[t]) {
      groupedByType[t] = [];
    }
    groupedByType[t].push(rec);
  });

  const available_types: ProductionType[] = typesFound.size > 0 
    ? Array.from(typesFound) 
    : ["milk"];

  const by_type: Partial<Record<ProductionType, ProductionTypeAnalytics>> = {};

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  available_types.forEach((type) => {
    const typeRecords = groupedByType[type] || [];
    const unitPrice = ESTIMATED_UNIT_PRICES[type] || 50;

    let totalQty = 0;
    let currentMonthQty = 0;
    let prevMonthQty = 0;

    const monthlyMap = new Map<string, number>();

    typeRecords.forEach((r) => {
      totalQty += r.quantity;
      const mStr = (r.recordDate || "").slice(0, 7);
      if (mStr) {
        monthlyMap.set(mStr, (monthlyMap.get(mStr) || 0) + r.quantity);
      }
      if (mStr === currentMonthStr) {
        currentMonthQty += r.quantity;
      } else if (mStr === prevMonthStr) {
        prevMonthQty += r.quantity;
      }
    });

    let growth_pct = 0;
    if (prevMonthQty > 0) {
      growth_pct = ((currentMonthQty - prevMonthQty) / prevMonthQty) * 100;
    }

    const trend: ProductionTrendPoint[] = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, quantity]) => ({ period, quantity }));

    const value_trend: ProductionValuePoint[] = trend.map((t) => ({
      period: t.period,
      value: t.quantity * unitPrice,
    }));

    by_type[type] = {
      summary: {
        total: totalQty,
        record_count: typeRecords.length,
        estimated_value: totalQty * unitPrice,
        growth_pct,
        has_records: typeRecords.length > 0,
      },
      trend,
      value_trend,
    };
  });

  const recent_records: RecentProductionRecord[] = records.slice(0, 10).map((r) => ({
    id: r.id,
    record_date: r.recordDate,
    quantity: r.quantity,
    unit: r.unit,
    status: r.status,
  }));

  return {
    available_types,
    by_type,
    recent_records,
  };
}

async function fetchProductionAnalytics(): Promise<ProductionAnalytics> {
  const records = await fetchProductionRecords();
  return computeProductionAnalytics(records);
}

export function useProductionAnalytics() {
  return useQuery<ProductionAnalytics>({
    queryKey: ["production_analytics"],
    queryFn: fetchProductionAnalytics,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Presentation formatting helpers
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

export function formatPeriodMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Number(y) || 2026, (Number(m) || 1) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "short" },
  );
}

export function formatRecordDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Number(y) || 2026, (Number(m) || 1) - 1, Number(d) || 1).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );
}
