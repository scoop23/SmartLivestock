import api from "@/lib/axios";

export type ReportType = "inventory" | "production" | "disease_mortality" | "slaughter" | "movement" | "inspection";
export type ReportFilters = { species: string; barangay: string; purpose: string; direction: string };
export type ReportAnalysis = {
  executive_summary: { label: string; value: string | number; detail?: string }[];
  key_findings: string[];
  rankings: { title: string; unit: string; items: { name: string; value: number }[] }[];
  coverage_notice: string;
  coverage_level: "none" | "sparse" | "adequate";
  data_status: string;
  methodology: string;
  comparison: {
    available: boolean;
    period: { date_from: string; date_to: string };
    unavailable_reason: string;
    metrics: { label: string; current: number; previous: number; unit: string; change_percent: number }[];
  };
};
export type OfficialReport = {
  report_type: ReportType;
  title: string;
  municipality: string;
  period: { date_from: string; date_to: string };
  period_label: string;
  generated_at: string;
  generated_by: string;
  filters: ReportFilters;
  summary: Record<string, number | string | null | Record<string, number | string | null>>;
  analysis: ReportAnalysis;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  record_count: number;
};

function reportParams(reportType: ReportType, dateFrom: string, dateTo: string, filters: ReportFilters) {
  // Both preview and export send the same filter state to Django. The server
  // rebuilds authorized querysets; client supplied rows are never exported.
  return { report_type: reportType, date_from: dateFrom, date_to: dateTo,
    species: filters.species, barangay: filters.barangay, purpose: filters.purpose, direction: filters.direction };
}

export async function fetchOfficialReport(reportType: ReportType, dateFrom: string, dateTo: string, filters: ReportFilters) {
  const response = await api.get<OfficialReport>("/analytics/reports/preview/", {
    params: reportParams(reportType, dateFrom, dateTo, filters),
  });
  return response.data;
}

export async function downloadOfficialReport(reportType: ReportType, dateFrom: string, dateTo: string, filters: ReportFilters, format: "xlsx" | "pdf") {
  return api.get("/analytics/reports/export/", {
    params: { ...reportParams(reportType, dateFrom, dateTo, filters), file_format: format },
    responseType: "blob",
  });
}
