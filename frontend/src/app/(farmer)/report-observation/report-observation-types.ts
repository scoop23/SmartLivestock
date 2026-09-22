export type ReportType = "DISEASE" | "MORTALITY";

export type BackendStatus =
  | "PENDING"
  | "VERIFIED"
  | "APPROVED"
  | "SUBJECT_TO_REVISION"
  | "REJECTED";

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
  photoName?: string;
  createdAt: string;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewRemarks?: string | null;
  farmerName?: string;
  barangayName?: string;
  rawItem?: any;
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
