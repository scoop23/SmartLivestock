import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import { useQueries, useQuery } from "@tanstack/react-query";

export interface CensusPeriod {
  year: number;
  quarter: number;
  label: string;
}

export interface CensusAvailablePeriod {
  year: number;
  quarter: number;
}

export interface CensusBarangayHeads {
  barangay: string;
  heads: number;
  farmers: number;
  submissions: number;
}

export interface CensusBarangayStatus {
  barangay: string;
  status: string;
  submissions: number;
  heads: number;
  farmers: number;
}

export interface CensusCoverage {
  total_barangays: number;
  submitted: number;
  missing: number;
  submission_pct: number;
  by_status: Record<string, number>;
  missing_barangays: string[];
}

export interface CensusTotals {
  heads: number;
  submissions: number;
  farmers: number;
}

export interface CensusAnalytics {
  period: CensusPeriod;
  available_periods: CensusAvailablePeriod[];
  heads_by_barangay: CensusBarangayHeads[];
  status_by_barangay: CensusBarangayStatus[];
  coverage: CensusCoverage;
  totals: CensusTotals;
}

export interface CensusCoverageTrendPoint {
  period: CensusPeriod;
  submitted: number;
  total_barangays: number;
  submission_pct: number;
}

export const CENSUS_ANALYTICS_QUERY_KEY = "census_analytics";

/** Display metadata for the four census workflow states. */
export const CENSUS_STATUS_META: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  PENDING: { label: "Pending SIBAT", color: "#f59e0b", dot: "bg-amber-500" },
  VERIFIED: { label: "Verified (MAO Review)", color: "#0284c7", dot: "bg-sky-600" },
  APPROVED: { label: "MAO Approved", color: "#059669", dot: "bg-emerald-600" },
  SUBJECT_TO_REVISION: {
    label: "Subject to Revision",
    color: "#e11d48",
    dot: "bg-rose-600",
  },
};

export function censusStatusMeta(status: string) {
  return (
    CENSUS_STATUS_META[status] ?? {
      label: status,
      color: "#64748b",
      dot: "bg-slate-500",
    }
  );
}

/**
 * Quarterly census coverage. Omitting the period lets the backend answer with
 * the newest quarter that actually has submissions.
 */
async function fetchCensusAnalytics(
  year?: number,
  quarter?: number
): Promise<CensusAnalytics> {
  const params: Record<string, number> = {};
  if (year && quarter) {
    params.year = year;
    params.quarter = quarter;
  }
  const res = await api.get<CensusAnalytics>("analytics/census/", { params });
  return res.data;
}

export function useCensusAnalytics(year?: number, quarter?: number) {
  const { user } = useAuth();
  return useQuery<CensusAnalytics>({
    queryKey: [
      CENSUS_ANALYTICS_QUERY_KEY,
      user?.email,
      user?.accessScope,
      user?.assignedBarangayId,
      year ?? null,
      quarter ?? null,
    ],
    enabled: Boolean(user),
    queryFn: () => fetchCensusAnalytics(year, quarter),
  });
}

function getFourCensusPeriodsEndingAt(year?: number, quarter?: number) {
  if (!year || !quarter) return [];

  const endIndex = year * 4 + quarter - 1;
  return Array.from({ length: 4 }, (_, index) => {
    const periodIndex = endIndex - 3 + index;
    return {
      year: Math.floor(periodIndex / 4),
      quarter: (periodIndex % 4) + 1,
    };
  });
}

export function useCensusCoverageHistory(
  year?: number,
  quarter?: number,
  currentData?: CensusAnalytics
) {
  const { user } = useAuth();
  const periods = getFourCensusPeriodsEndingAt(year, quarter);

  return useQueries({
    queries: periods.map(({ year: periodYear, quarter: periodQuarter }) => ({
      queryKey: [
        CENSUS_ANALYTICS_QUERY_KEY,
        user?.email,
        user?.accessScope,
        user?.assignedBarangayId,
        periodYear,
        periodQuarter,
      ],
      enabled: Boolean(user),
      queryFn: () => fetchCensusAnalytics(periodYear, periodQuarter),
      staleTime: 60_000,
      initialData:
        currentData?.period.year === periodYear && currentData.period.quarter === periodQuarter
          ? currentData
          : undefined,
      select: (data: CensusAnalytics): CensusCoverageTrendPoint => ({
        period: data.period,
        submitted: data.coverage.submitted,
        total_barangays: data.coverage.total_barangays,
        submission_pct: data.coverage.submission_pct,
      }),
    })),
  });
}
