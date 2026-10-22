import type { RawDiseaseCase, RawMortalityRecord } from "@/app/(sibat)/sibat/sibat-analytics";
import type { SibatInspectionData } from "@/app/(admin)/data-validation/validation-analytics";
export type ReportType = "DISEASE" | "MORTALITY";

export type BackendStatus =
  | "PENDING"
  | "VERIFIED"
  | "APPROVED"
  | "SUBJECT_TO_REVISION"
  | "SUBJECT_FOR_REVISION"
  | "REJECTED";

export interface ExtendedInspectionData extends Partial<SibatInspectionData> {
  maoRemarks?: string;
  maoReviewedBy?: string;
  maoReviewedAt?: string;
}

export interface FarmerReport {
  id: string;
  reportType: ReportType;
  inventoryId: string;
  cattleTag: string;
  cattleBreed: string;
  cattleType: string;
  name: string; // Disease Name, Symptoms, or Cause of Death
  affectedCount: number;
  recordDate: string;
  status: BackendStatus;
  symptoms: string[];
  description: string;
  photoUrl?: string;
  photoName?: string;
  inspectorPhotoUrl?: string;
  createdAt: string;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  previousReviewRemarks?: string | null;
  farmerName?: string;
  barangayName?: string;
  rawItem?: RawDiseaseCase | RawMortalityRecord;
  inspectionDetails?: ExtendedInspectionData | null;
}

export interface ObservationLogPayload {
  livestockId: number;
  category: "ROUTINE" | "SYMPTOMS" | "BEHAVIOR" | "NUTRITION";
  title: string;
  symptoms: string[];
  affectedCount: number;
  observationDate: string;
  notes: string;
  urgency: "LOW" | "MODERATE" | "HIGH";
}
