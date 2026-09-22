// ---------------------------------------------------------------------------
// SIBAT Field Officer & Cooperative Analytics & Submissions
//
// Live data fetchers, query hooks, and review mutations for SIBAT validation.
// ---------------------------------------------------------------------------

import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchProductionRecords, type ProductionRecordItem } from "@/app/(farmer)/production-dashboard/production-analytics";
import type { SibatValidationRecord, SibatStatus, SibatInspectionData, SeverityLevel, BiosecurityAction } from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

// ── Types: Submission Statuses ──

export type UnifiedStatus = "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";

export type UnifiedSubmissionType = "ALL" | "PRODUCTION" | "INVENTORY";

export interface UnifiedSubmissionItem {
  id: string; // composite key e.g. "prod-1" or "inv-2"
  rawId: number;
  sourceType: "PRODUCTION" | "INVENTORY";
  submissionTypeLabel: string;
  farmerName: string;
  barangayName: string;
  livestockTypeName: string;
  detailsTitle: string;
  quantityDisplay: string;
  quantity: number;
  unit: string;
  recordDate: string;
  status: UnifiedStatus;
  notes?: string;
  breed?: string;
  tagNumber?: string;
  sex?: string;
  weight?: number | null;
  entryType?: "INDIVIDUAL" | "BATCH";
  reviewRemarks?: string | null;
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  createdAt: string;
}

// ── Raw Inventory Interface from API ──

export interface RawInventoryRecord {
  id: number;
  farmer_name?: string;
  barangay_name?: string;
  barangay_id?: number;
  livestock_type_name?: string;
  entry_type: "INDIVIDUAL" | "BATCH";
  quantity: number;
  tag_number?: string;
  breed?: string;
  sex?: string;
  weight?: number | null;
  last_vaccination_date?: string | null;
  status: UnifiedStatus;
  review_remarks?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  created_at: string;
}

// ── Raw Disease Case & Mortality Interfaces ──

export interface RawDiseaseCase {
  id: number;
  livestock: number;
  farmer_name?: string;
  tag_number?: string;
  livestock_type_name?: string;
  breed?: string;
  barangay_name?: string;
  barangay_id?: number;
  name: string;
  record_date: string;
  affected_count: number;
  treatment_given?: string;
  vaccine_name?: string;
  notes?: string;
  status: string;
  review_remarks?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  created_at: string;
}

export interface RawMortalityRecord {
  id: number;
  livestock: number;
  farmer_name?: string;
  tag_number?: string;
  livestock_type_name?: string;
  breed?: string;
  barangay_name?: string;
  barangay_id?: number;
  cause: string;
  death_count: number;
  record_date: string;
  remarks?: string;
  disposal_method?: string;
  status: string;
  review_remarks?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  created_at: string;
}

// ── Mappers ──

export const mapProductionToUnified = (p: ProductionRecordItem): UnifiedSubmissionItem => {
  const prodUnitMap: Record<string, string> = {
    milk: "L",
    meat: "kg",
    eggs: "pcs",
    wool: "kg",
  };
  const unitLabel = prodUnitMap[p.productionType] || p.unit || "units";
  const typeLabels: Record<string, string> = {
    milk: "Daily Milk Yield",
    meat: "Meat & Carcass Log",
    eggs: "Egg Collection Log",
    wool: "Wool Shearing Log",
  };

  return {
    id: `prod-${p.id}`,
    rawId: p.id,
    sourceType: "PRODUCTION",
    submissionTypeLabel: typeLabels[p.productionType] || "Production Yield",
    farmerName: p.farmerName || "Farmer",
    barangayName: p.barangayName || "General Sector",
    livestockTypeName: p.livestockTypeName || "Livestock",
    detailsTitle: `${p.livestockTypeName || "Livestock"} — ${typeLabels[p.productionType] || p.productionType}`,
    quantityDisplay: `${Number(p.quantity).toLocaleString()} ${unitLabel}`,
    quantity: p.quantity,
    unit: unitLabel,
    recordDate: p.recordDate,
    status: p.status as UnifiedStatus,
    notes: p.notes,
    reviewRemarks: p.reviewRemarks,
    createdAt: p.createdAt,
  };
};

