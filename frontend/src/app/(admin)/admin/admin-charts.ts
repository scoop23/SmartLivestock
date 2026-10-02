import { useAuth } from "@/contexts/auth-context";
import { municipalRead } from "@/lib/municipal-read";
import { type PopulationSummary, speciesCategories } from "@/lib/population-metrics";
import { useQuery } from "@tanstack/react-query";
import { getSpeciesColor } from "@/lib/species-colors";

// ─────────────────────────────────────────────────────────────
// 1. DOMAIN & BACKEND MODEL ALIGNED INTERFACES
// ─────────────────────────────────────────────────────────────

/**
 * Aligned with backend `livestock.models.Barangay` (17 Barangays of Padre Garcia)
 */
export const PADRE_GARCIA_BARANGAYS = [
  "Banaba",
  "Manggas",
  "Pansol",
  "Cawongan",
  "Banay-Banay",
  "Bawi",
  "San Miguel",
  "Bukal",
  "San Felipe",
  "Maugat West",
  "Tamak",
  "Quilo Quilo North",
  "Quilo Quilo South",
  "Castillo",
  "Maugat East",
  "Payapa",
  "Tangob",
] as const;

export type PadreGarciaBarangay = (typeof PADRE_GARCIA_BARANGAYS)[number];

/**
 * Aligned with backend `livestock.models.LivestockType`
 */
export interface LivestockType {
  id: number;
  name: string;
  description?: string;
}

/**
 * Aligned with backend `livestock.models.Barangay`
 */
export interface BarangayItem {
  id: number;
  barangay_name: string;
  latitude?: string | number;
  longitude?: string | number;
  description?: string;
}

/**
 * Aligned with backend `livestock.models.LivestockInventory`
 * choices: EntryType (INDIVIDUAL, BATCH), StatusType (PENDING, APPROVED, REJECTED)
 */
export interface AdminInventoryItem {
  id: string;
  farmerId: number | null;
  farmerName: string;
  barangayId: number | null;
  barangayName: string;
  livestockTypeId: number;
  livestockTypeName: string;
  entryType: "INDIVIDUAL" | "BATCH";
  quantity: number;
  tagNumber: string;
  breed: string;
  sex: string;
  weight: number | null;
  lastVaccinationDate: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  operationalStatus: string;
  createdAt: string;
}

export interface AdminInventoryApiItem {
  id: number | string;
  farmer?: number | null;
  farmer_name?: string;
  barangay_id?: number | null;
  barangay_name?: string;
  livestock_type: number;
  livestock_type_name?: string;
  entry_type: "INDIVIDUAL" | "BATCH";
  quantity: number;
  tag_number?: string;
  breed?: string;
  sex?: string;
  weight?: number | string | null;
  last_vaccination_date?: string | null;
  status?: string;
  operational_status?: string;
  created_at?: string;
}

/**
 * Aligned with backend `livestock.models.CensusSubmission` and `CensusSubmissionItem`
 */
export interface CensusItem {
  id: number;
  farmerId: number;
  farmerName: string;
  farmerAddress: string;
  livestockTypeId: number;
  livestockTypeName: string;
  numberOfHeads: number;
  remarks: string;
}

export interface CensusSubmissionItem {
  id: number;
  barangayId: number;
  barangayName: string;
  reportYear: number;
  reportQuarter: number;
  status: string;
  submissionDate: string;
  submittedByName: string;
  remarks: string;
  reviewRemarks?: string | null;
  items: CensusItem[];
}

export interface CensusSubmissionApiItem {
  id: number;
  barangay: number;
  barangay_name?: string;
  report_year: number;
  report_quarter: number;
  status: string;
  submission_date: string;
  submitted_by_name?: string;
  remarks?: string;
  review_remarks?: string | null;
  items?: {
    id: number;
    census_submission?: number;
    farmer: number;
    farmer_name?: string;
    farmer_address?: string;
    livestock_type: number;
    livestock_type_name?: string;
    number_of_heads: number;
    remarks?: string;
  }[];
}

