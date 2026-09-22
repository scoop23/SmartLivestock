"use client";

import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";
import {
  CensusSubmissionRecord,
  mapCensusSubmission,
  ApiCensusSubmission,
} from "@/app/(sibat)/sibat/sibat-analytics";
import {
  ProductionRecordItem,
  mapProductionRecord,
  ApiProductionRecord,
} from "@/app/(farmer)/production-dashboard/production-analytics";

// ── Types: Validation Domains ──

export type ValidationDomain = "census" | "production" | "inventory" | "incidents";

export type ValidationStatus = "ALL" | "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";

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
    description: "Disease surveillance cases and mortality records requiring municipal veterinary review",
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
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
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
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
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

// ── API Fetchers (Connected directly to Django REST Backend) ──

export async function fetchAdminCensusSubmissions(): Promise<CensusSubmissionRecord[]> {
  try {
    const response = await api.get("livestock/census/");
    const data = response.data as ApiCensusSubmission[];
    if (Array.isArray(data)) {
      return data.map(mapCensusSubmission);
    }
  } catch (err) {
    console.warn("Failed to fetch census submissions for validation portal:", err);
  }
  return [];
}

export async function fetchAdminProductionRecords(): Promise<ProductionRecordItem[]> {
  try {
    const response = await api.get("production/records/");
    const data = response.data as ApiProductionRecord[];
    if (Array.isArray(data)) {
      return data.map(mapProductionRecord) as ProductionRecordItem[];
    }
  } catch (err) {
    console.warn("Failed to fetch production records for validation portal:", err);
  }
  return [];
}

export async function fetchAdminInventoryRecords(): Promise<ValidationInventoryItem[]> {
  try {
    const response = await api.get("livestock/inventory/");
    const data = response.data;
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.id,
        farmerName: item.farmer_name || (item.farmer ? `Farmer #${item.farmer}` : "Registered Farmer"),
        barangayName: item.barangay_name || "Padre Garcia",
        livestockType: item.livestock_type_name || "Livestock",
        tagNumber: item.tag_number || `TAG-${item.id}`,
        breed: item.breed || "Standard Breed",
        sex: item.sex || "Unspecified",
        weight: item.weight ? Number(item.weight) : null,
        entryType: item.entry_type || "INDIVIDUAL",
        quantity: Number(item.quantity) || 1,
        lastVaccinationDate: item.last_vaccination_date || null,
        status: (item.status || "PENDING").toUpperCase() as "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED",
        reviewRemarks: item.review_remarks || null,
        reviewedBy: item.reviewed_by_name || null,
        reviewedAt: item.reviewed_at || null,
        createdAt: item.created_at || new Date().toISOString(),
      }));
    }
  } catch (err) {
    console.warn("Failed to fetch inventory records for validation portal:", err);
  }
  return [];
}

