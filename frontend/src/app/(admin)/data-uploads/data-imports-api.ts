import api, { PRIMARY_API_URL } from "@/lib/axios";

export interface DatasetInfo {
  code: string;
  label: string;
  description: string;
  required_fields: string[];
  available_fields: string[];
  column_descriptions: Record<string, string>;
}

export interface ValidationIssue {
  field: string;
  type: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

export interface PreviewRow {
  row_number: number;
  status: "VALID" | "WARNING" | "ERROR";
  data: Record<string, string | number | null>;
  issues: ValidationIssue[];
}

export interface ValidationResult {
  file_name: string;
  dataset_type: string;
  dataset_label: string;
  total_rows: number;
  valid_count: number;
  warning_count: number;
  error_count: number;
  column_mapping: Record<string, string>;
  preview_rows: PreviewRow[];
  issues_sample: Array<{
    row_number: number;
    barangay: string;
    species: string;
    field: string;
    error_type: string;
    severity: string;
    error_message: string;
  }>;
}

export interface ImportSummary {
  batch_id: number;
  dataset_type: string;
  file_name: string;
  status: string;
  target_status: string;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  rejected_rows: number;
  duration_seconds: number;
  error_log: Array<Record<string, unknown>>;
}

export interface DataImportBatchItem {
  id: number;
  dataset_type: string;
  dataset_type_display: string;
  file_name: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  status: "PENDING" | "VALIDATED" | "COMPLETED" | "PARTIAL" | "FAILED";
  status_display: string;
  target_status: "APPROVED" | "PENDING";
  total_rows: number;
  valid_rows: number;
  imported_rows: number;
  skipped_rows: number;
  error_rows: number;
  duration_seconds: number | null;
  notes: string;
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const response = await api.get<DatasetInfo[]>("/api/data-imports/datasets/");
  return response.data;
}

export async function validateImportFile(
  datasetType: string,
  file: File
): Promise<ValidationResult> {
  const formData = new FormData();
  formData.append("dataset_type", datasetType);
  formData.append("file", file);

  const response = await api.post<ValidationResult>(
    "/api/data-imports/validate/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60s timeout for large file validation
    }
  );
  return response.data;
}

export async function executeBatchImport(
  datasetType: string,
  file: File,
  skipDuplicates = true,
  targetStatus = "APPROVED"
): Promise<ImportSummary> {
  const formData = new FormData();
  formData.append("dataset_type", datasetType);
  formData.append("file", file);
  formData.append("skip_duplicates", String(skipDuplicates));
  formData.append("target_status", targetStatus);

  const response = await api.post<ImportSummary>(
    "/api/data-imports/import/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 120000, // 120s timeout for transactional batch insertion
    }
  );
  return response.data;
}

export async function fetchBatches(): Promise<DataImportBatchItem[]> {
  const response = await api.get<DataImportBatchItem[]>("/api/data-imports/batches/");
  return response.data;
}

export async function downloadTemplate(
  datasetType: string,
  format: "xlsx" | "csv" = "xlsx"
): Promise<void> {
  const response = await api.get(
    `/api/data-imports/templates/${datasetType}/?format=${format}`,
    {
      responseType: "blob",
    }
  );
  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${datasetType}_template.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadBatchErrors(batchId: number): Promise<void> {
  const response = await api.get(
    `/api/data-imports/batches/${batchId}/errors/`,
    {
      responseType: "blob",
    }
  );
  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Batch_${batchId}_errors.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
