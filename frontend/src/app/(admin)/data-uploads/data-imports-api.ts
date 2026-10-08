import api, { PRIMARY_API_URL } from "@/lib/axios";

// ============================================================
// DATA IMPORTS API CLIENT
// ============================================================
// This file is the frontend's single communication layer for
// the bulk data import system. It maps to Django endpoints in:
//   backend/data_imports/views.py
//
// FULL IMPORT PIPELINE (end-to-end):
//
//  1. MAO user selects a dataset type (e.g. "livestock_inventory")
//  2. User downloads the official template CSV/XLSX
//  3. User fills out the template with municipal records
//  4. User uploads the file → VALIDATE first (dry-run, no DB writes)
//  5. Frontend shows preview: valid/warning/error rows
//  6. MAO confirms → EXECUTE import (writes to PostgreSQL)
//  7. Frontend displays batch summary: imported/skipped/rejected
//  8. Errors downloadable as CSV for correction
// ============================================================

// DatasetInfo:
// Describes a single supported domain (e.g. livestock_inventory, production, disease).
// Returned by fetchDatasets() so the UI knows which upload options are available.
export interface DatasetInfo {
  code: string;
  label: string;
  description: string;
  required_fields: string[];
  available_fields: string[];
  column_descriptions: Record<string, string>;
}

// ValidationIssue:
// A single cell-level problem found during dry-run validation.
// Each issue has a severity: ERROR (blocks import) or WARNING (skippable duplicate).
export interface ValidationIssue {
  field: string;
  type: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

// PreviewRow:
// Represents one spreadsheet row returned by the validate endpoint.
// The UI shows the first 200 rows in a preview table before the user confirms import.
export interface PreviewRow {
  row_number: number;
  status: "VALID" | "WARNING" | "ERROR";
  data: Record<string, string | number | null>;
  issues: ValidationIssue[];
}

// ValidationResult:
// The full response from POST /api/data-imports/validate/
// Contains row counts and preview data but does NOT modify the database.
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
    livestock_type?: string;
    /** Legacy key retained for datasets that still use species terminology. */
    species?: string;
    field: string;
    error_type: string;
    severity: string;
    error_message: string;
  }>;
}

// ImportSummary:
// The response from POST /api/data-imports/import/
// Returned after the batch is executed inside a database transaction.
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

// DataImportBatchItem:
// One row in the import history table. Displayed in the "Recent Imports" section
// so MAO officers can audit past uploads, check status, and download error reports.
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

// fetchDatasets:
// GET /api/data-imports/datasets/
// Fetches the list of all supported municipal dataset types from the backend registry.
// Used to populate the "Select dataset type" dropdown in the UI.
export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const response = await api.get<DatasetInfo[]>("/api/data-imports/datasets/");
  return response.data;
}

// validateImportFile:
// POST /api/data-imports/validate/
// Step 1 of the import pipeline — dry-run only, DOES NOT write to the database.
// Sends the file as multipart/form-data.
// Returns validation summary: how many rows are VALID, WARNING, or ERROR,
// and a preview of the first 200 rows with their per-cell issues.
// The 60s timeout allows the backend to validate large files row-by-row.
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

// executeBatchImport:
// POST /api/data-imports/import/
// Step 2 of the import pipeline — runs the actual database transaction.
// The backend re-validates, then bulk-inserts all valid/warning rows.
// skip_duplicates=true means rows with WARNING status (e.g. duplicate ear tag) are skipped.
// target_status controls whether imported records enter as APPROVED (official) or PENDING (needs review).
// The 120s timeout handles large historical datasets with hundreds of records.
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

// fetchBatches:
// GET /api/data-imports/batches/
// Lists the last 50 import batches with audit metadata.
// Used to populate the "Recent Imports" history table in the UI.
export async function fetchBatches(): Promise<DataImportBatchItem[]> {
  const response = await api.get<DataImportBatchItem[]>("/api/data-imports/batches/");
  return response.data;
}

// downloadTemplate:
// GET /api/data-imports/templates/<datasetType>/?format=xlsx
// Downloads an official pre-formatted spreadsheet template for MAO staff to fill out.
// Uses the browser's blob download mechanism rather than navigation (keeps auth headers).
// The anchor click trick triggers a file download without opening a new tab.
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

// downloadBatchErrors:
// GET /api/data-imports/batches/<batchId>/errors/
// Downloads a CSV file listing every row that was rejected during import,
// with field name, error type, severity, and error message for each failed row.
// MAO officers use this to correct the original spreadsheet and re-import.
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
