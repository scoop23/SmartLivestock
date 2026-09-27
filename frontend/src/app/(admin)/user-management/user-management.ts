import api from "@/lib/axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

export type UserAccountStatus =
  | "PENDING"
  | "APPROVED"
  | "SUBJECT_TO_REVISION"
  | "REJECTED"
  | "SUSPENDED";

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
  farm_size: number | null;
  address: string;
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

export async function fetchUsersDirectory(): Promise<ApiUser[]> {
  const response = await api.get<ApiUser[]>("/api/users/directory/");
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

export function useUsersDirectory(options?: { enabled?: boolean }) {
  return useQuery<ApiUser[]>({
    queryKey: USER_MANAGEMENT_QUERY_KEYS.all,
    queryFn: fetchUsersDirectory,
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
          : variables.status === "REJECTED" ||
            variables.status === "SUBJECT_TO_REVISION"
          ? "returned for revision"
          : variables.status === "SUSPENDED"
          ? "suspended"
          : "updated";

      toast.success(`User account ${verb} successfully.`);
    },
    onError: (err: any) => {
      console.error("Status update error:", err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to update user status.";
      toast.error(errMsg);
    },
  });
}