export const mapInventoryToUnified = (inv: RawInventoryRecord): UnifiedSubmissionItem => {
  const isIndividual = inv.entry_type === "INDIVIDUAL";

  return {
    id: `inv-${inv.id}`,
    rawId: inv.id,
    sourceType: "INVENTORY",
    submissionTypeLabel: isIndividual ? "Animal Registration" : "Batch Registration",
    farmerName: inv.farmer_name || "Farmer",
    barangayName: inv.barangay_name || "General Sector",
    livestockTypeName: inv.livestock_type_name || "Livestock",
    detailsTitle: `${inv.livestock_type_name || "Livestock"} (${inv.entry_type})`,
    quantityDisplay: `${inv.quantity} ${inv.quantity === 1 ? "Head" : "Heads"}${inv.weight ? ` (${inv.weight} kg)` : ""}`,
    quantity: inv.quantity,
    unit: "Heads",
    recordDate: inv.created_at ? inv.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    status: inv.status,
    breed: inv.breed,
    tagNumber: inv.tag_number,
    sex: inv.sex,
    weight: inv.weight,
    entryType: inv.entry_type,
    reviewRemarks: inv.review_remarks,
    reviewedAt: inv.reviewed_at,
    reviewedByName: inv.reviewed_by_name,
    createdAt: inv.created_at,
  };
};

export const mapDiseaseCaseToValidation = (dc: RawDiseaseCase): SibatValidationRecord => {
  const statusNorm = (dc.status || "PENDING").toUpperCase() as SibatStatus;
  return {
    id: `DIS-${dc.id}`,
    reportType: "DISEASE",
    farmerName: dc.farmer_name || "Registered Farmer",
    barangayName: dc.barangay_name || "Padre Garcia",
    livestockTag: dc.tag_number || `TAG-${dc.livestock}`,
    livestockBreed: dc.breed || "Standard Breed",
    livestockType: dc.livestock_type_name || "Livestock",
    inventoryId: String(dc.livestock),
    name: dc.name || "Clinical Disease Case",
    reportedCount: dc.affected_count || 1,
    reportedDate: dc.record_date || (dc.created_at ? dc.created_at.slice(0, 10) : ""),
    reportedAt: dc.created_at || new Date().toISOString(),
    farmerSymptoms: [dc.name || "General Health Concern"],
    farmerDescription: dc.notes || `Reported condition: ${dc.name}. Treatment: ${dc.treatment_given || "None reported"}.`,
    status: statusNorm,
    inspection: dc.reviewed_by_name
      ? {
          verifiedBy: dc.reviewed_by_name,
          verifiedAt: dc.reviewed_at ? dc.reviewed_at.replace("T", " ").slice(0, 16) : "",
          tagConfirmed: true,
          confirmedCount: dc.affected_count || 1,
          confirmedSymptoms: [dc.name],
          severity: "MODERATE" as SeverityLevel,
          biosecurityAction: "PEN_ISOLATION" as BiosecurityAction,
          remarks: dc.review_remarks || "Verified on-farm by SIBAT field inspector.",
        }
      : undefined,
  };
};

export const mapMortalityToValidation = (m: RawMortalityRecord): SibatValidationRecord => {
  const statusNorm = (m.status || "PENDING").toUpperCase() as SibatStatus;
  return {
    id: `MOR-${m.id}`,
    reportType: "MORTALITY",
    farmerName: m.farmer_name || "Registered Farmer",
    barangayName: m.barangay_name || "Padre Garcia",
    livestockTag: m.tag_number || `TAG-${m.livestock}`,
    livestockBreed: m.breed || "Standard Breed",
    livestockType: m.livestock_type_name || "Livestock",
    inventoryId: String(m.livestock),
    name: m.cause || "Mortality Record",
    reportedCount: m.death_count || 1,
    reportedDate: m.record_date || (m.created_at ? m.created_at.slice(0, 10) : ""),
    reportedAt: m.created_at || new Date().toISOString(),
    farmerSymptoms: [m.cause || "Mortality"],
    farmerDescription: m.remarks || `Mortality cause: ${m.cause}. Disposal: ${m.disposal_method || "Burial"}.`,
    status: statusNorm,
    inspection: m.reviewed_by_name
      ? {
          verifiedBy: m.reviewed_by_name,
          verifiedAt: m.reviewed_at ? m.reviewed_at.replace("T", " ").slice(0, 16) : "",
          tagConfirmed: true,
          confirmedCount: m.death_count || 1,
          confirmedSymptoms: [m.cause],
          severity: "CRITICAL" as SeverityLevel,
          biosecurityAction: "BIOSECURE_BURIAL" as BiosecurityAction,
          remarks: m.review_remarks || "Verified on-farm by SIBAT field inspector.",
        }
      : undefined,
  };
};

