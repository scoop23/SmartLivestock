import api from "@/lib/axios";

export type ReportType = "inventory" | "production" | "disease_mortality" | "slaughter" | "movement" | "inspection";
export type ReportFilters = { species: string; barangay: string; purpose: string; direction: string };
export type OfficialReport = {
  report_type: ReportType;
  title: string;
  municipality: string;
  period: { date_from: string; date_to: string };
  generated_at: string;
  generated_by: string;
  filters: ReportFilters;
  summary: Record<string, number | string | Record<string, number>>;
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
