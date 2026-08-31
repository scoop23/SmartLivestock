// ---------------------------------------------------------------------------
// SIBAT Livestock Analytics & Types
//
// Shared types, constants, mock data, and analytics helper functions
// for the SIBAT Field Officer / Cooperative Portal.
// ---------------------------------------------------------------------------

import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import { LivestockType } from "@/app/(farmer)/livestock-inventory/page";
import { map } from "leaflet";

// ── Types: Census Submissions ──

export type CensusStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CensusItemEntry {
  id: string;
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
  reviewRemarks?: string;
  items: CensusItemEntry[];
}

export interface ApiCensusSubmissionItem {
  id: number;
  farmer: number;
  farmer_name: string;
  livestock_type: number;
  livestock_type_name?: string;
  number_of_heads: number;
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
  review_remarks?: string;
  items: ApiCensusSubmissionItem[];
}
// ── Types: Create Census Payload (what we POST to Django) ──

export interface CreateCensusItemPayload {
  farmer: number;
  livestock_type: number;
  number_of_heads: number;
  remarks?: string;
}

export interface CreateCensusPayload {
  barangay: number;
  report_year: number;
  report_quarter: number;
  items: CreateCensusItemPayload[];
}


export const mapCensusSubmission = (item: ApiCensusSubmission): CensusSubmissionRecord => {
  const items = item.items || [];
  const totalHeads = items.reduce((sum, i) => {
    return sum + (Number(i.number_of_heads) || 0);
  }, 0)
  const uniqueFarmers = new Set(items.map((i) => i.farmer)).size;

  return {
    id: item.id,
    barangay: item.barangay_name || `Barangay ${item.barangay}`,
    reportYear: item.report_year,
    reportQuarter: item.report_quarter,
    status: item.status,
    submissionDate: item.submission_date,
    submittedBy: item.submitted_by_name || "SIBAT Officer",
    reviewRemarks: item.review_remarks || "",
    totalHeads: totalHeads,
    totalFarmers: uniqueFarmers || items.length,
    items: items.map((subItem) => ({
      id: String(subItem.id),
      farmerName: subItem.farmer_name || `Farmer #${subItem.farmer}`,
      purok: "",
      livestockType: subItem.livestock_type_name || `Type #${subItem.livestock_type}`,
      numberOfHeads: subItem.number_of_heads,
      remarks: "",
    })),
  };
};

export async function fetchCensusSubmissions(): Promise<CensusSubmissionRecord[]> {
  const response = await api.get("livestock/get_submissions/");
  return (response.data as ApiCensusSubmission[]).map(mapCensusSubmission);
}

export function useCensusSubmission() {
  return useQuery({
    queryKey: ["census-subsmissions"],
    queryFn: fetchCensusSubmissions,
    staleTime: 60_000,
  })
}
// ── Types: Farmer Daily Reports & Activity ──

export type FarmerActivityType =
  | "Mortality Report"
  | "Production Update"
  | "Disease Report"
  | "Slaughter Record"
  | "Inventory Update"
  | string;

export type FarmerActivityStatus = "pending" | "validated";

export interface FarmerActivityRecord {
  id: number;
  farmer: string;
  type: FarmerActivityType;
  breed: string;
  count: number;
  date: string;
  status: FarmerActivityStatus;
}

export interface APIFarmerBarangayRecord { // interface for when getting the farmer's in a barangay
  id: number;
  farmer_name: string;
  barangay_name: string;
  barangay: number;
  farm_size?: string | number | null;
  address: string;
  registered_at: string;
}

export interface FarmerOptionItem {
  farmerName: string;
  id: number;
  barangayName: string;
  address: string;
}

export async function fetchFarmersByBarangay(barangayId: number | null) {
  const response = await api.get(`livestock/farmers/${barangayId}`);
  return (response.data as APIFarmerBarangayRecord);
}

export function useFarmersByBarangay(barangayId: number | null) {
  return useQuery({
    queryKey: ["farmers-by-barangay"],
    queryFn: () => fetchFarmersByBarangay(barangayId),
    enabled: Boolean(barangayId),
    staleTime: 60_000,
  });
}

// ── Types: UI & Navigation ──
export type SectionTab = "records" | "census";
export type TabKey = "pending" | "validated" | "all";

export interface TabChipConfig {
  value: TabKey;
  label: string;
  activeClass: string;
  dotClass: string;
}

export interface LivestockTypeOption {
  name: string;
  emoji: string;
  color: string;
}

// ── Constants ──

export const TAB_CHIPS: TabChipConfig[] = [
  {
    value: "all",
    label: "All Records",
    activeClass: "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20",
    dotClass: "bg-slate-400",
  },
  {
    value: "pending",
    label: "Pending",
    activeClass: "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25",
    dotClass: "bg-amber-500",
  },
  {
    value: "validated",
    label: "Validated",
    activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25",
    dotClass: "bg-emerald-500",
  },
];

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

interface ApiBarangayRecord {
  id: number;
  barangay_name: string;
};

interface BarangayRecord {
  id: number;
  barangayName: string;
};

const mapBarangayRecord = (item: ApiBarangayRecord): BarangayRecord => ({
  id: item.id,
  barangayName: item.barangay_name
});