// ── Types: Census Submissions ──

export type CensusStatus = "PENDING" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";

export interface CensusItemEntry {
  id: string;
  farmerId?: number | null;
  farmerName: string;
  purok: string;
  livestockType: string;
  numberOfHeads: number;
  remarks: string;
}

export interface CensusSubmissionRecord {
  id: string | number;
  barangay: string;
  reportYear: number;
  reportQuarter: number;
  status: CensusStatus;
  submissionDate: string;
  submittedBy: string;
  totalHeads: number;
  totalFarmers: number;
  remarks?: string;
  reviewRemarks?: string;
  items: CensusItemEntry[];
}

export interface ApiCensusSubmissionItem {
  id: number;
  farmer: number;
  farmer_name: string;
  farmer_address?: string;
  livestock_type: number;
  livestock_type_name?: string;
  number_of_heads: number;
  remarks?: string;
}

export interface ApiCensusSubmission {
  id: number;
  barangay: number;
  barangay_name?: string;
  report_year: number;
  report_quarter: number;
  status: CensusStatus;
  submission_date: string;
  submitted_by_name?: string;
  remarks?: string;
  review_remarks?: string;
  items: ApiCensusSubmissionItem[];
}

export interface CreateCensusItemPayload {
  farmer: number | null;
  livestock_type: number;
  number_of_heads: number;
  remarks?: string;
}

export interface CreateCensusPayload {
  barangay: number;
  report_year: number;
  report_quarter: number;
  remarks?: string;
  items: CreateCensusItemPayload[];
}

export const mapCensusSubmission = (item: ApiCensusSubmission): CensusSubmissionRecord => {
  const items = item.items || [];
  const totalHeads = items.reduce((sum, i) => sum + (Number(i.number_of_heads) || 0), 0);
  const uniqueFarmers = new Set(items.map((i) => i.farmer)).size;

  return {
    id: item.id,
    barangay: item.barangay_name || `Barangay ${item.barangay}`,
    reportYear: item.report_year,
    reportQuarter: item.report_quarter,
    status: item.status,
    submissionDate: item.submission_date,
    submittedBy: item.submitted_by_name || "SIBAT Officer",
    remarks: item.remarks || "",
    reviewRemarks: item.review_remarks || "",
    totalHeads: totalHeads,
    totalFarmers: uniqueFarmers || items.length,
    items: items.map((subItem) => ({
      id: String(subItem.id),
      farmerName: subItem.farmer_name || `Farmer #${subItem.farmer}`,
      purok: subItem.farmer_address || "",
      livestockType: subItem.livestock_type_name || `Type #${subItem.livestock_type}`,
      numberOfHeads: subItem.number_of_heads,
      remarks: subItem.remarks || "",
    })),
  };
};

// ── API Fetchers ──

export async function fetchCensusSubmissions(): Promise<CensusSubmissionRecord[]> {
  const response = await api.get("livestock/census/");
  return (response.data as ApiCensusSubmission[]).map(mapCensusSubmission);
}

export async function fetchRawInventory(): Promise<RawInventoryRecord[]> {
  const response = await api.get("livestock/inventory/");
  return response.data as RawInventoryRecord[];
}

