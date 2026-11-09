"use client";

import type { InventoryApiItem, BatchApiItem } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import type { RawDiseaseCase, RawMortalityRecord } from "@/app/(sibat)/sibat/sibat-analytics";
import type { ApiProductionRecord } from "@/app/(farmer)/production-dashboard/production-analytics";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Farmer Dashboard Analytics types
// ---------------------------------------------------------------------------

export interface HerdCategoryPoint {
  name: string;
  value: number;
  color: string;
}

export interface HerdSubcategoryPoint {
  name: string;
  category: string;
  value: number;
  color: string;
}

export interface FarmerTrendPoint {
  period: string; // "YYYY-MM"
  quantity: number;
}

export interface FarmerActivityItem {
  id: string | number;
  type: "INVENTORY" | "PRODUCTION" | "DISEASE" | "MORTALITY";
  title: string;
  description: string;
  status: string;
  date: string;
  remarks?: string | null;
  rawItem?: InventoryApiItem | BatchApiItem | ApiProductionRecord | RawDiseaseCase | RawMortalityRecord;
}

export interface StatusBreakdownPoint {
  name: string;
  value: number;
  color: string;
}

export interface HealthIncidentTrendPoint {
  period: string;
  disease: number;
  mortality: number;
}

export interface FarmerDashboardAnalytics {
  /** Sum of active LivestockInventory.quantity for the authenticated farmer. */
  cattle_count: number;
  approved_count: number;
  verified_count: number;
  pending_count: number;
  revision_count: number;
  rejected_count: number;
  /** Names of farmer-scoped data sources that failed or returned an unexpected payload. */
  source_warnings: string[];
  /** Avg SlaughterRecord.carcass_weight for farmer-owned records; NULL if none. */
  avg_carcass_weight_kg: number | null;
  /** Disease report entries whose event date falls in the current calendar month. */
  disease_reports_this_month: number;
  /** Current-month disease reports still moving through PENDING / VERIFIED review. */
  disease_reports_awaiting_review_this_month: number;
  /** RECORDED farmer MILK liters this month; NULL if none. */
  milk_production_liters: number | null;
  /** Number of RECORDED farmer MILK entries dated in the current month. */
  milk_records_this_month: number;
  /** Month-over-month growth % of milk production; NULL if not calculable. */
  milk_growth_pct: number | null;
  /** Historical cattle trend */
  cattle_trend: FarmerTrendPoint[];
  /** RECORDED MILK production (liters) per month, most recent months first. */
  milk_trend: FarmerTrendPoint[];
  /** Primary livestock species distribution for the two-level pie chart inner ring. */
  herd_categories: HerdCategoryPoint[];
  /** Sub-category / breed / purpose breakdown for the two-level pie chart outer ring. */
  herd_subcategories: HerdSubcategoryPoint[];
  /** Breakdown by verification / audit status */
  status_breakdown: StatusBreakdownPoint[];
  /** Recent 6 months disease & mortality occurrences */
  health_incident_trend: HealthIncidentTrendPoint[];
  /** Recent live activities logged by the farmer */
  recent_activities: FarmerActivityItem[];
  /** Raw API records for instant client-side date filtering */
  raw_data?: FarmerRawData;
}

export interface FarmerRawData {
  inventories: InventoryApiItem[];
  batches: BatchApiItem[];
  productions: ApiProductionRecord[];
  diseaseCases: RawDiseaseCase[];
  mortalities: RawMortalityRecord[];
}

const SPECIES_COLORS: Record<string, string> = {
  cattle: "#059669",
  cow: "#059669",
  carabao: "#d97706",
  goat: "#ea580c",
  swine: "#0284c7",
  pig: "#0284c7",
  sheep: "#8b5cf6",
  poultry: "#ec4899",
};

