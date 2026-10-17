import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";

export interface ReviewAgingCounts {
  under_3_days: number;
  "3_to_7_days": number;
  over_7_days: number;
}

export interface ReviewWorkloadDomain {
  key: string;
  label: string;
  sibat_count: number;
  mao_count: number;
  returned_count: number;
  sibat_aging: ReviewAgingCounts;
  mao_aging: ReviewAgingCounts;
}

export interface ReviewWorkloadSummary {
  as_of: string;
  aging_basis: string;
  overall: {
    sibat: { count: number; aging: ReviewAgingCounts };
    mao: { count: number; aging: ReviewAgingCounts };
    returned: number;
  };
  by_domain: ReviewWorkloadDomain[];
}

export function useReviewWorkload() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin", "review-workload", user?.email, user?.accessScope, user?.assignedBarangayId],
    enabled: Boolean(user),
    queryFn: async () =>
      (await api.get<ReviewWorkloadSummary>("analytics/review-workload/")).data,
  });
}
