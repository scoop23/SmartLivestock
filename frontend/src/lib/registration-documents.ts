import axios from "axios";
import api, { getActiveApiUrl, LOCAL_API_URL } from "@/lib/axios";
import { IDENTITY_TOKEN_KEY, saveRegistrationIdentitySession } from "@/lib/identity-verification";

export interface RegistrationDocumentItem {
  id: number;
  document_type: string;
  document_type_display?: string;
  document_file: string;
  file_url?: string;
  file_name?: string;
  verification_status: "PENDING" | "APPROVED" | "SUBJECT_TO_REVISION";
  verification_status_display?: string;
  uploaded_at: string;
  reviewed_at?: string | null;
  review_remarks?: string;
  approved_by?: number | null;
  approved_by_name?: string;
}

export interface OwnRegistrationDocumentsResponse {
  user_id: number;
  full_name: string;
  email: string;
  account_status: "PENDING" | "APPROVED" | "SUBJECT_TO_REVISION" | "SUSPENDED" | string;
  account_status_display: string;
  documents: RegistrationDocumentItem[];
  access_token?: string;
}

export const GOVERNMENT_ID_TYPE_OPTIONS = [
  { value: "PHILID", label: "PhilID (National ID)" },
  { value: "DRIVERS_LICENSE", label: "Driver's License" },
  { value: "VOTERS_ID", label: "Voter's ID" },
  { value: "PASSPORT", label: "Passport" },
  { value: "UMID", label: "UMID" },
  { value: "POSTAL_ID", label: "Postal ID" },
  { value: "PRC_ID", label: "PRC ID" },
  { value: "OTHER_GOV_ID", label: "Other Government ID" },
] as const;

function buildAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const access = localStorage.getItem("access");
  if (access) {
    return { Authorization: `Bearer ${access}` };
  }
  try {
    const identityToken = sessionStorage.getItem(IDENTITY_TOKEN_KEY);
    if (identityToken) {
      return { Authorization: `Identity ${identityToken}` };
    }
  } catch {
    // Ignore storage access errors
  }
  return {};
}

function shouldFallbackToLocal(err: unknown, activeApiUrl = getActiveApiUrl()): boolean {
  return (
    axios.isAxiosError(err) &&
    err.response?.status === 404 &&
    activeApiUrl !== LOCAL_API_URL &&
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  );
}

export function hasRegistrationDocumentAuth(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem("access")) return true;
  try {
    return Boolean(sessionStorage.getItem(IDENTITY_TOKEN_KEY));
  } catch {
    return false;
  }
}

export function formatDocumentDisplayName(doc: RegistrationDocumentItem): string {
  const baseLabel = doc.document_type_display || doc.document_type;
  const fileName = doc.file_name || "";
  if (fileName.startsWith("Front_")) {
    return `${baseLabel} (Front Photo)`;
  }
  if (fileName.startsWith("Back_")) {
    return `${baseLabel} (Back Photo)`;
  }
  return baseLabel;
}

export async function establishDocumentRevisionSession(
  email: string,
  password: string
): Promise<OwnRegistrationDocumentsResponse> {
  const payload = { email: email.trim().toLowerCase(), password };
  let sessionApiUrl = getActiveApiUrl();
  let data: OwnRegistrationDocumentsResponse;
  try {
    const res = await axios.post<OwnRegistrationDocumentsResponse>(
      `${sessionApiUrl}/api/users/documents/session/`,
      payload
    );
    data = res.data;
  } catch (err) {
    if (shouldFallbackToLocal(err, sessionApiUrl)) {
      const res = await axios.post<OwnRegistrationDocumentsResponse>(
        `${LOCAL_API_URL}/api/users/documents/session/`,
        payload
      );
      sessionApiUrl = LOCAL_API_URL;
      data = res.data;
    } else {
      throw err;
    }
  }

  if (data.access_token && typeof window !== "undefined") {
    saveRegistrationIdentitySession(data.access_token, sessionApiUrl);
  }
  return data;
}

export async function fetchOwnRegistrationDocuments(): Promise<OwnRegistrationDocumentsResponse> {
  const headers = buildAuthHeaders();
  try {
    const res = await axios.get<OwnRegistrationDocumentsResponse>(
      `${getActiveApiUrl()}/api/users/documents/`,
      { headers }
    );
    return res.data;
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const res = await axios.get<OwnRegistrationDocumentsResponse>(
        `${LOCAL_API_URL}/api/users/documents/`,
        { headers }
      );
      return res.data;
    }
    throw err;
  }
}

export async function resubmitRegistrationDocument({
  documentId,
  file,
  documentType,
}: {
  documentId: number;
  file: File;
  documentType?: string;
}): Promise<RegistrationDocumentItem> {
  const formData = new FormData();
  formData.append("document_file", file);
  if (documentType) {
    formData.append("document_type", documentType);
  }

  const headers = buildAuthHeaders();
  try {
    const res = await axios.patch<RegistrationDocumentItem>(
      `${getActiveApiUrl()}/api/users/documents/${documentId}/resubmit/`,
      formData,
      { headers }
    );
    return res.data;
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const res = await axios.patch<RegistrationDocumentItem>(
        `${LOCAL_API_URL}/api/users/documents/${documentId}/resubmit/`,
        formData,
        { headers }
      );
      return res.data;
    }
    throw err;
  }
}

export async function fetchRegistrationDocumentBlob(documentId: number): Promise<{
  blob: Blob;
  contentType: string;
}> {
  const headers = buildAuthHeaders();
  try {
    const res = await api.get(`/api/users/documents/${documentId}/view/`, {
      responseType: "blob",
      headers,
    });
    return {
      blob: res.data,
      contentType: res.headers["content-type"] || res.data?.type || "application/octet-stream",
    };
  } catch (err) {
    if (shouldFallbackToLocal(err)) {
      const res = await axios.get(`${LOCAL_API_URL}/api/users/documents/${documentId}/view/`, {
        responseType: "blob",
        headers,
      });
      return {
        blob: res.data,
        contentType: res.headers["content-type"] || res.data?.type || "application/octet-stream",
      };
    }
    throw err;
  }
}