/**
 * Aligned with backend `production.models.ProductionRecord`
 * choices: ProductionType (MILK, EGGS, WOOL), UnitType (LITERS, PIECES, KILOGRAMS)
 */
export interface ProductionRecordItem {
  id: number;
  barangayName: string;
  livestockId: number;
  farmerName: string;
  livestockTypeName: string;
  productionType: "MILK" | "EGGS" | "WOOL" | string;
  quantity: number;
  unit: "LITERS" | "PIECES" | "KILOGRAMS" | string;
  recordDate: string;
  notes: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED" | string;
  reviewRemarks: string | null;
  createdAt: string;
}

export interface ProductionRecordApiItem {
  id: number;
  barangay_name?: string;
  livestock: number;
  farmer_name?: string;
  livestock_type_name?: string;
  production_type: string;
  quantity: number | string;
  unit: string;
  record_date: string;
  notes?: string;
  status: string;
  review_remarks?: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 2. CHART DATA STRUCTURES
// ─────────────────────────────────────────────────────────────

export interface BarangayHerdChartData {
  barangay: string;
  cattle: number;
  carabao: number;
  swine: number;
  goat: number;
  other: number;
  total: number;
}

export interface SpecieCompositionChartData {
  name: string;
  value: number;
  color: string;
  percentage?: string;
}

export interface MonthlyProductionChartData {
  month: string;
  label: string;
  milk: number;
  meat: number;
}

export interface BiosecuritySurveillanceChartData {
  month: string;
  label: string;
  reported: number;
  deaths: number;
}

export interface SectorComplianceChartData {
  sector: string;
  rate: number;
}

export interface AdminAnalyticsMetrics {
  totalLivestock: number;
  monthlyDairyYieldL: number;
  biosecurityAlerts: number;
  registeredFarmers: number;
  totalBarangaysCount: number;
  barangayHerdDistribution: BarangayHerdChartData[];
  specieComposition: SpecieCompositionChartData[];
  monthlyProduction: MonthlyProductionChartData[];
  surveillanceTrends: BiosecuritySurveillanceChartData[];
  sectorCompliance: SectorComplianceChartData[];
  vaccinationTotals: { vaccinated: number; total: number };
}

// Aligned with backend `analytics` app `dashboard_summary` response
export interface ProductionSeriesPoint {
  month: string;
  label: string;
  milk_l: number;
  meat_kg: number;
}

export interface SurveillanceSeriesPoint {
  month: string;
  label: string;
  reported_heads?: number;
  affected_heads?: number;
  deaths: number;
}

export interface VaccinationCoveragePoint {
  barangay: string;
  total: number;
  vaccinated: number;
  coverage_pct: number;
}

export interface VaccinationTotals {
  vaccinated: number;
  total: number;
}

export interface DashboardAnalytics {
  descriptive: { population: PopulationSummary };
  monthly_dairy_yield_l: number;
  year_to_date_l?: number;
  records_this_month?: number;
  period?: string;
  production_series: ProductionSeriesPoint[];
  surveillance_series: SurveillanceSeriesPoint[];
  vaccination_coverage: VaccinationCoveragePoint[];
  vaccination_totals: VaccinationTotals;
}

// ─────────────────────────────────────────────────────────────
// 3. API MAPPERS (Backend DB Schema -> Frontend Domain)
// ─────────────────────────────────────────────────────────────

export const mapAdminInventory = (item: AdminInventoryApiItem): AdminInventoryItem => ({
  id: String(item.id),
  farmerId: item.farmer ?? null,
  farmerName: item.farmer_name?.trim() || "Registered Farmer",
  barangayId: item.barangay_id ?? null,
  barangayName: item.barangay_name?.trim() || "Padre Garcia",
  livestockTypeId: Number(item.livestock_type) || 1,
  livestockTypeName: item.livestock_type_name?.trim() || "Cattle",
  entryType: item.entry_type || "BATCH",
  quantity: Math.max(1, Number(item.quantity) || 1),
  tagNumber: item.tag_number || "N/A",
  breed: item.breed || "Standard",
  sex: item.sex || "Mixed",
  weight: item.weight !== null && item.weight !== undefined && item.weight !== "" ? Number(item.weight) : null,
  lastVaccinationDate: item.last_vaccination_date || null,
  operationalStatus: item.operational_status || "ACTIVE",
  status: item.status || "APPROVED",
  createdAt: item.created_at || new Date().toISOString(),
});

export const mapCensusSubmission = (item: CensusSubmissionApiItem): CensusSubmissionItem => ({
  id: item.id,
  barangayId: item.barangay,
  barangayName: item.barangay_name?.trim() || "Padre Garcia",
  reportYear: item.report_year,
  reportQuarter: item.report_quarter,
  status: item.status,
  submissionDate: item.submission_date,
  submittedByName: item.submitted_by_name?.trim() || "SIBAT Enumerator",
  remarks: item.remarks || "",
  reviewRemarks: item.review_remarks,
  items: (item.items || []).map((subItem) => ({
    id: subItem.id,
    farmerId: subItem.farmer,
    farmerName: subItem.farmer_name?.trim() || "Farmer",
    farmerAddress: subItem.farmer_address?.trim() || "",
    livestockTypeId: subItem.livestock_type,
    livestockTypeName: subItem.livestock_type_name?.trim() || "Cattle",
    numberOfHeads: Number(subItem.number_of_heads) || 0,
    remarks: subItem.remarks || "",
  })),
});

export const mapProductionRecord = (item: ProductionRecordApiItem): ProductionRecordItem => ({
  id: item.id,
  barangayName: item.barangay_name?.trim() || "Padre Garcia",
  livestockId: item.livestock,
  farmerName: item.farmer_name?.trim() || "Dairy Farmer",
  livestockTypeName: item.livestock_type_name?.trim() || "Cattle",
  productionType: item.production_type || "MILK",
  quantity: Number(item.quantity) || 0,
  unit: item.unit || "LITERS",
  recordDate: item.record_date,
  notes: item.notes || "",
  status: item.status || "APPROVED",
  reviewRemarks: item.review_remarks || null,
  createdAt: item.created_at,
});

// ─────────────────────────────────────────────────────────────
// 4. API FETCHERS
// ─────────────────────────────────────────────────────────────

export async function fetchLivestockTypesList(): Promise<LivestockType[]> {
  return (await municipalRead<LivestockType[]>("livestock/livestock_types/")).data;
}

export async function fetchBarangaysList(): Promise<BarangayItem[]> {
  return (await municipalRead<BarangayItem[]>("livestock/barangays/")).data;
}

export async function fetchAdminInventory(): Promise<AdminInventoryItem[]> {
  return (await municipalRead<AdminInventoryApiItem[]>("livestock/inventory/")).data.map(mapAdminInventory);
}

export async function fetchAdminCensus(): Promise<CensusSubmissionItem[]> {
  return (await municipalRead<CensusSubmissionApiItem[]>("livestock/census/")).data.map(mapCensusSubmission);
}

export async function fetchAdminProduction(): Promise<ProductionRecordItem[]> {
  return (await municipalRead<ProductionRecordApiItem[]>("production/records/")).data.map(mapProductionRecord);
}

export async function fetchDashboardAnalytics(signal?: AbortSignal): Promise<DashboardAnalytics> {
  return (await municipalRead<DashboardAnalytics>("analytics/dashboard/", { signal })).data;
}

// ─────────────────────────────────────────────────────────────
// 5. ACCURATE DATA AGGREGATION & ANALYTICS TRANSFORMER
// ─────────────────────────────────────────────────────────────

// (SPECIE_COLOR_PALETTE and normalizeSpecieCategory are imported from @/lib/species-colors)

/** Display backend aggregates; never reconstruct population from record lists. */
export function computeAdminAnalytics(summary?: DashboardAnalytics | null): AdminAnalyticsMetrics {
  const population = summary?.descriptive.population;
  const totalLivestock = population?.total_heads ?? 0;
  return {
    totalLivestock,
    registeredFarmers: population?.registered_farmers ?? 0,
    totalBarangaysCount: population?.barangay_count ?? 0,
    biosecurityAlerts: population?.pending_inventory_records ?? 0,
    monthlyDairyYieldL: summary?.monthly_dairy_yield_l ?? 0,
    barangayHerdDistribution: (population?.by_barangay ?? []).map((row) => {
      const counts = speciesCategories(row.species);
      return {
        barangay: row.barangay,
        cattle: counts.cattle,
        carabao: counts.carabao,
        swine: counts.swine,
        goat: counts.goat + counts.sheep,
        // Poultry heads roll into "other" rather than getting their own stacked
        // series, matching overviewBarangays() in @/lib/population-metrics.
        other: counts.other + counts.poultry,
        total: row.heads,
      };
    }).sort((a, b) => b.total - a.total || a.barangay.localeCompare(b.barangay)).slice(0, 7),
    specieComposition: (population?.by_species ?? []).map((row) => ({
      name: row.species, value: row.heads, color: getSpeciesColor(row.species),
      percentage: totalLivestock ? `${(row.heads / totalLivestock * 100).toFixed(1)}%` : "0%",
    })),
    monthlyProduction: (summary?.production_series ?? []).map((row) => ({
      month: row.month, label: row.label, milk: row.milk_l, meat: row.meat_kg,
    })),
    surveillanceTrends: (summary?.surveillance_series ?? []).map((row) => ({
      month: row.month, label: row.label, reported: row.affected_heads ?? row.reported_heads ?? 0, deaths: row.deaths,
    })),
    sectorCompliance: (summary?.vaccination_coverage ?? []).map((row) => ({ sector: row.barangay, rate: row.coverage_pct })),
    vaccinationTotals: summary?.vaccination_totals ?? { vaccinated: 0, total: 0 },
  };
}

export const ADMIN_CHARTS_QUERY_KEYS = {
  types: ["admin", "livestock-types"] as const,
  barangays: ["admin", "barangays"] as const,
  inventory: ["admin", "inventory"] as const,
  census: ["admin", "census"] as const,
  production: ["admin", "production"] as const,
  analytics: ["admin", "analytics"] as const,
  dashboard: ["admin", "analytics", "dashboard"] as const,
};

export function useAdminLivestockTypes() {
  return useQuery<LivestockType[]>({
    queryKey: ADMIN_CHARTS_QUERY_KEYS.types,
    queryFn: fetchLivestockTypesList,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminBarangays() {
  return useQuery<BarangayItem[]>({
    queryKey: ADMIN_CHARTS_QUERY_KEYS.barangays,
    queryFn: fetchBarangaysList,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAdminInventory() {
  return useQuery<AdminInventoryItem[]>({
    queryKey: ADMIN_CHARTS_QUERY_KEYS.inventory,
    queryFn: fetchAdminInventory,
    staleTime: 60 * 1000,
  });
}

export function useAdminCensus() {
  return useQuery<CensusSubmissionItem[]>({
    queryKey: ADMIN_CHARTS_QUERY_KEYS.census,
    queryFn: fetchAdminCensus,
    staleTime: 60 * 1000,
  });
}

export function useAdminProduction() {
  return useQuery<ProductionRecordItem[]>({
    queryKey: ADMIN_CHARTS_QUERY_KEYS.production,
    queryFn: fetchAdminProduction,
    staleTime: 60 * 1000,
  });
}

export function useAdminDashboardSummary() {
  const { user } = useAuth();
  return useQuery<DashboardAnalytics>({
    queryKey: [...ADMIN_CHARTS_QUERY_KEYS.dashboard, user?.email, user?.accessScope, user?.assignedBarangayId],
    queryFn: ({ signal }) => fetchDashboardAnalytics(signal),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * Unified Hook for Admin Dashboard Visualizations and Executive Analytics
 */
export function useAdminDashboardAnalytics() {
  const dashboardSummaryQuery = useAdminDashboardSummary();
  return {
    data: computeAdminAnalytics(dashboardSummaryQuery.data),
    isLoading: dashboardSummaryQuery.isLoading, isFetching: dashboardSummaryQuery.isFetching,
    isError: dashboardSummaryQuery.isError, refetchAll: () => dashboardSummaryQuery.refetch(),
    dashboardSummaryQuery,
  };
}
