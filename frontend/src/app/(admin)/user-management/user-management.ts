import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

export type UserAccountStatus =
  | "PENDING"
  | "APPROVED"
  | "SUBJECT_TO_REVISION"
  | "SUSPENDED";

export interface UserDocumentItem {
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

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  role: string;
  account_status: UserAccountStatus;
  created_at: string;
  approved_at: string | null;
  barangay: string;
  barangay_id: number | null;
  assigned_barangay_id: number | null;
  assigned_barangay_name: string | null;
  access_scope: "ASSIGNED_ONLY" | "ALL_BARANGAYS";
  documents: UserDocumentItem[];
  farm_size: number | null;
  address: string;
  rsbsa_number?: string;
  cattle_count: number;
  profile_image?: string | null;
}


export interface UpdateUserStatusPayload {
  userId: number;
  status: UserAccountStatus;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

export const USER_MANAGEMENT_QUERY_KEYS = {
  all: ["users-directory"] as const,
  detail: (id: number) => ["users-directory", id] as const,
};

// ── API Fetchers ─────────────────────────────────────────────────────────────

export interface DirectoryFilters {
  role?: string;
  account_status?: string;
  barangay_id?: string;
  search?: string;
}

export async function fetchUsersDirectory(filters?: DirectoryFilters): Promise<ApiUser[]> {
  const response = await api.get<ApiUser[]>("/api/users/directory/", { params: filters });
  return response.data;
}

export async function updateUserStatus({
  userId,
  status,
}: UpdateUserStatusPayload): Promise<ApiUser> {
  const response = await api.patch<ApiUser>(`/api/users/${userId}/status/`, {
    status,
  });
  return response.data;
}

// ── TanStack Query Hooks ─────────────────────────────────────────────────────

export function useUsersDirectory(options?: { enabled?: boolean }, filters?: DirectoryFilters) {
  return useQuery<ApiUser[]>({
    queryKey: filters ? [...USER_MANAGEMENT_QUERY_KEYS.all, filters] : USER_MANAGEMENT_QUERY_KEYS.all,
    queryFn: () => fetchUsersDirectory(filters),
    staleTime: 30 * 1000,
    ...options,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserStatus,
    onSuccess: (updatedUser, variables) => {
      // Optimistically update the directory cache
      queryClient.setQueryData<ApiUser[]>(
        USER_MANAGEMENT_QUERY_KEYS.all,
        (old) => {
          if (!old) return old;
          return old.map((u) => (u.id === variables.userId ? updatedUser : u));
        }
      );
      // Re-invalidate to ensure server synchronization
      queryClient.invalidateQueries({
        queryKey: USER_MANAGEMENT_QUERY_KEYS.all,
      });

      const verb =
        variables.status === "APPROVED"
          ? "approved"
          : variables.status === "SUBJECT_TO_REVISION"
          ? "returned for revision"
          : variables.status === "SUSPENDED"
          ? "suspended"
          : "updated";

      toast.success(`User account ${verb} successfully.`);
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      const errMsg = data && typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "Failed to update user status.";
      toast.error(errMsg);
    },
  });
}

export interface VerifyUserDocumentPayload {

  documentId: number;
  status: "APPROVED" | "SUBJECT_TO_REVISION" | "PENDING";
  reason?: string;
}

export async function verifyUserDocument({
  documentId,
  status,
  reason,
}: VerifyUserDocumentPayload): Promise<UserDocumentItem> {
  const response = await api.patch<UserDocumentItem>(
    `/api/users/documents/${documentId}/verification/`,
    { status, reason }
  );
  return response.data;
}

export function useVerifyUserDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyUserDocument,
    onSuccess: (updatedDoc) => {
      queryClient.invalidateQueries({
        queryKey: USER_MANAGEMENT_QUERY_KEYS.all,
      });

      const label =
        updatedDoc.verification_status === "APPROVED"
          ? "Document manually approved."
          : updatedDoc.verification_status === "SUBJECT_TO_REVISION"
          ? "Document returned for revision."
          : "Document verification status updated.";

      toast.success(label);
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: Record<string, unknown> } }).response?.data;
      const errMsg =
        data && typeof data === "object"
          ? Object.values(data).flat().join(" ")
          : "Failed to update document verification status.";
      toast.error(errMsg);
    },
  });
}



export function useUpdateSibatAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, barangayId, accessScope }: { userId: number; barangayId: number | null; accessScope: ApiUser["access_scope"] }) => {
      const { data } = await api.patch<ApiUser>(`/api/users/${userId}/assignment/`, {
        assigned_barangay_id: barangayId,
        access_scope: accessScope,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_MANAGEMENT_QUERY_KEYS.all });
      toast.success("SIBAT barangay and access scope saved.");
    },
    onError: (error: unknown) => {
      const data = (error as { response?: { data?: Record<string, unknown> } }).response?.data;
      toast.error(data ? Object.values(data).flat().join(" ") : "Could not save barangay assignment.");
    },
  });
}

export function userBarangayLabel(user: ApiUser): string {
  if (user.role === "SIBAT") return user.assigned_barangay_name || "Unassigned";
  if (user.role === "FARMER") return user.barangay || "Unassigned";
  return "Municipal / no barangay assignment";
}
