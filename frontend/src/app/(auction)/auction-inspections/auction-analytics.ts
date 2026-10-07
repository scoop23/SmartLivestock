import api from "@/lib/axios";

export interface RegisteredAnimalOption {
  id: number;
  tag_number: string;
  livestock_type: number;
  livestock_type_name: string;
}

export interface RegisteredShipperOption {
  id: number;
  name: string;
  address: string;
  animals: RegisteredAnimalOption[];
}

export interface RegisteredLivestockLookup extends RegisteredAnimalOption {
  breed: string;
  sex: string;
  registration_status: string;
  operational_status: string;
  eligible: boolean;
  ineligibility_reason: string;
  owner_id: number;
  owner_name: string;
  origin: string;
  barangay: string;
}

export interface InspectionItem {
  id?: number;
  livestock_type: number | string;
  livestock_type_name?: string;
  inventory?: number | null;
  inventory_tag?: string | null;
  quantity: number;
  sex: "MALE" | "FEMALE" | "MIXED";
  classification: "SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER";
  remarks: string;
}

export interface InspectionClearance {
  id: number;
  control_number: string;
  date_issued: string | null;
  time_issued: string | null;
  shipper_address: string;
  origin: string;
  vehicle_plate_number: string;
  livestock_handler_license_no: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  issued_by?: number | null;
  issued_by_name?: string | null;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_remarks?: string;
  created_at: string;
}

export interface InspectionRecord {
  id: number;
  control_number: string;
  shipper?: number | null;
  shipper_name: string;
  shipper_address: string;
  origin: string;
  destination: string;
  purpose: "SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER" | "UNKNOWN";
  inspection_date: string;
  date_issued: string | null;
  time_issued: string | null;
  vehicle_plate_number: string;
  livestock_handler_license_no: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
  review_remarks?: string;
  created_by?: number;
  created_by_name?: string;
  created_by_role?: string;
  can_submit_farmer_request?: boolean;
  can_edit?: boolean;
  created_at?: string;
  items: InspectionItem[];
  clearance?: InspectionClearance;
}

export type InspectionStatusTab = "ALL" | "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";

export interface CreateInspectionPayload {
  shipper?: number | null;
  shipper_name: string;
  shipper_address?: string;
  origin?: string;
  destination: string;
  purpose: "SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER" | "UNKNOWN";
  inspection_date: string;
  vehicle_plate_number?: string;
  livestock_handler_license_no?: string;
  items: {
    livestock_type: number;
    inventory?: number | null;
    quantity: number;
    sex: "MALE" | "FEMALE" | "MIXED";
    classification: "SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER";
    remarks?: string;
  }[];
}

// API boundary for the Auction movement pages. These functions keep endpoint paths
// and request/response types in one place; axios attaches the user's auth session.

export async function searchRegisteredShippers(search: string): Promise<RegisteredShipperOption[]> {
  const response = await api.get<RegisteredShipperOption[]>("/inspections/shippers/", { params: { search } });
  return response.data;
}

export async function lookupRegisteredLivestock(code: string): Promise<RegisteredLivestockLookup> {
  // Search and QR pass identifiers to this same endpoint and receive current DB state.
  const response = await api.get<RegisteredLivestockLookup>("/inspections/livestock-lookup/", { params: { code } });
  return response.data;
}


export async function fetchInspections(params?: { status?: string; search?: string }): Promise<InspectionRecord[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "ALL") {
    query.set("status", params.status);
  }
  if (params?.search) {
    query.set("search", params.search);
  }
  const url = `/inspections/${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await api.get<InspectionRecord[]>(url);
  return response.data;
}

export async function fetchInspectionDetail(id: number): Promise<InspectionRecord> {
  const response = await api.get<InspectionRecord>(`/inspections/${id}/`);
  return response.data;
}

export async function createInspection(payload: CreateInspectionPayload): Promise<InspectionRecord> {
  // Creates a pending intake record; this is not an approval endpoint.
  const response = await api.post<InspectionRecord>("/inspections/", payload);
  return response.data;
}

export async function updateInspection(id: number, payload: Partial<CreateInspectionPayload>): Promise<InspectionRecord> {
  const response = await api.patch<InspectionRecord>(`/inspections/${id}/`, payload);
  return response.data;
}

export async function submitFarmerRequest(id: number): Promise<InspectionRecord> {
  const response = await api.post<InspectionRecord>("/inspections/" + id + "/verify/");
  return response.data;
}

export async function resubmitInspection(id: number): Promise<InspectionRecord> {
  const response = await api.post<InspectionRecord>(`/inspections/${id}/resubmit/`);
  return response.data;
}

export async function reviewInspection(
  id: number,
  data: { status: "APPROVED" | "SUBJECT_TO_REVISION"; remarks?: string }
): Promise<InspectionRecord> {
  // Represents the MAO/Admin review API contract; server permissions and transition
  // validation remain authoritative for every caller.
  const response = await api.post<InspectionRecord>(`/inspections/${id}/review/`, data);
  return response.data;
}

export async function deleteInspection(id: number): Promise<void> {
  await api.delete(`/inspections/${id}/`);
}

export const INITIAL_INSPECTIONS: InspectionRecord[] = [];
