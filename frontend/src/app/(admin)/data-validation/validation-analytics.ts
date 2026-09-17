"use client";

import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import {
  CensusSubmissionRecord,
  mapCensusSubmission,
  ApiCensusSubmission,
  MOCK_CENSUS_SUBMISSIONS,
} from "@/app/(sibat)/sibat/sibat-analytics";
import {
  ProductionRecordItem,
  mapProductionRecord,
  ApiProductionRecord,
} from "@/app/(farmer)/production-dashboard/production-analytics";

// ── Types: Validation Domains ──

export type ValidationDomain = "census" | "production" | "inventory" | "incidents";

export type ValidationStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export interface ValidationDomainConfig {
  id: ValidationDomain;
  label: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
}

export const VALIDATION_DOMAINS: ValidationDomainConfig[] = [
  {
    id: "census",
    label: "Quarterly Census",
    shortLabel: "Census",
    badgeLabel: "Census Batches",
    description: "Quarterly barangay livestock head counts submitted by SIBAT field enumerators",
  },
  {
    id: "production",
    label: "Production Logs",
    shortLabel: "Yields",
    badgeLabel: "Yield Records",
    description: "Daily and periodic milk, egg, and wool production declarations certified by raisers",
  },
  {
    id: "inventory",
    label: "Livestock Inventory",
    shortLabel: "Inventory",
    badgeLabel: "Animal Tags",
    description: "Farmer animal registrations, ear tag assignments, breed specifications, and weights",
  },
  {
    id: "incidents",
    label: "Field Declarations",
    shortLabel: "Incidents",
    badgeLabel: "Disposals & Events",
    description: "Slaughter inspections, on-farm mortalities, certified births, and transfer/sales",
  },
];

// ── Types: Livestock Inventory Item for Validation ──