export async function fetchDiseaseCases(): Promise<RawDiseaseCase[]> {
  const response = await api.get("diseases/cases/");
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchMortalityRecords(): Promise<RawMortalityRecord[]> {
  const response = await api.get("diseases/mortality/");
  return Array.isArray(response.data) ? response.data : [];
}

// ── Hooks ──

export function useCensusSubmission() {
  return useQuery({
    queryKey: ["census-submissions"],
    queryFn: fetchCensusSubmissions,
    staleTime: 60_000,
  });
}

export function useProductionFromFarmers() {
  return useQuery({
    queryKey: ["sibat-production-records"],
    queryFn: fetchProductionRecords,
    staleTime: 30_000,
  });
}

export function useInventoryFromFarmers() {
  return useQuery({
    queryKey: ["sibat-inventory-records"],
    queryFn: fetchRawInventory,
    staleTime: 30_000,
  });
}

export function useDiseaseCases() {
  return useQuery({
    queryKey: ["sibat-validation-cases"],
    queryFn: fetchDiseaseCases,
    staleTime: 30_000,
  });
}

export function useMortalityRecords() {
  return useQuery({
    queryKey: ["sibat-validation-mortality"],
    queryFn: fetchMortalityRecords,
    staleTime: 30_000,
  });
}

export function useClinicalHealthRecords() {
  const casesQuery = useDiseaseCases();
  const mortQuery = useMortalityRecords();

  const isLoading = casesQuery.isLoading || mortQuery.isLoading;
  const isError = casesQuery.isError || mortQuery.isError;
  const refetch = () => {
    casesQuery.refetch();
    mortQuery.refetch();
  };

  const casesMapped = (casesQuery.data || []).map(mapDiseaseCaseToValidation);
  const mortMapped = (mortQuery.data || []).map(mapMortalityToValidation);

  const allRecords: SibatValidationRecord[] = [...casesMapped, ...mortMapped].sort(
    (a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
  );

  return {
    records: allRecords,
    isLoading,
    isError,
    refetch,
  };
}

export function useSibatSubmissions() {
  const prodQuery = useProductionFromFarmers();
  const invQuery = useInventoryFromFarmers();

  const isLoading = prodQuery.isLoading || invQuery.isLoading;
  const isError = prodQuery.isError || invQuery.isError;
  const refetch = () => {
    prodQuery.refetch();
    invQuery.refetch();
  };

  const productionUnified = (prodQuery.data || []).map(mapProductionToUnified);
  const inventoryUnified = (invQuery.data || []).map(mapInventoryToUnified);

  const allSubmissions: UnifiedSubmissionItem[] = [
    ...productionUnified,
    ...inventoryUnified,
  ].sort((a, b) => new Date(b.createdAt || b.recordDate).getTime() - new Date(a.createdAt || a.recordDate).getTime());

  return {
    submissions: allSubmissions,
    isLoading,
    isError,
    refetch,
  };
}

// ── Mutation: Review / Verify Submissions ──

export function useReviewSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      item,
      status,
      remarks,
    }: {
      item: UnifiedSubmissionItem;
      status: "VERIFIED" | "SUBJECT_TO_REVISION" | "REJECTED";
      remarks: string;
    }) => {
      const endpoint =
        item.sourceType === "PRODUCTION"
          ? `production/records/${item.rawId}/review/`
          : `livestock/inventory/${item.rawId}/review/`;

      const response = await api.post(endpoint, {
        status,
        remarks,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sibat-production-records"] });
      queryClient.invalidateQueries({ queryKey: ["sibat-inventory-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
      queryClient.invalidateQueries({ queryKey: ["sibat-validation-production"] });
    },
  });
}

export function useReviewClinicalHealth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordId,
      action,
      inspectionData,
    }: {
      recordId: string;
      action: "VERIFIED" | "FLAGGED" | "FALSE_ALARM";
      inspectionData: SibatInspectionData;
    }) => {
      const isDisease = recordId.startsWith("DIS-");
      const cleanId = recordId.replace(/^(DIS|MOR)-/, "");
      const reviewStatus = action === "VERIFIED" ? "VERIFIED" : "SUBJECT_TO_REVISION";

      const formattedRemarks = [
        inspectionData.remarks,
        inspectionData.severity ? `[Severity: ${inspectionData.severity}]` : "",
        inspectionData.biosecurityAction && inspectionData.biosecurityAction !== "NONE"
          ? `[Action: ${inspectionData.biosecurityAction}]`
          : "",
        inspectionData.temperatureCelsius ? `[Temp: ${inspectionData.temperatureCelsius}°C]` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const endpoint = isDisease ? `diseases/cases/${cleanId}/review/` : `diseases/mortality/${cleanId}/review/`;

      const response = await api.post(endpoint, {
        status: reviewStatus,
        remarks: formattedRemarks,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sibat-validation-cases"] });
      queryClient.invalidateQueries({ queryKey: ["sibat-validation-mortality"] });
      queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
      queryClient.invalidateQueries({ queryKey: ["disease-cases"] });
      queryClient.invalidateQueries({ queryKey: ["mortality-records"] });
    },
  });
}

// ── Barangay Helpers ──