export async function fetchAdminIncidentRecords(): Promise<ValidationIncidentItem[]> {
  try {
    const [diseaseRes, mortRes, salesRes, calvingRes] = await Promise.allSettled([
      api.get("diseases/cases/"),
      api.get("diseases/mortality/"),
      api.get("production/sales/"),
      api.get("production/calving/"),
    ]);

    const diseaseCases: any[] =
      diseaseRes.status === "fulfilled" && Array.isArray(diseaseRes.value.data)
        ? diseaseRes.value.data
        : [];
    const mortalities: any[] =
      mortRes.status === "fulfilled" && Array.isArray(mortRes.value.data)
        ? mortRes.value.data
        : [];
    const sales: any[] =
      salesRes.status === "fulfilled" && Array.isArray(salesRes.value.data)
        ? salesRes.value.data
        : [];
    const calvings: any[] =
      calvingRes.status === "fulfilled" && Array.isArray(calvingRes.value.data)
        ? calvingRes.value.data
        : [];

    const incidents: ValidationIncidentItem[] = [];

    diseaseCases.forEach((dc) => {
      incidents.push({
        id: `dis-${dc.id}`,
        type: "disease",
        farmerName: dc.farmer_name || "Registered Farmer",
        barangayName: dc.barangay_name || "Padre Garcia",
        details: dc.name
          ? `Disease case: ${dc.name}. Affected: ${dc.affected_count || 1} head(s). Tag: ${dc.tag_number || "N/A"}`
          : "Disease condition reported",
        date: dc.record_date || (dc.created_at ? dc.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        status: (dc.status || "PENDING").toUpperCase() as "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED",
        reviewRemarks: dc.review_remarks || null,
        headCount: dc.affected_count || 1,
        tagNumber: dc.tag_number || undefined,
        livestockBreed: dc.breed || undefined,
        livestockType: dc.livestock_type_name || "Livestock",
        conditionName: dc.name || "Disease Case",
        reviewedBy: dc.reviewed_by_name || null,
        reviewedAt: dc.reviewed_at || null,
      });
    });

    mortalities.forEach((m) => {
      incidents.push({
        id: `mor-${m.id}`,
        type: "mortality",
        farmerName: m.farmer_name || "Registered Farmer",
        barangayName: m.barangay_name || "Padre Garcia",
        details: `Mortality cause: ${m.cause || "Unspecified"}. Death count: ${m.death_count || 1} head(s). Tag: ${m.tag_number || "N/A"}`,
        date: m.record_date || (m.created_at ? m.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        status: (m.status || "PENDING").toUpperCase() as "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED",
        reviewRemarks: m.review_remarks || null,
        headCount: m.death_count || 1,
        tagNumber: m.tag_number || undefined,
        livestockBreed: m.breed || undefined,
        livestockType: m.livestock_type_name || "Livestock",
        conditionName: m.cause || "Mortality Record",
        reviewedBy: m.reviewed_by_name || null,
        reviewedAt: m.reviewed_at || null,
      });
    });

    sales.forEach((s) => {
      incidents.push({
        id: `sale-${s.id}`,
        type: "sale",
        farmerName: s.farmer_name || "Registered Farmer",
        barangayName: s.barangay_name || "Padre Garcia",
        details: `Live sale: ${s.quantity || 1} head(s) (${s.sale_method || "Direct"}). Destination: ${s.destination || "Market"}. Total: ₱${Number(s.total_price || 0).toLocaleString()}`,
        date: s.sale_date || (s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        status: (s.status || "PENDING").toUpperCase() as "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED",
        reviewRemarks: s.review_remarks || null,
        headCount: s.quantity || 1,
        tagNumber: s.tag_number || undefined,
        livestockType: s.livestock_type_name || "Livestock",
        conditionName: s.purpose ? `Sale Purpose: ${s.purpose}` : "Live Animal Sale",
      });
    });

    calvings.forEach((c) => {
      incidents.push({
        id: `birth-${c.id}`,
        type: "birth",
        farmerName: c.farmer_name || "Registered Farmer",
        barangayName: c.barangay_name || "Padre Garcia",
        details: `Calf Birth: Tag ${c.calf_tag || "N/A"}. Dam: ${c.dam_tag || "N/A"}. Sex: ${c.calf_sex || "Unspecified"}. Calving Ease: ${c.calving_ease || "Normal"}`,
        date: c.calving_date || (c.created_at ? c.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        status: "APPROVED",
        reviewRemarks: null,
        headCount: 1,
        tagNumber: c.calf_tag || undefined,
        livestockBreed: c.breed || c.dam_breed || undefined,
        livestockType: "Cattle",
        conditionName: `Calf Birth (${c.calf_sex || "Unspecified"})`,
      });
    });

    return incidents;
  } catch (err) {
    console.warn("Failed to fetch incident records for validation portal:", err);
  }
  return [];
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

export function useAdminIncidentRecords() {
  return useQuery({
    queryKey: ["admin-incident-records"],
    queryFn: fetchAdminIncidentRecords,
    staleTime: 30_000,
  });
}

// ── Formatting & Style Helpers ──

export function getStatusPill(status: string) {
  const norm = (status || "PENDING").toUpperCase();
  switch (norm) {
    case "APPROVED":
      return {
        label: "MAO Certified",
        shortLabel: "Approved",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
        dot: "bg-emerald-500",
      };
    case "SUBJECT_TO_REVISION":
    case "REJECTED":
    case "FLAGGED":
      return {
        label: "Subject to Revision",
        shortLabel: "For Revision",
        bg: "bg-amber-50 text-amber-900 border-amber-300",
        dot: "bg-amber-500",
      };
    case "VERIFIED":
      return {
        label: "Verified by SIBAT",
        shortLabel: "Verified",
        bg: "bg-sky-50 text-sky-700 border-sky-200/80",
        dot: "bg-sky-500",
      };
    case "PENDING":
    default:
      return {
        label: "Awaiting SIBAT",
        shortLabel: "Pending",
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