export async function fetchBarangays() {
  const response = await api.get("livestock/barangays/")
  return (response.data as ApiBarangayRecord[]).map(mapBarangayRecord);
};

// HOOK

export function useGetBarangays() {
  return useQuery({
    queryKey: ["barangay-records"],
    queryFn: fetchBarangays,
    staleTime: 60_000,
  });
};


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

export const RECORD_TYPE_BADGE_MAP: Record<string, { bg: string; text: string }> = {
  "Mortality Report": { bg: "bg-rose-100 border-rose-200", text: "text-rose-800" },
  "Production Update": { bg: "bg-blue-100 border-blue-200", text: "text-blue-800" },
  "Disease Report": { bg: "bg-red-100 border-red-200", text: "text-red-800" },
  "Slaughter Record": { bg: "bg-orange-100 border-orange-200", text: "text-orange-800" },
  "Inventory Update": { bg: "bg-emerald-100 border-emerald-200", text: "text-emerald-800" },
};

export const getTypeBadgeStyle = (type: string) => {
  return RECORD_TYPE_BADGE_MAP[type] ?? { bg: "bg-slate-100 border-slate-200", text: "text-slate-800" };
};



// ── Mock Data: Farmer Activity Records ──


export const MOCK_PENDING_RECORDS: FarmerActivityRecord[] = [

  { id: 2, farmer: "Maria Santos", type: "Production Update", breed: "Holstein-Friesian", count: 3, date: "2026-04-25", status: "pending" },
  { id: 3, farmer: "Pedro Reyes", type: "Disease Report", breed: "Native Cattle", count: 2, date: "2026-04-24", status: "pending" },
  { id: 4, farmer: "Rosa Garcia", type: "Slaughter Record", breed: "Crossbreed", count: 1, date: "2026-04-24", status: "pending" },
];

export const MOCK_VALIDATED_RECORDS: FarmerActivityRecord[] = [
  { id: 5, farmer: "Antonio Cruz", type: "Inventory Update", breed: "Brahman", count: 5, date: "2026-04-23", status: "validated" },
  { id: 6, farmer: "Luz Mendoza", type: "Production Update", breed: "Holstein-Friesian", count: 2, date: "2026-04-22", status: "validated" },
];

// ── Mock Data: Quarterly Census Submissions ──

export const MOCK_CENSUS_SUBMISSIONS: CensusSubmissionRecord[] = [
  {
    id: "CEN-2026-Q2-0081",
    barangay: "Brgy. Lipay",
    reportYear: 2026,
    reportQuarter: 2,
    status: "PENDING",
    submissionDate: "2026-04-25",
    submittedBy: "SIBAT Field Officer (Lipay)",
    totalHeads: 78,
    totalFarmers: 16,
    reviewRemarks: "Comprehensive Q2 inventory sweep across Purok 1 to Purok 5.",
    items: [
      { id: "c-1", farmerName: "Danilo Marasigan", purok: "Purok 1", livestockType: "Cattle (Baka)", numberOfHeads: 12, remarks: "Breeder cows" },
      { id: "c-2", farmerName: "Elena Vilia", purok: "Purok 2", livestockType: "Carabao (Kalabaw)", numberOfHeads: 6, remarks: "Working draft" },
      { id: "c-3", farmerName: "Ramon Castillo", purok: "Purok 3", livestockType: "Swine (Baboy)", numberOfHeads: 42, remarks: "Commercial pen" },
      { id: "c-4", farmerName: "Luzviminda Cruz", purok: "Purok 4", livestockType: "Goat (Kambing)", numberOfHeads: 18, remarks: "Meat type" },
    ],
  },
  {
    id: "CEN-2026-Q1-0043",
    barangay: "Brgy. Lipay",
    reportYear: 2026,
    reportQuarter: 1,
    status: "APPROVED",
    submissionDate: "2026-01-18",
    submittedBy: "SIBAT Field Officer (Lipay)",
    totalHeads: 64,
    totalFarmers: 14,
    reviewRemarks: "Validated and verified by MAO Batangas. Accurate head counts.",
    items: [
      { id: "c-5", farmerName: "Mariano Garcia", purok: "Purok 2", livestockType: "Cattle (Baka)", numberOfHeads: 10, remarks: "Native breed" },
      { id: "c-6", farmerName: "Teresa Hernandez", purok: "Purok 1", livestockType: "Carabao (Kalabaw)", numberOfHeads: 4, remarks: "Dairy cross" },
      { id: "c-7", farmerName: "Joaquin Bautista", purok: "Purok 5", livestockType: "Swine (Baboy)", numberOfHeads: 50, remarks: "Backyard piggery" },
    ],
  },
];



// ── Analytics Helpers ──

export const calculateTotalCensusHeads = (submissions: CensusSubmissionRecord[]): number => {
  return submissions.reduce((sum, c) => sum + (Number(c.totalHeads) || 0), 0);
};

export const calculateTotalCensusFarmers = (submissions: CensusSubmissionRecord[]): number => {
  return submissions.reduce((sum, c) => sum + (Number(c.totalFarmers) || 0), 0);
};