export interface APIFarmerBarangayRecord {
  id: number;
  farmer_name: string;
  barangay_name: string;
  barangay: number;
  farm_size?: string | number | null;
  address: string;
  registered_at: string;
}

export interface FarmerOptionItem {
  farmerId: number;
  farmerName: string;
  barangayName: string;
  address: string;
}

export const mappedFarmersByBarangay = (farmersByBarangay: APIFarmerBarangayRecord): FarmerOptionItem => ({
  farmerId: farmersByBarangay.id,
  farmerName: farmersByBarangay.farmer_name,
  barangayName: farmersByBarangay.barangay_name,
  address: farmersByBarangay.address,
});

export async function fetchFarmersByBarangay(barangayId: number | null) {
  const response = await api.get(`livestock/farmers/${barangayId}/`);
  return (response.data as APIFarmerBarangayRecord[]).map(mappedFarmersByBarangay);
}

export function useFarmersByBarangay(barangayId: number | null) {
  return useQuery({
    queryKey: ["farmers-by-barangay", barangayId],
    queryFn: () => fetchFarmersByBarangay(barangayId),
    enabled: Boolean(barangayId),
    staleTime: 60_000,
  });
}

interface ApiBarangayRecord {
  id: number;
  barangay_name: string;
}

interface BarangayRecord {
  id: number;
  barangayName: string;
}

const mapBarangayRecord = (item: ApiBarangayRecord): BarangayRecord => ({
  id: item.id,
  barangayName: item.barangay_name,
});

export async function fetchBarangays() {
  const response = await api.get("livestock/barangays/");
  return (response.data as ApiBarangayRecord[]).map(mapBarangayRecord);
}

export function useGetBarangays() {
  return useQuery({
    queryKey: ["barangay-records"],
    queryFn: fetchBarangays,
    staleTime: 60_000,
  });
}

export const calculateTotalCensusHeads = (submissions: CensusSubmissionRecord[]): number => {
  return submissions.reduce((sum, c) => sum + (Number(c.totalHeads) || 0), 0);
};

export const calculateTotalCensusFarmers = (submissions: CensusSubmissionRecord[]): number => {
  return submissions.reduce((sum, c) => sum + (Number(c.totalFarmers) || 0), 0);
};

export const PADRE_GARCIA_BARANGAYS: string[] = [
  "Lipay",
  "Banaba",
  "Banaybanay",
  "Bawi",
  "Bukal",
  "Castillo",
  "Cawongan",
  "Manggas",
  "Maugat East",
  "Maugat West",
  "Poblacion",
  "Quilo-quilo",
  "San Briccio",
  "San Miguel",
  "Santa Maria",
  "Tangob",
];

export interface LivestockTypeOption {
  name: string;
  emoji: string;
  color: string;
}

export const LIVESTOCK_TYPES: LivestockTypeOption[] = [
  { name: "Cattle (Baka)", emoji: "🐂", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { name: "Carabao (Kalabaw)", emoji: "🐃", color: "text-slate-700 bg-slate-100 border-slate-200" },
  { name: "Swine (Baboy)", emoji: "🐖", color: "text-rose-700 bg-rose-50 border-rose-200" },
  { name: "Goat (Kambing)", emoji: "🐐", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { name: "Sheep (Tupa)", emoji: "🐑", color: "text-sky-700 bg-sky-50 border-sky-200" },
  { name: "Poultry (Manok/Pato)", emoji: "🐓", color: "text-orange-700 bg-orange-50 border-orange-200" },
];

export const SAMPLE_CENSUS_ENTRIES: CensusItemEntry[] = [
  { id: "s-1", farmerName: "Danilo Marasigan", purok: "Purok 1", livestockType: "Cattle (Baka)", numberOfHeads: 4, remarks: "Breeder herd" },
  { id: "s-2", farmerName: "Elena Vilia", purok: "Purok 2", livestockType: "Carabao (Kalabaw)", numberOfHeads: 2, remarks: "Draft / working animals" },
  { id: "s-3", farmerName: "Ramon Castillo", purok: "Purok 3", livestockType: "Swine (Baboy)", numberOfHeads: 15, remarks: "Fattening pens" },
  { id: "s-4", farmerName: "Luzviminda Cruz", purok: "Purok 1", livestockType: "Goat (Kambing)", numberOfHeads: 6, remarks: "Backyard raiser" },
];
