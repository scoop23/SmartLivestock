"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

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
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
  date: string;
  remarks?: string | null;
}

export interface FarmerDashboardAnalytics {
  /** Sum of LivestockInventory.quantity for the authenticated farmer. */
  cattle_count: number;
  approved_count: number;
  pending_count: number;
  /** Avg SlaughterRecord.carcass_weight for farmer-owned records; NULL if none. */
  avg_carcass_weight_kg: number | null;
  /** Active DiseaseCase count (PENDING / VERIFIED) for the farmer. */
  active_health_alerts: number;
  /** Approved MILK production (liters) this month; NULL if none. */
  milk_production_liters: number | null;
  /** Month-over-month growth % of milk production; NULL if not calculable. */
  milk_growth_pct: number | null;
  /** Historical cattle trend */
  cattle_trend: FarmerTrendPoint[];
  /** Approved MILK production (liters) per month, most recent months first. */
  milk_trend: FarmerTrendPoint[];
  /** Primary livestock species distribution for the two-level pie chart inner ring. */
  herd_categories: HerdCategoryPoint[];
  /** Sub-category / breed / purpose breakdown for the two-level pie chart outer ring. */
  herd_subcategories: HerdSubcategoryPoint[];
  /** Recent live activities logged by the farmer */
  recent_activities: FarmerActivityItem[];
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
  const [invRes, prodRes, diseaseRes, mortRes] = await Promise.allSettled([
    api.get("livestock/inventory/"),
    api.get("production/records/"),
    api.get("diseases/cases/"),
    api.get("diseases/mortality/"),
  ]);

  const inventories: any[] = invRes.status === "fulfilled" && Array.isArray(invRes.value.data) ? invRes.value.data : [];
  const productions: any[] = prodRes.status === "fulfilled" && Array.isArray(prodRes.value.data) ? prodRes.value.data : [];
  const diseaseCases: any[] = diseaseRes.status === "fulfilled" && Array.isArray(diseaseRes.value.data) ? diseaseRes.value.data : [];
  const mortalities: any[] = mortRes.status === "fulfilled" && Array.isArray(mortRes.value.data) ? mortRes.value.data : [];

  // 1. Livestock Inventory calculations
  let totalHeads = 0;
  let approvedHeads = 0;
  let pendingHeads = 0;

  const speciesMap = new Map<string, number>();
  const breedMap = new Map<string, { category: string; count: number }>();

  inventories.forEach((item) => {
    const qty = Number(item.quantity) || 1;
    totalHeads += qty;

    const st = String(item.status || "PENDING").toUpperCase();
    if (st === "APPROVED" || st === "VERIFIED") {
      approvedHeads += qty;
    } else {
      pendingHeads += qty;
    }

    const species = (item.livestock_type_name || item.livestock_type?.name || "Other Livestock").trim();
    speciesMap.set(species, (speciesMap.get(species) || 0) + qty);

    const breed = (item.breed || "Standard").trim();
    const existingBreed = breedMap.get(breed);
    if (existingBreed) {
      existingBreed.count += qty;
    } else {
      breedMap.set(breed, { category: species, count: qty });
    }
  });

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

  // 2. Production calculations (Milk & Monthly Trends)
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  let currentMonthMilk = 0;
  let prevMonthMilk = 0;
  let hasMilkData = false;

  const monthlyMilkMap = new Map<string, number>();

  productions.forEach((prod) => {
    const type = String(prod.production_type || "").toUpperCase();
    const qty = Number(prod.quantity) || 0;
    const dateStr = String(prod.record_date || prod.created_at || "");
    const monthKey = dateStr.slice(0, 7); // "YYYY-MM"

    if (type === "MILK") {
      hasMilkData = true;
      if (monthKey) {
        monthlyMilkMap.set(monthKey, (monthlyMilkMap.get(monthKey) || 0) + qty);
      }
      if (monthKey === currentMonthStr) {
        currentMonthMilk += qty;
      } else if (monthKey === prevMonthStr) {
        prevMonthMilk += qty;
      }
    }
  });

  const milk_trend: FarmerTrendPoint[] = Array.from(monthlyMilkMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, quantity]) => ({ period, quantity }));

  let milk_growth_pct: number | null = null;
  if (prevMonthMilk > 0) {
    milk_growth_pct = ((currentMonthMilk - prevMonthMilk) / prevMonthMilk) * 100;
  }

  // 3. Health & Disease Alerts
  let activeAlerts = 0;
  diseaseCases.forEach((dc) => {
    const st = String(dc.status || "PENDING").toUpperCase();
    if (st === "PENDING" || st === "VERIFIED") {
      activeAlerts += 1;
    }
  });

  // 4. Combined Recent Activity Feed
  const activities: FarmerActivityItem[] = [];

  inventories.slice(0, 5).forEach((inv) => {
    activities.push({
      id: `inv-${inv.id}`,
      type: "INVENTORY",
      title: `${inv.livestock_type_name || "Livestock"} Registered`,
      description: `${inv.breed || "Standard"} • ${inv.quantity || 1} Head(s) • Tag: ${inv.tag_number || "Pending"}`,
      status: (inv.status || "PENDING").toUpperCase(),
      date: inv.created_at || inv.date_acquired || new Date().toISOString(),
      remarks: inv.review_remarks,
    });
  });

  productions.slice(0, 5).forEach((prod) => {
    activities.push({
      id: `prod-${prod.id}`,
      type: "PRODUCTION",
      title: `${prod.production_type || "Production"} Logged`,
      description: `${prod.quantity} ${prod.unit || "Units"} • Recorded: ${prod.record_date || "Recent"}`,
      status: (prod.status || "PENDING").toUpperCase(),
      date: prod.created_at || prod.record_date || new Date().toISOString(),
      remarks: prod.review_remarks,
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
    });
  });

  // Sort activities newest first
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    cattle_count: totalHeads,
    approved_count: approvedHeads,
    pending_count: pendingHeads,
    avg_carcass_weight_kg: null,
    active_health_alerts: activeAlerts,
    milk_production_liters: hasMilkData ? currentMonthMilk : null,
    milk_growth_pct,
    cattle_trend: [],
    milk_trend,
    herd_categories,
    herd_subcategories,
    recent_activities: activities.slice(0, 8),
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