const DEFAULT_COLORS = ["#059669", "#d97706", "#ea580c", "#0284c7", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e"];

async function fetchFarmerDashboardAnalytics(): Promise<FarmerDashboardAnalytics> {
  const [invRes, batchRes, prodRes, diseaseRes, mortRes] = await Promise.allSettled([
    // Include inactive rows so the dashboard can explicitly build a current
    // herd from operational_status instead of relying on the API's default filter.
    api.get("livestock/inventory/", { params: { include_inactive: true } }),
    api.get("livestock/batches/"),
    api.get("production/records/"),
    api.get("diseases/cases/"),
    api.get("diseases/mortality/"),
  ]);

  const sourceWarnings: string[] = [];
  if (invRes.status === "rejected" || !Array.isArray(invRes.value.data)) sourceWarnings.push("livestock inventory");
  if (batchRes.status === "rejected" || !Array.isArray(batchRes.value.data)) sourceWarnings.push("herd batches");
  if (prodRes.status === "rejected" || !Array.isArray(prodRes.value.data)) sourceWarnings.push("production records");
  if (diseaseRes.status === "rejected" || !Array.isArray(diseaseRes.value.data)) sourceWarnings.push("disease reports");
  if (mortRes.status === "rejected" || !Array.isArray(mortRes.value.data)) sourceWarnings.push("mortality reports");

  const inventories: InventoryApiItem[] = invRes.status === "fulfilled" && Array.isArray(invRes.value.data) ? invRes.value.data : [];
  const batches: BatchApiItem[] = batchRes.status === "fulfilled" && Array.isArray(batchRes.value.data) ? batchRes.value.data : [];
  const productions: ApiProductionRecord[] = prodRes.status === "fulfilled" && Array.isArray(prodRes.value.data) ? prodRes.value.data : [];
  const diseaseCases: RawDiseaseCase[] = diseaseRes.status === "fulfilled" && Array.isArray(diseaseRes.value.data) ? diseaseRes.value.data : [];
  const mortalities: RawMortalityRecord[] = mortRes.status === "fulfilled" && Array.isArray(mortRes.value.data) ? mortRes.value.data : [];

  // 1. Current herd calculations. Historical animals remain in the API for
  // records, but only active animals belong in the farmer's current herd KPIs.
  const activeInventories = inventories.filter(
    (item) => String(item.operational_status || "ACTIVE").toUpperCase() === "ACTIVE",
  );

  let totalHeads = 0;
  let approvedHeads = 0;
  let verifiedHeads = 0;
  let pendingHeads = 0;
  let revisionHeads = 0;
  let rejectedHeads = 0;

  const speciesMap = new Map<string, number>();
  const breedMap = new Map<string, { category: string; count: number }>();
  const monthlyHerdMap = new Map<string, number>();

  // Tally individual inventories
  activeInventories.forEach((item) => {
    const qty = Number(item.quantity) || 1;
    totalHeads += qty;

    const st = String(item.status || "PENDING").toUpperCase();
    if (st === "APPROVED") {
      approvedHeads += qty;
    } else if (st === "VERIFIED") {
      verifiedHeads += qty;
    } else if (st === "SUBJECT_TO_REVISION") {
      revisionHeads += qty;
    } else if (st === "REJECTED") {
      rejectedHeads += qty;
    } else {
      pendingHeads += qty;
    }

    const species = (item.livestock_type_name || "Other Livestock").trim();
    speciesMap.set(species, (speciesMap.get(species) || 0) + qty);

    const breed = (item.breed || "Standard").trim();
    const existingBreed = breedMap.get(breed);
    if (existingBreed) {
      existingBreed.count += qty;
    } else {
      breedMap.set(breed, { category: species, count: qty });
    }

    const dStr = String(item.created_at || item.date_acquired || "");
    const monthKey = dStr.slice(0, 7);
    if (monthKey) {
      monthlyHerdMap.set(monthKey, (monthlyHerdMap.get(monthKey) || 0) + qty);
    }
  });

  // Herds group inventory children; never add their count as a second population.

  const status_breakdown: StatusBreakdownPoint[] = [
    { name: "MAO Certified", value: approvedHeads, color: "#10b981" },
    { name: "CBAT Verified", value: verifiedHeads, color: "#0284c7" },
    { name: "Pending Review", value: pendingHeads, color: "#f59e0b" },
    { name: "Needs Revision", value: revisionHeads, color: "#f59e0b" },
    { name: "Rejected", value: rejectedHeads, color: "#ef4444" },
  ].filter((p) => p.value > 0);

  const herd_categories: HerdCategoryPoint[] = Array.from(speciesMap.entries()).map(([name, value], i) => {
    const key = name.toLowerCase();
    const matchedKey = Object.keys(SPECIES_COLORS).find((k) => key.includes(k));
    const color = matchedKey ? SPECIES_COLORS[matchedKey] : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    return { name, value, color };
  });

  const herd_subcategories: HerdSubcategoryPoint[] = Array.from(breedMap.entries()).map(([name, { category, count }], i) => {
    const catObj = herd_categories.find((c) => c.name === category);
    const color = catObj ? catObj.color : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    return { name, category, value: count, color };
  });

  const cattle_trend: FarmerTrendPoint[] = Array.from(monthlyHerdMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, quantity]) => ({ period, quantity }));

  // 2. Production calculations (Milk & Monthly Trends)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  let currentMonthMilk = 0;
  let prevMonthMilk = 0;
  let hasMilkData = false;
  let currentMonthMilkRecords = 0;

  const monthlyMilkMap = new Map<string, number>();

  productions.forEach((prod) => {
    const type = String(prod.production_type || "").toUpperCase();
    const status = String(prod.status || "").toUpperCase();
    const qty = Number(prod.quantity) || 0;
    const dateStr = String(prod.record_date || prod.created_at || "");
    const monthKey = dateStr.slice(0, 7); // "YYYY-MM"

    if (type !== "MILK") return;

    // Personal analytics use current farmer-recorded logs only. Historical
    // approval-state rows stay stored but are excluded from totals.
    if (status !== "RECORDED") return;

    hasMilkData = true;
    if (monthKey) {
      monthlyMilkMap.set(monthKey, (monthlyMilkMap.get(monthKey) || 0) + qty);
    }
    if (monthKey === currentMonthStr) {
      currentMonthMilk += qty;
      currentMonthMilkRecords += 1;
    } else if (monthKey === prevMonthStr) {
      prevMonthMilk += qty;
    }
  });

  const milk_trend: FarmerTrendPoint[] = Array.from(monthlyMilkMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, quantity]) => ({ period, quantity }));

  let milk_growth_pct: number | null = null;
  if (prevMonthMilk > 0) {
    milk_growth_pct = ((currentMonthMilk - prevMonthMilk) / prevMonthMilk) * 100;
  }

  // 3. Disease reports use the same current-month window as production.
  // Count report records, not affected heads, and leave missing event dates out.
  const currentMonthDiseaseCases = diseaseCases.filter((dc) =>
    typeof dc.record_date === "string" && dc.record_date.startsWith(currentMonthStr),
  );
  let diseaseReportsAwaitingReview = 0;
  currentMonthDiseaseCases.forEach((dc) => {
    const st = String(dc.status || "PENDING").toUpperCase();
    if (st === "PENDING" || st === "VERIFIED") {
      diseaseReportsAwaitingReview += 1;
    }
  });

  // 4. Combined Recent Activity Feed
  const activities: FarmerActivityItem[] = [];

  activeInventories.slice(0, 5).forEach((inv) => {
    activities.push({
      id: `inv-${inv.id}`,
      type: "INVENTORY",
      title: `${inv.livestock_type_name || "Livestock"} Registered`,
      description: `${inv.breed || "Standard"} • ${inv.quantity || 1} Head(s) • Tag: ${inv.tag_number || "Pending"}`,
      status: (inv.status || "PENDING").toUpperCase(),
      date: inv.created_at || inv.date_acquired || new Date().toISOString(),
      remarks: inv.review_remarks,
      rawItem: inv,
    });
  });

  batches.slice(0, 5).forEach((b) => {
    activities.push({
      id: `batch-${b.id}`,
      type: "INVENTORY",
      title: `Herd Batch: ${b.batch_code || b.batch_name || "Batch Registered"}`,
      description: `${b.livestock_type_name || "Herd"} • ${b.total_animals || b.animals?.length || 1} Head(s) • Pen: ${b.housing_pen || "General"}`,
      status: (b.review_status || b.status || "PENDING").toUpperCase(),
      date: b.created_at || new Date().toISOString(),
      remarks: b.review_remarks,
      rawItem: b,
    });
  });

  productions.slice(0, 5).forEach((prod) => {
    activities.push({
      id: `prod-${prod.id}`,
      type: "PRODUCTION",
      title: `${prod.production_type || "Production"} Logged`,
      description: `${prod.quantity} ${prod.unit || "Units"} • Recorded: ${prod.record_date || "Recent"}`,
      status: "RECORDED",
      date: prod.created_at || prod.record_date || new Date().toISOString(),
      remarks: prod.review_remarks,
      rawItem: prod,
    });
  });

  diseaseCases.slice(0, 5).forEach((dc) => {
    activities.push({
      id: `dc-${dc.id}`,
      type: "DISEASE",
      title: `Observation: ${dc.name || "Health Issue"}`,
      description: `Affected: ${dc.affected_count || 1} head(s) • Tag: ${dc.tag_number || "General"}`,
      status: (dc.status || "PENDING").toUpperCase(),
      date: dc.created_at || dc.record_date || new Date().toISOString(),
      remarks: dc.review_remarks,
      rawItem: dc,
    });
  });

  mortalities.slice(0, 5).forEach((m) => {
    activities.push({
      id: `mort-${m.id}`,
      type: "MORTALITY",
      title: `Mortality Record: ${m.cause || "Deceased"}`,
      description: `Count: ${m.death_count || 1} head(s) • Tag: ${m.tag_number || "General"}`,
      status: (m.status || "PENDING").toUpperCase(),
      date: m.created_at || m.record_date || new Date().toISOString(),
      remarks: m.review_remarks,
      rawItem: m,
    });
  });

  // Sort activities newest first
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 5. Monthly Health Surveillance Incident Trends (Last 6 Months)
  const monthLabels: { key: string; label: string }[] = [];
  const monthMap = new Map<string, { disease: number; mortality: number; label: string }>();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    monthLabels.push({ key, label });
    monthMap.set(key, { disease: 0, mortality: 0, label });
  }

  diseaseCases.forEach((dc) => {
    const dStr = String(dc.record_date || dc.created_at || "");
    const key = dStr.slice(0, 7);
    if (monthMap.has(key)) {
      monthMap.get(key)!.disease += Number(dc.affected_count) || 1;
    }
  });

  mortalities.forEach((m) => {
    const dStr = String(m.record_date || m.created_at || "");
    const key = dStr.slice(0, 7);
    if (monthMap.has(key)) {
      monthMap.get(key)!.mortality += Number(m.death_count) || 1;
    }
  });

  const health_incident_trend: HealthIncidentTrendPoint[] = monthLabels.map(({ key, label }) => ({
    period: label,
    disease: monthMap.get(key)!.disease,
    mortality: monthMap.get(key)!.mortality,
  }));

  return {
    cattle_count: totalHeads,
    approved_count: approvedHeads,
    verified_count: verifiedHeads,
    pending_count: pendingHeads,
    revision_count: revisionHeads,
    rejected_count: rejectedHeads,
    source_warnings: sourceWarnings,
    avg_carcass_weight_kg: null,
    disease_reports_this_month: currentMonthDiseaseCases.length,
    disease_reports_awaiting_review_this_month: diseaseReportsAwaitingReview,
    milk_production_liters: hasMilkData ? currentMonthMilk : null,
    milk_records_this_month: currentMonthMilkRecords,
    milk_growth_pct,
    cattle_trend,
    milk_trend,
    herd_categories,
    herd_subcategories,
    status_breakdown,
    health_incident_trend,
    recent_activities: activities.slice(0, 8),
    raw_data: {
      inventories,
      batches,
      productions,
      diseaseCases,
      mortalities,
    },
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFarmerDashboardAnalytics() {
  return useQuery<FarmerDashboardAnalytics>({
    queryKey: ["farmer_analytics"],
    queryFn: fetchFarmerDashboardAnalytics,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Formatting Helpers
// ---------------------------------------------------------------------------

export function formatQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function formatPeriodMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Number(y) || 2026, (Number(m) || 1) - 1, 1).toLocaleDateString(
    "en-US",
    { month: "short" },
  );
}

// ---------------------------------------------------------------------------
// Chart Date Range Filtering Helpers
// ---------------------------------------------------------------------------

export type DateRangePreset = "ALL" | "30D" | "6M" | "YTD" | "CUSTOM";

export interface FilteredFarmerChartData {
  categories: HerdCategoryPoint[];
  totalHerdCount: number;
  reviewedShare: number | null;
  statusBreakdown: StatusBreakdownPoint[];
  milkTrend: FarmerTrendPoint[];
  milkTotalInPeriod: number;
  milkGrowthPct: number | null;
  healthTrend: HealthIncidentTrendPoint[];
  hasRawData: boolean;
}

export function getPresetDateRange(preset: DateRangePreset): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatYMD(now);

  switch (preset) {
    case "30D": {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: formatYMD(past30), endDate: todayStr };
    }
    case "6M": {
      const past6m = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { startDate: formatYMD(past6m), endDate: todayStr };
    }
    case "YTD": {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatYMD(startOfYear), endDate: todayStr };
    }
    case "ALL":
    case "CUSTOM":
    default:
      return { startDate: "", endDate: "" };
  }
}