export interface ValidationInventoryItem {
  id: number;
  farmerName: string;
  barangayName: string;
  livestockType: string;
  tagNumber: string;
  breed: string;
  sex: string;
  weight: number | null;
  entryType: "INDIVIDUAL" | "BATCH";
  quantity: number;
  lastVaccinationDate: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewRemarks: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

// ── Types: Incident / Declaration Item ──

export type IncidentType = "disease" | "mortality" | "slaughter" | "birth" | "sale";

export interface SibatInspectionData {
  verifiedBy: string;
  verifiedAt: string;
  tagConfirmed: boolean;
  confirmedCount: number;
  confirmedSymptoms: string[];
  severity: string;
  biosecurityAction: string;
  remarks: string;
  temperatureCelsius?: number;
}

export interface ValidationIncidentItem {
  id: string;
  type: IncidentType;
  farmerName: string;
  barangayName: string;
  purok?: string;
  farmerContact?: string;
  details: string;
  date: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
  reviewRemarks: string | null;
  headCount?: number;
  weight?: string;
  tagNumber?: string;
  livestockBreed?: string;
  livestockType?: string;
  conditionName?: string;
  symptoms?: string[];
  photoName?: string;
  sibatInspection?: SibatInspectionData;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

// ── Mock / Seed Data ──

export const SEED_PRODUCTION_VALIDATION: ProductionRecordItem[] = [
  {
    id: 101,
    barangayName: "Banaba Ibaba",
    farmerName: "Danilo Marasigan",
    livestockId: 14,
    livestockTypeName: "Dairy Cattle",
    productionType: "milk",
    quantity: 28.5,
    unit: "LITERS",
    recordDate: "2026-09-04",
    notes: "Morning milking yield certified at cooperative collection chiller.",
    status: "PENDING",
    reviewRemarks: null,
    createdAt: "2026-09-04T07:15:00Z",
  },
  {
    id: 102,
    barangayName: "Lipay",
    farmerName: "Elena Vilia",
    livestockId: 22,
    livestockTypeName: "Swine / Sows",
    productionType: "wool",
    quantity: 12.0,
    unit: "KILOGRAMS",
    recordDate: "2026-09-03",
    notes: "Organic feed supplement trial cycle output batch.",
    status: "PENDING",
    reviewRemarks: null,
    createdAt: "2026-09-03T16:40:00Z",
  },
  {
    id: 103,
    barangayName: "San Roque",
    farmerName: "Ramon Castillo",
    livestockId: 35,
    livestockTypeName: "Layer Poultry",
    productionType: "eggs",
    quantity: 450,
    unit: "PIECES",
    recordDate: "2026-09-02",
    notes: "Purok 3 flock layer harvest, grade A eggs inspected.",
    status: "APPROVED",
    reviewRemarks: "Certified accurate by MAO Livestock Inspector.",
    createdAt: "2026-09-02T11:20:00Z",
  },
  {
    id: 104,
    barangayName: "Quilo-quilo",
    farmerName: "Pedro Garcia",
    livestockId: 19,
    livestockTypeName: "Dairy Carabao",
    productionType: "milk",
    quantity: 14.2,
    unit: "LITERS",
    recordDate: "2026-09-01",
    notes: "Calf nursing period finished; commercial raw milk collection.",
    status: "PENDING",
    reviewRemarks: null,
    createdAt: "2026-09-01T08:00:00Z",
  },
];

export const SEED_INVENTORY_VALIDATION: ValidationInventoryItem[] = [
  {
    id: 201,
    farmerName: "Mateo Dimaculangan",
    barangayName: "Castillo",
    livestockType: "Cattle",
    tagNumber: "PH-BTG-2026-091",
    breed: "Brahman Cross",
    sex: "Male",
    weight: 385,
    entryType: "INDIVIDUAL",
    quantity: 1,
    lastVaccinationDate: "2026-08-15",
    status: "PENDING",
    reviewRemarks: null,
    createdAt: "2026-09-03T09:30:00Z",
  },
  {
    id: 202,
    farmerName: "Luzviminda Cruz",
    barangayName: "Maugat",
    livestockType: "Goat",
    tagNumber: "PH-BTG-2026-104",
    breed: "Boer Cross",
    sex: "Female",
    weight: 42,
    entryType: "INDIVIDUAL",
    quantity: 1,
    lastVaccinationDate: "2026-08-20",
    status: "PENDING",
    reviewRemarks: null,
    createdAt: "2026-09-02T14:15:00Z",
  },
  {
    id: 203,
    farmerName: "Eduardo Santos",
    barangayName: "Banaba Ibaba",
    livestockType: "Swine",
    tagNumber: "BATCH-SW-26-04",
    breed: "Landrace / Large White",
    sex: "Mixed",
    weight: 75,
    entryType: "BATCH",
    quantity: 15,
    lastVaccinationDate: "2026-08-10",
    status: "APPROVED",
    reviewRemarks: "Verified by CBAT Animal Health Officer.",
    createdAt: "2026-08-28T10:00:00Z",
  },
  {
    id: 204,
    farmerName: "Carmen Villanueva",
    barangayName: "Lipay",
    livestockType: "Carabao",
    tagNumber: "PH-BTG-2026-118",
    breed: "Philippine Native Carabao",
    sex: "Female",
    weight: 420,
    entryType: "INDIVIDUAL",
    quantity: 1,
    lastVaccinationDate: "2026-07-29",
    status: "PENDING",
    reviewRemarks: null,
    createdAt: "2026-09-01T15:00:00Z",
  },
];

export const SEED_INCIDENTS_VALIDATION: ValidationIncidentItem[] = [
  {
    id: "DIS-001",
    type: "disease",
    farmerName: "Juan Dela Cruz",
    barangayName: "Banaba Ibaba",
    purok: "Purok 2",
    farmerContact: "0917-882-9912",
    tagNumber: "B-042",
    livestockBreed: "Brahman Cross",
    livestockType: "Cattle",
    conditionName: "Limping / Weak Legs",
    headCount: 1,
    symptoms: ["Limping / Weak Legs", "Not Eating / Off-Feed"],
    details: "Animal refused to stand this morning; left rear hoof is swollen. No open cuts visible.",
    date: "2026-04-21",
    status: "VERIFIED",
    photoName: "swollen_left_hoof.jpg",
    reviewRemarks: null,
    sibatInspection: {
      verifiedBy: "Officer R. Mendoza (SIBAT Sector 1)",
      verifiedAt: "2026-04-21 10:45",
      tagConfirmed: true,
      confirmedCount: 1,
      confirmedSymptoms: ["Limping / Weak Legs", "Not Eating / Off-Feed"],
      severity: "MODERATE",
      biosecurityAction: "PEN_ISOLATION",
      remarks: "On-farm physical check completed. Mild hoof swelling confirmed; prescribed oral electrolytes and temporary stall isolation.",
      temperatureCelsius: 39.4,
    },
  },
  {
    id: "MOR-001",
    type: "mortality",
    farmerName: "Mateo Dimaculangan",
    barangayName: "San Roque",
    purok: "Purok 1",
    farmerContact: "0919-445-8821",
    tagNumber: "A-099",
    livestockBreed: "Native Murrah",
    livestockType: "Carabao",
    conditionName: "Sudden Death / Severe Bloat",
    headCount: 1,
    symptoms: ["Bloated Belly"],
    details: "Carabao died overnight following heavy feeding on damp legumes. Bloat suspected.",
    date: "2026-04-18",
    status: "VERIFIED",
    reviewRemarks: null,
    sibatInspection: {
      verifiedBy: "Officer C. Batangas (SIBAT)",
      verifiedAt: "2026-04-18 11:30",
      tagConfirmed: true,
      confirmedCount: 1,
      confirmedSymptoms: ["Bloated Belly"],
      severity: "CRITICAL",
      biosecurityAction: "BIOSECURE_BURIAL",
      remarks: "Carcass verified on site. Severe tympany/bloat with no signs of anthrax. Supervised 2m deep pit burial with lime.",
    },
  },
  {
    id: "DIS-002",
    type: "disease",
    farmerName: "Elena Vilia",
    barangayName: "Lipay",
    purok: "Purok 4",
    farmerContact: "0928-334-1188",
    tagNumber: "B-011",
    livestockBreed: "Holstein Sahiwal",
    livestockType: "Cattle",
    conditionName: "Coughing / Runny Nose",
    headCount: 2,
    symptoms: ["Coughing / Runny Nose", "High Fever / Hot Ears", "Lethargic / Isolated"],
    details: "Two calves wheezing heavily and coughing after sudden rainstorm.",
    date: "2026-04-20",
    status: "VERIFIED",
    reviewRemarks: null,
    sibatInspection: {
      verifiedBy: "Officer R. Mendoza (SIBAT Sector 1)",
      verifiedAt: "2026-04-20 16:45",
      tagConfirmed: true,
      confirmedCount: 2,
      confirmedSymptoms: ["Coughing / Runny Nose", "High Fever / Hot Ears"],
      severity: "MODERATE",
      biosecurityAction: "PEN_ISOLATION",
      remarks: "On-farm physical check completed. Mild pneumonic wheezing. Prescribed oral electrolytes and temporary stall isolation.",
      temperatureCelsius: 39.8,
    },
  },
  {
    id: "MOR-002",
    type: "mortality",
    farmerName: "Ricardo Gomez",
    barangayName: "Quilo-quilo",
    purok: "Purok 3",
    farmerContact: "0939-556-7722",
    tagNumber: "D-055",
    livestockBreed: "Dairy Jersey",
    livestockType: "Cattle",
    conditionName: "Calving / Birthing Complications",
    headCount: 1,
    symptoms: ["Lethargic / Isolated"],
    details: "Severe dystocia during unassisted nighttime birth resulting in maternal death.",
    date: "2026-04-21",
    status: "PENDING",
    reviewRemarks: null,
  },
  {
    id: "inc-1",
    type: "slaughter",
    farmerName: "Juan Dela Cruz",
    barangayName: "San Roque",
    details: "Cattle #B-042 - 350kg beef cattle slaughtered at Municipal Abattoir. Dressed weight 210kg.",
    date: "2026-09-04",
    status: "PENDING",
    reviewRemarks: null,
    headCount: 1,
    weight: "350kg live / 210kg dressed",
    tagNumber: "PH-BTG-B-042",
  },
  {
    id: "inc-3",
    type: "birth",
    farmerName: "Pedro Garcia",
    barangayName: "Quilo-quilo",
    details: "New calf born - Female, mother #D-089. Excellent vigor, colostrum intake verified within 2 hours.",
    date: "2026-09-02",
    status: "APPROVED",
    reviewRemarks: "Birth recorded; provisional ear tag assigned.",
    headCount: 1,
    tagNumber: "CALF-2026-089",
  },
  {
    id: "inc-4",
    type: "sale",
    farmerName: "Ana Reyes",
    barangayName: "Castillo",
    details: "Commercial live cattle transfer to Batangas Regional Livestock Market. 2 heads, 320kg & 340kg.",
    date: "2026-09-01",
    status: "PENDING",
    reviewRemarks: null,
    headCount: 2,
    weight: "660kg total",
  },
];

// ── API Fetchers with Graceful Fallbacks ──

export async function fetchAdminCensusSubmissions(): Promise<CensusSubmissionRecord[]> {
  try {
    const response = await api.get("livestock/census/");
    const data = response.data as ApiCensusSubmission[];
    if (Array.isArray(data) && data.length > 0) {
      return data.map(mapCensusSubmission);
    }
  } catch (err) {
    console.warn("Using seed census submissions for validation portal:", err);
  }
  return MOCK_CENSUS_SUBMISSIONS;
}

export async function fetchAdminProductionRecords(): Promise<ProductionRecordItem[]> {
  try {
    const response = await api.get("production/records/");
    const data = response.data as ApiProductionRecord[];
    if (Array.isArray(data) && data.length > 0) {
      return data.map(mapProductionRecord) as ProductionRecordItem[];
    }
  } catch (err) {
    console.warn("Using seed production records for validation portal:", err);
  }
  return SEED_PRODUCTION_VALIDATION;
}

export async function fetchAdminInventoryRecords(): Promise<ValidationInventoryItem[]> {
  try {
    const response = await api.get("livestock/inventory/");
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        id: item.id,
        farmerName: item.farmer_name || (item.farmer ? `Farmer #${item.farmer}` : "Registered Farmer"),
        barangayName: item.barangay_name || "Batangas Municipality",
        livestockType: item.livestock_type_name || "Livestock",
        tagNumber: item.tag_number || `TAG-${item.id}`,
        breed: item.breed || "Standard Breed",
        sex: item.sex || "Unspecified",
        weight: item.weight ? Number(item.weight) : null,
        entryType: item.entry_type || "INDIVIDUAL",
        quantity: Number(item.quantity) || 1,
        lastVaccinationDate: item.last_vaccination_date || null,
        status: (item.status || "PENDING").toUpperCase() as "PENDING" | "APPROVED" | "REJECTED",
        reviewRemarks: item.review_remarks || null,
        reviewedBy: item.reviewed_by_name || null,
        reviewedAt: item.reviewed_at || null,
        createdAt: item.created_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn("Using seed inventory records for validation portal:", err);
  }
  return SEED_INVENTORY_VALIDATION;
}

// ── Query Hooks ──

export function useAdminCensusSubmissions() {
  return useQuery({
    queryKey: ["admin-census-submissions"],
    queryFn: fetchAdminCensusSubmissions,
    staleTime: 30_000,
  });
}

export function useAdminProductionRecords() {
  return useQuery({
    queryKey: ["admin-production-records"],
    queryFn: fetchAdminProductionRecords,
    staleTime: 30_000,
  });
}

export function useAdminInventoryRecords() {
  return useQuery({
    queryKey: ["admin-inventory-records"],
    queryFn: fetchAdminInventoryRecords,
    staleTime: 30_000,
  });
}

// ── Formatting & Style Helpers ──

export function getStatusPill(status: string) {
  const norm = (status || "PENDING").toUpperCase();
  switch (norm) {
    case "APPROVED":
      return {
        label: "Approved",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        dot: "bg-emerald-500",
      };
    case "REJECTED":
    case "FLAGGED":
      return {
        label: norm === "FLAGGED" ? "Flagged" : "Rejected",
        bg: "bg-rose-50 text-rose-700 border-rose-200/80",
        dot: "bg-rose-500",
      };
    case "VERIFIED":
      return {
        label: "Verified (Field)",
        bg: "bg-sky-50 text-sky-700 border-sky-200/80",
        dot: "bg-sky-500",
      };
    case "PENDING":
    default:
      return {
        label: "Pending Review",
        bg: "bg-amber-50 text-amber-700 border-amber-200/80",
        dot: "bg-amber-500 animate-pulse",
      };
  }
}

export function getIncidentTypeBadge(type: IncidentType) {
  switch (type) {
    case "disease":
      return {
        label: "Disease / Health Case",
        color: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "mortality":
      return {
        label: "Mortality Record",
        color: "bg-rose-100 text-rose-800 border-rose-200",
      };
    case "slaughter":
      return {
        label: "Slaughter Inspection",
        color: "bg-purple-100 text-purple-800 border-purple-200",
      };
    case "birth":
      return {
        label: "Certified Birth",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case "sale":
      return {
        label: "Livestock Sale / Transfer",
        color: "bg-blue-100 text-blue-800 border-blue-200",
      };
    default:
      return {
        label: type,
        color: "bg-slate-100 text-slate-800 border-slate-200",
      };
  }
}
