"use client";

import React, { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/app/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UploadCloud,
  FileUp,
  Info,
  CheckCircle2,
  Clock,
  Download,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Layers,
  Database,
  Check,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchDatasets,
  validateImportFile,
  executeBatchImport,
  fetchBatches,
  downloadTemplate,
  downloadBatchErrors,
  type DatasetInfo,
  type ValidationResult,
  type ImportSummary,
  type DataImportBatchItem,
  type PreviewRow,
} from "./data-imports-api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DATASET_ICONS: Record<string, string> = {
  livestock_inventory: "🐄",
  production: "🥛",
  disease: "🩺",
  mortality: "⚠️",
  slaughter: "🥩",
  auction: "🏷️",
};

export default function DataUploadsPage() {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>("livestock_inventory");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation state
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  // Import execution state
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [targetStatus, setTargetStatus] = useState<"APPROVED" | "PENDING">("APPROVED");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [showSummaryDialog, setShowSummaryDialog] = useState<boolean>(false);

  // Table filtering state
  const [statusFilter, setStatusFilter] = useState<"ALL" | "VALID" | "WARNING" | "ERROR">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // History state
  const [history, setHistory] = useState<DataImportBatchItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Initial load
  useEffect(() => {
    loadDatasets();
    loadHistory();
  }, []);

  const loadDatasets = async () => {
    try {
      const data = await fetchDatasets();
      setDatasets(data);
      if (data.length > 0 && !selectedDataset) {
        setSelectedDataset(data[0].code);
      }
    } catch (err: unknown) {
      toast.error("Failed to load dataset definitions from server.");
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchBatches();
      setHistory(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleSelectedFile = (selectedFile: File) => {
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase();
    if (ext !== ".csv" && ext !== ".xlsx" && ext !== ".xlsm") {
      toast.error("Unsupported file format. Please upload a .csv, .xlsx, or .xlsm spreadsheet.");
      return;
    }
    setFile(selectedFile);
    setValidationResult(null); // Reset preview on new file
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error("Please select a file to validate.");
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateImportFile(selectedDataset, file);
      setValidationResult(result);
      if (result.error_count === 0 && result.warning_count === 0) {
        toast.success(`Validation passed! All ${result.valid_count} rows are ready for import.`);
      } else if (result.error_count > 0) {
        toast.warning(
          `Validation complete: ${result.valid_count} valid, ${result.warning_count} warnings, ${result.error_count} errors.`
        );
      } else {
        toast.info(
          `Validation complete: ${result.valid_count} valid, ${result.warning_count} possible duplicates.`
        );
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Validation failed. Please verify spreadsheet structure.";
      toast.error(errorMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      const summary = await executeBatchImport(
        selectedDataset,
        file,
        skipDuplicates,
        targetStatus
      );
      setImportSummary(summary);
      setShowSummaryDialog(true);
      toast.success(
        `Batch import completed: ${summary.imported_rows} rows successfully ingested!`
      );
      // Reload history
      loadHistory();
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Import failed during database transaction.";
      toast.error(errorMsg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async (format: "xlsx" | "csv") => {
    try {
      await downloadTemplate(selectedDataset, format);
      toast.success(`Downloaded official ${selectedDataset} template (${format.toUpperCase()}).`);
    } catch (err: unknown) {
      toast.error("Failed to download template.");
    }
  };

  const resetForm = () => {
    setFile(null);
    setValidationResult(null);
    setImportSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filter preview rows
  const currentDatasetInfo = datasets.find((d) => d.code === selectedDataset);
  const hasLivestockTypeField = currentDatasetInfo?.available_fields.includes("livestock_type") ?? false;
  const previewRows: PreviewRow[] = (validationResult?.preview_rows || []).filter((row) => {
    if (statusFilter !== "ALL" && row.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const stringified = JSON.stringify(row.data).toLowerCase();
      return stringified.includes(q);
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Municipal Data Uploads & Batch Ingestion"
        subtitle="Import historical, externally collected, and field survey livestock data into the official municipal registry — Padre Garcia MAO"
        icon={<UploadCloud className="size-5 text-slate-800" />}
        variant="admin"
        maxWidthClass="w-full"
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-12">
        {/* ═══ Top Section: Dataset Selection & Template Download ═══ */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Database className="w-4 h-4 text-[#1E4D2B]" />
                Step 1: Select Target Municipal Dataset
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose the domain registry you are importing records into.
              </p>
            </div>

            {/* Template Download Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadTemplate("xlsx")}
                className="h-8 text-xs font-bold border-emerald-600 text-emerald-800 hover:bg-emerald-50 rounded-xl cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                Download Excel Template (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadTemplate("csv")}
                className="h-8 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                CSV Template
              </Button>
            </div>
          </div>

          {/* Dataset Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {datasets.map((d) => {
              const isSelected = selectedDataset === d.code;
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => {
                    setSelectedDataset(d.code);
                    setValidationResult(null); // Reset preview on domain switch
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-emerald-50/80 border-[#1E4D2B] shadow-2xs ring-1 ring-[#1E4D2B]"
                      : "bg-slate-50/60 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-lg">{DATASET_ICONS[d.code] || "📋"}</span>
                    {isSelected && (
                      <span className="size-4 rounded-full bg-[#1E4D2B] text-white flex items-center justify-center text-[10px] font-black">
                        ✓
                      </span>
                    )}
                  </div>
                  <div>
                    <h3
                      className={`text-xs font-black truncate ${
                        isSelected ? "text-[#1E4D2B]" : "text-slate-800"
                      }`}
                    >
                      {d.label}
                    </h3>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {d.required_fields.join(", ")}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dataset Guidance Banner */}
          {currentDatasetInfo && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-800 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900">{currentDatasetInfo.label}:</span>{" "}
                {currentDatasetInfo.description}{" "}
                <span className="text-slate-500 font-medium">
                  (Required headers:{" "}
                  <code className="bg-slate-200/70 text-slate-800 px-1 py-0.5 rounded text-[11px] font-mono">
                    {currentDatasetInfo.required_fields.join(", ")}
                  </code>
                  )
                </span>
                {currentDatasetInfo.code === "livestock_inventory" && currentDatasetInfo.available_fields.includes("birth_date") && (
                  <span className="mt-1 block text-slate-600">Optional header: <code className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[11px]">birth_date</code>. Leave blank when the birth date is unknown.</span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ═══ Middle Section: File Upload & Drag & Drop ═══ */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
          <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileUp className="w-4 h-4 text-[#1E4D2B]" />
            Step 2: Upload Spreadsheet (CSV, XLSX, or XLSM)
          </h2>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive
                ? "border-[#1E4D2B] bg-emerald-50/50"
                : file
                ? "border-emerald-500/80 bg-emerald-50/20"
                : "border-slate-300 bg-slate-50/50 hover:bg-slate-100/60 hover:border-slate-400"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".csv, .xlsx, .xlsm"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="max-w-md mx-auto space-y-2">
              <div
                className={`size-14 rounded-2xl flex items-center justify-center mx-auto transition-colors ${
                  file ? "bg-emerald-100 text-[#1E4D2B]" : "bg-slate-100 text-slate-500"
                }`}
              >
                <UploadCloud className="size-7" />
              </div>

              {file ? (
                <div>
                  <p className="text-sm font-black text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB &bull; Ready for schema validation
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Drag and drop your CSV or XLSX file here, or click to browse
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports Excel (.xlsx, .xlsm) and CSV (.csv) files up to 25MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {file && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-9 text-xs text-slate-600 hover:text-rose-600 cursor-pointer"
                >
                  Clear Selection
                </Button>
              )}
            </div>

            <Button
              onClick={handleValidate}
              disabled={!file || isValidating}
              className="h-9 bg-[#1E4D2B] hover:bg-[#163b21] text-white px-5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Validating Spreadsheet...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Validate File &amp; Preview
                </>
              )}
            </Button>
          </div>
        </section>

        {/* ═══ Validation Results & Preview Section ═══ */}
        {validationResult && (
          <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-5 animate-in fade-in duration-300">
            {/* Header & KPI Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1E4D2B]" />
                  Step 3: Validation Audit &amp; Data Preview
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  File: <strong className="text-slate-800">{validationResult.file_name}</strong> &bull;{" "}
                  Domain: <strong className="text-slate-800">{validationResult.dataset_label}</strong>
                </p>
              </div>

              {/* Workflow Target Status Selector & Skip Duplicates */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="rounded text-emerald-700 focus:ring-emerald-600 h-4 w-4"
                  />
                  Skip rows with warnings
                </label>

                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span>Target Status:</span>
                  <select
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value as "APPROVED" | "PENDING")}
                    className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2 text-xs font-semibold text-slate-800 focus:outline-emerald-600"
                  >
                    <option value="APPROVED">Approved (Historical Record)</option>
                    <option value="PENDING">Pending (Requires Review)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                  Total Rows
                </span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">
                  {validationResult.total_rows.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <span className="text-[11px] font-black text-emerald-800 uppercase tracking-widest block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  Valid Rows
                </span>
                <span className="text-xl font-black text-emerald-900 mt-0.5 block">
                  {validationResult.valid_count.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
                <span className="text-[11px] font-black text-amber-800 uppercase tracking-widest block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  Duplicates / Warnings
                </span>
                <span className="text-xl font-black text-amber-900 mt-0.5 block">
                  {validationResult.warning_count.toLocaleString()}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
                <span className="text-[11px] font-black text-rose-800 uppercase tracking-widest block flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-700" />
                  Errors (Rejected)
                </span>
                <span className="text-xl font-black text-rose-900 mt-0.5 block">
                  {validationResult.error_count.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Filters and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
                {(["ALL", "VALID", "WARNING", "ERROR"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? "bg-[#1E4D2B] text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st === "ALL"
                      ? "All Rows"
                      : st === "VALID"
                      ? "Valid Only"
                      : st === "WARNING"
                      ? "Warnings"
                      : "Errors"}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <Input
                  type="text"
                  placeholder="Search preview rows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>
            </div>

            {/* Interactive Preview Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <TableRow className="hover:bg-slate-50">
                    <TableHead className="w-14 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">
                      Row
                    </TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Barangay
                    </TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Farmer
                    </TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      {hasLivestockTypeField ? "Livestock Type / Details" : "Record / Details"}
                    </TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">
                      Qty
                    </TableHead>
                    <TableHead className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      Validation Notes &amp; Issues
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {previewRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                        No rows matching the current filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewRows.map((r) => {
                      const isErr = r.status === "ERROR";
                      const isWarn = r.status === "WARNING";
                      return (
                        <TableRow
                          key={r.row_number}
                          className={`hover:bg-slate-50/80 text-xs transition-colors ${
                            isErr ? "bg-rose-50/30" : isWarn ? "bg-amber-50/20" : ""
                          }`}
                        >
                          <TableCell className="font-mono text-center font-bold text-slate-500">
                            {r.row_number}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isErr
                                  ? "bg-rose-100 text-rose-800 border-rose-200"
                                  : isWarn
                                  ? "bg-amber-100 text-amber-800 border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-200"
                              }`}
                            >
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-slate-800">
                            {String(r.data.barangay_name || r.data.barangay || "—")}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {String(r.data.farmer_name || r.data.farmer || "—")}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {String(
                              r.data.livestock_type ||
                                r.data.species ||
                                r.data.production_type ||
                                r.data.disease_name ||
                                r.data.cause ||
                                "—"
                            )}
                            {r.data.tag_number ? ` (${r.data.tag_number})` : ""}
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-800">
                            {String(
                              r.data.quantity || r.data.affected_count || r.data.death_count || "1"
                            )}
                          </TableCell>
                          <TableCell>
                            {r.issues.length > 0 ? (
                              <div className="space-y-1">
                                {r.issues.map((iss, i) => (
                                  <p
                                    key={i}
                                    className={`text-[11px] leading-tight font-medium flex items-center gap-1 ${
                                      iss.severity === "ERROR" ? "text-rose-700" : "text-amber-700"
                                    }`}
                                  >
                                    <span className="font-bold">
                                      [{iss.field === "livestock_type" ? "Livestock Type" : iss.field}]:
                                    </span>{" "}
                                    {iss.message}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <span className="text-emerald-700 text-[11px] font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Ready to import
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="w-full sm:w-auto h-9 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-50 rounded-xl cursor-pointer"
              >
                Cancel &amp; Upload Different File
              </Button>

              <Button
                onClick={handleExecuteImport}
                disabled={
                  validationResult.valid_count + (skipDuplicates ? 0 : validationResult.warning_count) === 0 ||
                  isImporting
                }
                className="w-full sm:w-auto h-9 bg-[#1E4D2B] hover:bg-[#163b21] text-white px-6 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Executing Batch Import...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 mr-1.5" />
                    Confirm &amp; Import {(
                      validationResult.valid_count + (skipDuplicates ? 0 : validationResult.warning_count)
                    ).toLocaleString()} Records
                  </>
                )}
              </Button>
            </div>
          </section>
        )}

        {/* ═══ Bottom Section: Historical Ingestion Logs ═══ */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
            <h3 className="font-black text-slate-900 flex items-center gap-2 text-xs tracking-tight">
              <Clock className="w-3.5 h-3.5 text-[#1E4D2B]" />
              Official Batch Import History &amp; Auditable Logs
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="h-7 text-xs text-slate-500 hover:text-slate-800"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoadingHistory ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Batch #
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Domain Type
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  File Name
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Imported
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Skipped
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Rejected
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Status
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                  Uploaded By
                </TableHead>
                <TableHead className="px-5 py-2.5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Error Report
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400 text-xs">
                    {isLoadingHistory ? "Loading audit logs..." : "No bulk imports logged yet."}
                  </TableCell>
                </TableRow>
              ) : (
                history.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="px-5 py-3 text-xs font-mono font-bold text-[#1E4D2B]">
                      #{log.id}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs font-semibold text-slate-800">
                      {log.dataset_type_display}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs text-slate-600 truncate max-w-[180px]">
                      {log.file_name}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs font-bold text-center text-emerald-700">
                      {log.imported_rows.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs font-bold text-center text-amber-700">
                      {log.skipped_rows.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs font-bold text-center text-rose-700">
                      {log.error_rows.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          log.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : log.status === "PARTIAL"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : log.status === "FAILED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-sky-50 text-sky-800 border-sky-200"
                        }`}
                      >
                        {log.status_display}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-3 text-xs font-medium text-slate-600">
                      {log.uploaded_by_name}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-right">
                      {log.error_rows > 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadBatchErrors(log.id)}
                          className="h-7 text-xs font-bold text-rose-700 hover:text-rose-900 hover:bg-rose-50 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Download CSV
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>

      {/* ═══ Import Summary Dialog ═══ */}
      <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white p-6">
          <DialogHeader>
            <div className="size-12 rounded-2xl bg-emerald-100 text-[#1E4D2B] flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="size-7 text-[#1E4D2B]" />
            </div>
            <DialogTitle className="text-center font-black text-slate-900 text-lg">
              Batch Ingestion Complete!
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500">
              Your spreadsheet has been safely written into the municipal livestock registry.
            </DialogDescription>
          </DialogHeader>

          {importSummary && (
            <div className="space-y-3 my-2">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dataset Domain:</span>
                  <span className="font-bold text-slate-900 uppercase">
                    {importSummary.dataset_type.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch Code:</span>
                  <span className="font-mono font-bold text-[#1E4D2B]">
                    #{importSummary.batch_id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Rows Processed:</span>
                  <span className="font-bold text-slate-900">{importSummary.total_rows}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span className="font-semibold">Successfully Ingested:</span>
                  <span className="font-bold">{importSummary.imported_rows}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span className="font-semibold">Duplicates Skipped:</span>
                  <span className="font-bold">{importSummary.skipped_rows}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span className="font-semibold">Rejected / Errors:</span>
                  <span className="font-bold">{importSummary.rejected_rows}</span>
                </div>
                <div className="flex justify-between text-slate-500 border-t border-slate-200 pt-2">
                  <span>Execution Duration:</span>
                  <span className="font-mono font-semibold">
                    {importSummary.duration_seconds}s
                  </span>
                </div>
              </div>

              {importSummary.rejected_rows > 0 && (
                <Button
                  variant="outline"
                  onClick={() => downloadBatchErrors(importSummary.batch_id)}
                  className="w-full h-8 text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download Error Report for Failed Rows
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSummaryDialog(false);
                resetForm();
              }}
              className="w-full sm:w-1/2 h-9 text-xs font-bold"
            >
              Upload Another Batch
            </Button>
            <Button
              onClick={() => {
                setShowSummaryDialog(false);
                window.location.href = "/data-overview";
              }}
              className="w-full sm:w-1/2 h-9 bg-[#1E4D2B] hover:bg-[#163b21] text-white text-xs font-bold"
            >
              View in System Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
