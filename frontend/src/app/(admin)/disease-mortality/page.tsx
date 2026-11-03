"use client";

import { PageHeader } from "@/app/components/page-header";
import { SurveillanceCoveragePanel } from "@/app/components/analytics/surveillance-coverage-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTableSection } from "@/components/ui/data-table-section";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import api from "@/lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Activity,
  CheckCircle2,
  Clock,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Stethoscope,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Domain & Analytics from data-validation
import {
  ValidationIncidentItem,
  ValidationStatus,
  fetchAdminIncidentRecords,
} from "../data-validation/validation-analytics";
import { useAdminBarangays } from "../admin/admin-charts";

// Components from data-validation
import { BulkActionDock } from "../data-validation/components/bulk-action-dock";
import { DiseaseMortalityReviewDialog } from "../data-validation/components/disease-mortality-review-dialog";
import { IncidentsTable } from "../data-validation/components/incidents-table";
import { ValidationPagination } from "../data-validation/components/validation-pagination";
import {
  RecordDetailDialog,
  type DetailRecordData,
} from "../data-validation/record-detail-dialog";
import {
  ValidationReviewDialog,
  type ReviewTargetItem,
} from "../data-validation/validation-review-dialog";

function matchesStatusFilter(
  rawStatus: string | null | undefined,
  statusFilter: ValidationStatus
): boolean {
  if (statusFilter === "ALL") return true;
  const s = (rawStatus || "PENDING").toUpperCase();
  if (statusFilter === "AWAITING_MAO" || (statusFilter as string) === "CBAT_VERIFIED") return s === "VERIFIED";
  if (statusFilter === "SUBJECT_TO_REVISION") {
    return (
      s === "SUBJECT_TO_REVISION" ||
      s === "SUBJECT_FOR_REVISION" ||
      s === "REJECTED" ||
      s === "FLAGGED"
    );
  }
  return s === statusFilter;
}

function DiseaseMortalityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Tab State: 'disease', 'mortality', or 'all'
  const initialTab = searchParams.get("tab") === "mortality"
    ? "mortality"
    : searchParams.get("tab") === "all"
    ? "all"
    : "disease";

  const [activeTab, setActiveTab] = useState<"disease" | "mortality" | "all">(initialTab);

  const handleTabChange = (tab: "disease" | "mortality" | "all") => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`/disease-mortality?${params.toString()}`, { scroll: false });
  };

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<ValidationStatus>("ALL");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  // Dialog States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [recordDetailModal, setRecordDetailModal] = useState<{ open: boolean; data: DetailRecordData | null }>({
    open: false,
    data: null,
  });
  const [healthReviewDialog, setHealthReviewDialog] = useState<{ open: boolean; record: ValidationIncidentItem | null }>({
    open: false,
    record: null,
  });
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTargetItems, setReviewTargetItems] = useState<ReviewTargetItem[]>([]);

  // ── Queries ──
  const { data: barangays = [] } = useAdminBarangays();

  const {
    data: rawIncidents = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<ValidationIncidentItem[]>({
    queryKey: ["admin-incident-records"],
    queryFn: fetchAdminIncidentRecords,
    staleTime: 60 * 1000,
  });

  // Filter only disease & mortality incidents
  const healthIncidents = useMemo(() => {
    return rawIncidents.filter((inc) => inc.type === "disease" || inc.type === "mortality");
  }, [rawIncidents]);

  // KPIs
  const kpis = useMemo(() => {
    const diseaseTotal = healthIncidents.filter((inc) => inc.type === "disease").length;
    const mortalityTotal = healthIncidents.filter((inc) => inc.type === "mortality").length;
    const awaitingMao = healthIncidents.filter(
      (inc) => (inc.status || "PENDING").toUpperCase() === "VERIFIED"
    ).length;
    const approvedTotal = healthIncidents.filter(
      (inc) => (inc.status || "").toUpperCase() === "APPROVED"
    ).length;

    return {
      disease: diseaseTotal,
      mortality: mortalityTotal,
      awaitingMao,
      approved: approvedTotal,
    };
  }, [healthIncidents]);

  // Active Filtered Records
  const filteredRecords = useMemo(() => {
    return healthIncidents.filter((inc) => {
      // Tab matching
      if (activeTab === "disease" && inc.type !== "disease") return false;
      if (activeTab === "mortality" && inc.type !== "mortality") return false;

      // Search matching
      const q = debouncedSearch.toLowerCase();
      const matchSearch =
        !q ||
        inc.farmerName.toLowerCase().includes(q) ||
        inc.barangayName.toLowerCase().includes(q) ||
        inc.details.toLowerCase().includes(q) ||
        (inc.tagNumber && inc.tagNumber.toLowerCase().includes(q)) ||
        (inc.livestockType && inc.livestockType.toLowerCase().includes(q));

      // Barangay matching
      const matchBarangay = barangayFilter === "ALL" || inc.barangayName === barangayFilter;

      // Status matching
      const matchStatus = matchesStatusFilter(inc.status, statusFilter);

      return matchSearch && matchBarangay && matchStatus;
    });
  }, [healthIncidents, activeTab, debouncedSearch, barangayFilter, statusFilter]);

  // Paginated Records
  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRecords = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, safeCurrentPage, pageSize]);

  // ── Handlers ──
  const handleToggleSelect = (id: string | number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    const reviewableIds = paginatedRecords
      .filter((r) => (r.status || "PENDING").toUpperCase() === "VERIFIED")
      .map((r) => r.id);
    setSelectedIds(reviewableIds);
  };

  const openReviewSingle = (target: ReviewTargetItem) => {
    setReviewTargetItems([target]);
    setReviewDialogOpen(true);
  };

  const openReviewBatch = () => {
    if (selectedIds.length === 0) return;
    const targets = healthIncidents
      .filter((inc) => selectedIds.includes(inc.id) && (inc.status || "PENDING").toUpperCase() === "VERIFIED")
      .map((inc) => ({
        id: inc.id,
        domain: "incidents" as const,
        title: `${inc.type === "disease" ? "Disease Case" : "Mortality Record"} — ${inc.farmerName}`,
        farmerOrSubmitter: inc.farmerName,
        barangay: inc.barangayName,
        keyMetric: inc.type.toUpperCase(),
        currentRemarks: inc.reviewRemarks,
        photoUrl: inc.photoUrl,
        photoName: inc.photoName,
        inspectorPhotoUrl: inc.inspectorPhotoUrl,
        inspectorPhotoName: inc.inspectorPhotoName,
      }));

    if (targets.length === 0) {
      toast.info("Please select CBAT-verified records ready for MAO certification.");
      return;
    }

    setReviewTargetItems(targets);
    setReviewDialogOpen(true);
  };

  // Review confirmation for single & batch
  const handleConfirmAction = async (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    itemIds: (string | number)[]
  ) => {
    try {
      await Promise.all(
        itemIds.map((id) => {
          const strId = String(id);
          if (strId.startsWith("dis-")) {
            const cleanId = strId.replace("dis-", "");
            return api.post(`diseases/cases/${cleanId}/review/`, { status: action, remarks });
          } else if (strId.startsWith("mor-")) {
            const cleanId = strId.replace("mor-", "");
            return api.post(`diseases/mortality/${cleanId}/review/`, { status: action, remarks });
          }
          return Promise.resolve();
        })
      );

      await queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });

      setSelectedIds([]);
      setReviewDialogOpen(false);

      const actionVerb = action === "APPROVED" ? "approved & certified" : "returned for revision";
      toast.success(
        itemIds.length === 1
          ? `Record successfully ${actionVerb}.`
          : `${itemIds.length} records successfully ${actionVerb}.`
      );
    } catch (err) {
      console.error("Failed to perform review action:", err);
      const responseData = axios.isAxiosError(err)
        ? (err.response?.data as { remarks?: string; error?: string; status?: string } | undefined)
        : undefined;
      toast.error("Review action failed.", {
        description: responseData?.remarks || responseData?.error || "Please try again.",
      });
      throw err;
    }
  };

  // Review confirmation for DiseaseMortalityReviewDialog
  const handleConfirmHealthAction = async (
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    recordId: string
  ) => {
    try {
      if (recordId.startsWith("dis-")) {
        const cleanId = recordId.replace("dis-", "");
        await api.post(`diseases/cases/${cleanId}/review/`, { status: action, remarks });
      } else if (recordId.startsWith("mor-")) {
        const cleanId = recordId.replace("mor-", "");
        await api.post(`diseases/mortality/${cleanId}/review/`, { status: action, remarks });
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-incident-records"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });

      setHealthReviewDialog({ open: false, record: null });
      const actionVerb = action === "APPROVED" ? "approved & certified" : "returned for revision";
      toast.success(`Record successfully ${actionVerb}.`);
    } catch (err) {
      console.error("Failed to review health incident:", err);
      toast.error("Failed to update health review status.");
    }
  };

  return (
    <>
      {/* ── Official Admin Header ── */}
      <PageHeader
        title="Disease &amp; Mortality Reports"
        subtitle="Official Municipal Agriculture Office (MAO) disease surveillance and mortality field declarations"
        variant="admin"
        maxWidthClass="w-full"
        icon={
          <div className="size-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center text-emerald-800 font-black shadow-2xs">
            <ShieldCheck className="size-5" />
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              className="bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 h-9 cursor-pointer"
            >
              <QrCode className="size-4" />
              <span>Scan Ear Tag / Pass</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 gap-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      />

      {/* ── Main Workspace with Futuristic Background Pattern ── */}
      <div className="relative isolate min-h-[calc(100vh-8rem)] w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16 sm:pb-8">
        <SurveillanceCoveragePanel />
        {/* Subtle futuristic grid background pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(rgba(16,185,129,0.14)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,#000_40%,transparent_100%)] opacity-70"
        />

        {/* ── 4 Futuristic KPI Summary Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Disease Surveillance */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-amber-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Disease Cases
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-900 font-mono block mt-0.5">
                  {kpis.disease}
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md inline-block mt-1">
                  Surveillance Cases
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
                <Stethoscope className="w-5 h-5 text-amber-700" />
              </div>
            </CardContent>
          </Card>

          {/* Mortality Records */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-rose-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Mortality Records
                </span>
                <span className="text-2xl sm:text-3xl font-black text-rose-900 font-mono block mt-0.5">
                  {kpis.mortality}
                </span>
                <span className="text-[10px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md inline-block mt-1">
                  Death Declarations
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-rose-100 to-rose-50 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200 shadow-2xs">
                <Skull className="w-5 h-5 text-rose-700" />
              </div>
            </CardContent>
          </Card>

          {/* Awaiting MAO Review */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-sky-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Awaiting MAO Review
                </span>
                <span className="text-2xl sm:text-3xl font-black text-sky-900 font-mono block mt-0.5">
                  {kpis.awaitingMao}
                </span>
                <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                  CBAT Verified
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-sky-100 to-sky-50 text-sky-800 flex items-center justify-center shrink-0 border border-sky-200 shadow-2xs">
                <Clock className="w-5 h-5 text-sky-700" />
              </div>
            </CardContent>
          </Card>

          {/* Approved / Certified */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Certified Declarations
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono block mt-0.5">
                  {kpis.approved}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                  Official Records
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Top Navigation Tabs (Disease vs Mortality vs All) ── */}
        <div className="flex items-center justify-between border-b border-slate-200/90 pb-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleTabChange("all")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "all"
                  ? "bg-[#1E4D2B] text-white shadow-sm ring-1 ring-emerald-950/20"
                  : "bg-white/80 text-slate-700 hover:text-slate-950 hover:bg-white border border-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>All Declarations</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${activeTab === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {kpis.disease + kpis.mortality}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("mortality")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "mortality"
                  ? "bg-[#1E4D2B] text-white shadow-sm ring-1 ring-emerald-950/20"
                  : "bg-white/80 text-slate-700 hover:text-slate-950 hover:bg-white border border-slate-200"
              }`}
            >
              <Skull className="w-4 h-4" />
              <span>Mortality Reports</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${activeTab === "mortality" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {kpis.mortality}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("disease")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "disease"
                  ? "bg-[#1E4D2B] text-white shadow-sm ring-1 ring-emerald-950/20"
                  : "bg-white/80 text-slate-700 hover:text-slate-950 hover:bg-white border border-slate-200"
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>Disease Reports</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${activeTab === "disease" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {kpis.disease}
              </span>
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {selectedIds.length} selected
              </span>
              <Button
                size="sm"
                onClick={openReviewBatch}
                className="h-8 px-3 rounded-xl bg-[#1E4D2B] hover:bg-emerald-800 text-white text-xs font-bold gap-1 shadow-xs"
              >
                <ShieldCheck className="size-3.5" />
                <span>Bulk Certify</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds([])}
                className="h-8 px-2 text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* ── Filter Toolbar ── */}
        <div className="bg-white/95 backdrop-blur-xs p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="relative lg:col-span-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search tag number, farmer, barangay, symptoms, or cause of death..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl border-slate-200 text-xs focus-visible:ring-emerald-500 bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* Barangay Dropdown */}
            <div className="lg:col-span-3">
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50">
                  <SelectValue placeholder="All Barangays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Barangays</SelectItem>
                  {barangays.map((bg) => (
                    <SelectItem key={bg.id} value={bg.barangay_name}>
                      {bg.barangay_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Dropdown */}
            <div className="lg:col-span-3">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as ValidationStatus)}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="AWAITING_MAO">Awaiting MAO Review</SelectItem>
                  <SelectItem value="VERIFIED">CBAT Verified</SelectItem>
                  <SelectItem value="APPROVED">Certified / Approved</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Revision Required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(debouncedSearch || barangayFilter !== "ALL" || statusFilter !== "ALL") && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">Active filters applied</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setBarangayFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="h-6 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-lg"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* ── Main Incidents Content Table (matching Data Validation format) ── */}
        <DataTableSection
          footer={
            <ValidationPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
            />
          }
        >
          {isLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <RefreshCw className="w-7 h-7 mx-auto text-emerald-600 animate-spin mb-3" />
              <p className="text-sm font-bold text-slate-800">Loading Surveillance &amp; Mortality Records...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <ShieldAlert className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-base font-bold text-slate-800">No declarations found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No disease or mortality records matched your active search query or filter criteria.
              </p>
            </div>
          ) : (
            <IncidentsTable
              records={paginatedRecords}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onSelectAll={handleSelectAll}
              onViewDetail={(data) => setRecordDetailModal({ open: true, data })}
              onReview={openReviewSingle}
              onReviewHealth={(record) => setHealthReviewDialog({ open: true, record })}
            />
          )}
        </DataTableSection>

        {/* ── FLOATING MOBILE BULK ACTION DOCK ── */}
        <BulkActionDock
          count={selectedIds.length}
          onValidate={openReviewBatch}
          onClear={() => setSelectedIds([])}
        />

        {/* ── SINGLE / BATCH REVIEW DIALOG ── */}
        <ValidationReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          items={reviewTargetItems}
          onConfirmAction={handleConfirmAction}
        />

        {/* ── HEALTH & MORTALITY VERIFICATION DIALOG (with symptoms, FMD signs, necropsy) ── */}
        <DiseaseMortalityReviewDialog
          record={healthReviewDialog.record}
          open={healthReviewDialog.open}
          onOpenChange={(open) => setHealthReviewDialog((prev) => ({ ...prev, open }))}
          onConfirmAction={handleConfirmHealthAction}
        />

        {/* ── RECORD DETAIL DIALOG ── */}
        <RecordDetailDialog
          record={recordDetailModal.data}
          open={recordDetailModal.open}
          onOpenChange={(open) => setRecordDetailModal((prev) => ({ ...prev, open }))}
        />

        {/* ── UNIVERSAL QR SCANNER DIALOG ── */}
        <UniversalQrScannerDialog
          isOpen={isScannerOpen}
          onOpenChange={setIsScannerOpen}
          role="admin"
        />
      </div>
    </>
  );
}

export default function DiseaseMortalityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAF9] p-8 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading Health Reports...</span>
          </div>
        </div>
      }
    >
      <DiseaseMortalityContent />
    </Suspense>
  );
}
