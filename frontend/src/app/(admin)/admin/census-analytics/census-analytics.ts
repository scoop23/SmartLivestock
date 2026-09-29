import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";

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
  return useQuery<CensusAnalytics>({
    queryKey: [CENSUS_ANALYTICS_QUERY_KEY, year ?? null, quarter ?? null],
    queryFn: () => fetchCensusAnalytics(year, quarter),
  });
}