function parseDateOnly(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.slice(0, 10);
}

function inDateRange(dateStr: string | null | undefined, start?: string, end?: string): boolean {
  if (!start && !end) return true;
  const d = parseDateOnly(dateStr);
  if (!d) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

export function computeFilteredFarmerCharts(
  rawData?: FarmerRawData,
  startDate?: string,
  endDate?: string,
  preset: DateRangePreset = "ALL",
  fallbackAnalytics?: FarmerDashboardAnalytics,
): FilteredFarmerChartData {
  if (!rawData) {
    const totalCount = fallbackAnalytics?.cattle_count ?? 0;
    const reviewedCount = (fallbackAnalytics?.approved_count ?? 0) + (fallbackAnalytics?.verified_count ?? 0);
    return {
      categories: fallbackAnalytics?.herd_categories ?? [],
      totalHerdCount: totalCount,
      reviewedShare: totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : null,
      statusBreakdown: fallbackAnalytics?.status_breakdown ?? [],
      milkTrend: fallbackAnalytics?.milk_trend ?? [],
      milkTotalInPeriod: fallbackAnalytics?.milk_production_liters ?? 0,
      milkGrowthPct: fallbackAnalytics?.milk_growth_pct ?? null,
      healthTrend: fallbackAnalytics?.health_incident_trend ?? [],
      hasRawData: false,
    };
  }

  const isAllTime = preset === "ALL" && !startDate && !endDate;

  // 1. Livestock breakdown & review status
  const activeInventories = (rawData.inventories || []).filter(
    (item) => String(item.operational_status || "ACTIVE").toUpperCase() === "ACTIVE",
  );

  const filteredInventories = isAllTime
    ? activeInventories
    : activeInventories.filter((item) =>
        inDateRange(item.created_at || item.date_acquired, startDate, endDate),
      );

  let totalHeads = 0;
  let approvedHeads = 0;
  let verifiedHeads = 0;
  let pendingHeads = 0;
  let revisionHeads = 0;
  let rejectedHeads = 0;

  const speciesMap = new Map<string, number>();

  filteredInventories.forEach((item) => {
    const qty = Number(item.quantity) || 1;
    totalHeads += qty;

    const st = String(item.status || "PENDING").toUpperCase();
    if (st === "APPROVED") approvedHeads += qty;
    else if (st === "VERIFIED") verifiedHeads += qty;
    else if (st === "SUBJECT_TO_REVISION") revisionHeads += qty;
    else if (st === "REJECTED") rejectedHeads += qty;
    else pendingHeads += qty;

    const species = (item.livestock_type_name || "Other Livestock").trim();
    speciesMap.set(species, (speciesMap.get(species) || 0) + qty);
  });

  const categories: HerdCategoryPoint[] = Array.from(speciesMap.entries()).map(([name, value], i) => {
    const key = name.toLowerCase();
    const matchedKey = Object.keys(SPECIES_COLORS).find((k) => key.includes(k));
    const color = matchedKey ? SPECIES_COLORS[matchedKey] : DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    return { name, value, color };
  });

  const statusBreakdown: StatusBreakdownPoint[] = [
    { name: "MAO Certified", value: approvedHeads, color: "#10b981" },
    { name: "CBAT Verified", value: verifiedHeads, color: "#0284c7" },
    { name: "Pending Review", value: pendingHeads, color: "#f59e0b" },
    { name: "Needs Revision", value: revisionHeads, color: "#f59e0b" },
    { name: "Rejected", value: rejectedHeads, color: "#ef4444" },
  ].filter((p) => p.value > 0);

  const reviewedHeadCount = approvedHeads + verifiedHeads;
  const reviewedShare = totalHeads > 0 ? Math.round((reviewedHeadCount / totalHeads) * 100) : null;

  // 2. Milk Production Trajectory
  const monthlyMilkMap = new Map<string, number>();
  let milkTotalInPeriod = 0;

  (rawData.productions || []).forEach((prod) => {
    const type = String(prod.production_type || "").toUpperCase();
    const status = String(prod.status || "").toUpperCase();
    if (type !== "MILK" || status !== "RECORDED") return;

    const dateStr = String(prod.record_date || prod.created_at || "");
    if (!isAllTime && !inDateRange(dateStr, startDate, endDate)) return;

    const qty = Number(prod.quantity) || 0;
    const monthKey = dateStr.slice(0, 7);
    if (monthKey) {
      monthlyMilkMap.set(monthKey, (monthlyMilkMap.get(monthKey) || 0) + qty);
    }
    milkTotalInPeriod += qty;
  });

  const milkTrend: FarmerTrendPoint[] = Array.from(monthlyMilkMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, quantity]) => ({ period, quantity }));

  let milkGrowthPct: number | null = null;
  if (milkTrend.length >= 2) {
    const current = milkTrend[milkTrend.length - 1].quantity;
    const prev = milkTrend[milkTrend.length - 2].quantity;
    if (prev > 0) {
      milkGrowthPct = ((current - prev) / prev) * 100;
    }
  }

  // 3. Animal Health Reports (Disease & Mortality Trend)
  const now = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const todayStr = formatYMD(now);

  const monthLabels: { key: string; label: string }[] = [];
  const monthMap = new Map<string, { disease: number; mortality: number }>();

  if (isAllTime || preset === "6M" || (!startDate && !endDate)) {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      monthLabels.push({ key, label });
      monthMap.set(key, { disease: 0, mortality: 0 });
    }
  } else if (preset === "30D") {
    const dStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startKey = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, "0")}`;
    const endKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const keys = startKey === endKey ? [startKey] : [startKey, endKey];
    keys.forEach((k) => {
      const [y, m] = k.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      monthLabels.push({ key: k, label });
      monthMap.set(k, { disease: 0, mortality: 0 });
    });
  } else if (preset === "YTD") {
    const year = now.getFullYear();
    const curMonth = now.getMonth();
    for (let m = 0; m <= curMonth; m++) {
      const d = new Date(year, m, 1);
      const key = `${year}-${String(m + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      monthLabels.push({ key, label });
      monthMap.set(key, { disease: 0, mortality: 0 });
    }
  } else {
    // Custom date range
    const startKey = (startDate || "2026-01-01").slice(0, 7);
    const endKey = (endDate || todayStr).slice(0, 7);
    const startYear = parseInt(startKey.slice(0, 4), 10);
    const startMonth = parseInt(startKey.slice(5, 7), 10) - 1;
    const endYear = parseInt(endKey.slice(0, 4), 10);
    const endMonth = parseInt(endKey.slice(5, 7), 10) - 1;

    let curY = startYear;
    let curM = startMonth;
    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const d = new Date(curY, curM, 1);
      const key = `${curY}-${String(curM + 1).padStart(2, "0")}`;
      const label = `${d.toLocaleDateString("en-US", { month: "short" })}${startYear !== endYear ? ` '${String(curY).slice(2)}` : ""}`;
      monthLabels.push({ key, label });
      monthMap.set(key, { disease: 0, mortality: 0 });
      curM++;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
    }
  }

  (rawData.diseaseCases || []).forEach((dc) => {
    const dStr = String(dc.record_date || dc.created_at || "");
    if (!isAllTime && !inDateRange(dStr, startDate, endDate)) return;
    const key = dStr.slice(0, 7);
    if (monthMap.has(key)) {
      monthMap.get(key)!.disease += Number(dc.affected_count) || 1;
    }
  });

  (rawData.mortalities || []).forEach((m) => {
    const dStr = String(m.record_date || m.created_at || "");
    if (!isAllTime && !inDateRange(dStr, startDate, endDate)) return;
    const key = dStr.slice(0, 7);
    if (monthMap.has(key)) {
      monthMap.get(key)!.mortality += Number(m.death_count) || 1;
    }
  });

  const healthTrend: HealthIncidentTrendPoint[] = monthLabels.map(({ key, label }) => ({
    period: label,
    disease: monthMap.get(key)?.disease ?? 0,
    mortality: monthMap.get(key)?.mortality ?? 0,
  }));

  return {
    categories,
    totalHerdCount: totalHeads,
    reviewedShare,
    statusBreakdown,
    milkTrend,
    milkTotalInPeriod,
    milkGrowthPct,
    healthTrend,
    hasRawData: true,
  };
}
