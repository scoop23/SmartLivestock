"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileSpreadsheet,
  Layers,
  Milk,
  Plus,
  Shield,
  Stethoscope,
  Tag,
  AlertTriangle,
  ClipboardCheck,
  Sparkles,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import SibatKpiSection from "./components/sibat-kpi-section";
import SibatHealthQueue from "./components/sibat-health-queue";
import SibatProductionQueue from "./components/sibat-production-queue";
import SibatInventoryQueue from "./components/sibat-inventory-queue";
import SibatReviewDialog from "./components/sibat-review-dialog";
import {
  SibatInspectionDialog,
  type SibatValidationRecord,
  type SibatInspectionData,
} from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";
import CensusSubmissionDialog from "./census-submission-dialog";
import CensusDetailsDialog from "./census-details-dialog";
import CensusSubmissionsView from "./census-submissions-view";

import {
  useSibatSubmissions,
  useCensusSubmission,
  useClinicalHealthRecords,
  useReviewClinicalHealth,
  type UnifiedSubmissionItem,
  type CensusSubmissionRecord,
} from "./sibat-analytics";

type SibatActiveTab = "health" | "production" | "inventory" | "census";

function SibatPortalContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active Tab: "health" | "production" | "inventory" | "census"
  const tabParam = searchParams.get("tab") as SibatActiveTab | null;
  const [activeTab, setActiveTab] = useState<SibatActiveTab>(
    tabParam && ["health", "production", "inventory", "census"].includes(tabParam)
      ? tabParam
      : "health"
  );

  useEffect(() => {
    if (tabParam && ["health", "production", "inventory", "census"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (newTab: SibatActiveTab) => {
    setActiveTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", newTab);
    window.history.replaceState({}, "", url.toString());
  };

  // ── 1. Clinical Health & Mortality State ──
  const { records: healthRecords, isLoading: isLoadingHealth } = useClinicalHealthRecords();
  const [selectedHealthRecord, setSelectedHealthRecord] = useState<SibatValidationRecord | null>(null);
  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);
  const [healthStatusFilter, setHealthStatusFilter] = useState("ALL");
  const [healthTypeFilter, setHealthTypeFilter] = useState<"ALL" | "DISEASE" | "MORTALITY">("ALL");
  const [healthBarangayFilter, setHealthBarangayFilter] = useState("ALL");
  const [healthSearchQuery, setHealthSearchQuery] = useState("");

  const reviewHealthMutation = useReviewClinicalHealth();

  // ── 2. Production & Inventory State ──
  const { submissions, isLoading: isLoadingSubmissions } = useSibatSubmissions();
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<UnifiedSubmissionItem | null>(null);

  // Production Filters
  const [prodStatusFilter, setProdStatusFilter] = useState<"all" | "pending" | "verified" | "decided">("all");
  const [prodSearchQuery, setProdSearchQuery] = useState("");
  const [prodTypeFilter, setProdTypeFilter] = useState("ALL");

  // Inventory Filters
  const [invStatusFilter, setInvStatusFilter] = useState<"all" | "pending" | "verified" | "decided">("all");
  const [invSearchQuery, setInvSearchQuery] = useState("");
  const [invEntryTypeFilter, setInvEntryTypeFilter] = useState<"ALL" | "INDIVIDUAL" | "BATCH">("ALL");

  // ── 3. Census State ──
  const { data: censuses = [], isLoading: isLoadingCensus } = useCensusSubmission();
  const [isCensusDialogOpen, setIsCensusDialogOpen] = useState(false);
  const [selectedCensusForDetail, setSelectedCensusForDetail] = useState<CensusSubmissionRecord | null>(null);

  // Health Inspection Dialog triggers
  const handleOpenInspection = (record: SibatValidationRecord) => {
    setSelectedHealthRecord(record);
    setIsInspectionDialogOpen(true);
  };

  const handleConfirmInspection = (
    recordId: string,
    action: "VERIFIED" | "FLAGGED" | "FALSE_ALARM",
    inspectionData: SibatInspectionData
  ) => {
    reviewHealthMutation.mutate(
      {
        recordId,
        action,
        inspectionData,
      },
      {
        onSuccess: () => {
          if (action === "VERIFIED") {
            toast.success(`Record ${recordId} verified! ✨`, {
              description: "Status updated to VERIFIED. Forwarded to MAO queue for municipal sign-off.",
            });
          } else if (action === "FLAGGED") {
            toast.warning(`Record ${recordId} flagged for vet review.`, {
              description: "Quarantine & diagnostic follow-up logged.",
            });
          } else {
            toast.info(`Record ${recordId} marked as discrepancy / false alarm.`);
          }
          setIsInspectionDialogOpen(false);
          setSelectedHealthRecord(null);
        },
        onError: (err: any) => {
          toast.error("Failed to submit review", {
            description: err?.response?.data?.error || err?.message || "Check network connection",
          });
        },
      }
    );
  };

  // Census dialog callbacks
  const handleCensusSubmissionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["census-submissions"] });
    handleTabChange("census");
  };

  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["sibat-production-records"] });
    queryClient.invalidateQueries({ queryKey: ["sibat-inventory-records"] });
  };

  // Counts for Badges
  const pendingHealthCount = healthRecords.filter((r) => r.status === "PENDING").length;
  const pendingProdCount = submissions.filter((s) => s.sourceType === "PRODUCTION" && s.status === "PENDING").length;
  const pendingInvCount = submissions.filter((s) => s.sourceType === "INVENTORY" && s.status === "PENDING").length;

  return (
    <>
      <PageHeader
        title="Field Inspection Hub"
        subtitle="Padre Garcia Municipal Field Sector — On-Farm Inspections, Yield Calibrations & Barangay Census"
        variant="sibat"
        maxWidthClass="w-full"
      />

      {/* ═══ Warm, Friendly Welcome Banner ═══ */}
      <div className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 border-b border-amber-500/20 shadow-xs">
        <div className="w-full px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#1A365D] text-amber-300 flex items-center justify-center font-black shrink-0 shadow-xs text-lg">
              👋
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-black text-[#1A365D]">
                  Welcome back, SIBAT Field Officer!
                </p>
                <span className="bg-[#1A365D]/15 text-[#1A365D] font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                  🌾 Padre Garcia Field Sector
                </span>
              </div>
              <p className="text-xs font-semibold text-[#1A365D]/80">
                Tip: When you verify records on the farm, they are instantly sent to MAO for municipal sign-off.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsCensusDialogOpen(true)}
              className="bg-[#1A365D] hover:bg-[#132742] text-white text-xs font-bold rounded-2xl shadow-xs gap-1.5 h-9 px-4 cursor-pointer"
            >
              <Plus className="size-3.5 text-amber-300" />
              New Census Survey
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 w-full space-y-6">
        {/* ═══ Live High-Level Telemetry ═══ */}
        <SibatKpiSection
          healthRecords={healthRecords}
          submissions={submissions}
          censuses={censuses}
          isLoadingHealth={isLoadingHealth}
          isLoadingSubmissions={isLoadingSubmissions}
          isLoadingCensus={isLoadingCensus}
          onSelectTab={handleTabChange}
        />

        {/* ═══ 4 Master Operational Tabs (Casual & Friendly) ═══ */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-3xl max-w-full overflow-x-auto border border-slate-200">
          {/* Tab 1: Clinical Health */}
          <button
            type="button"
            onClick={() => handleTabChange("health")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "health"
                ? "bg-[#1A365D] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="text-sm">🩺</span>
            <span>Health & Illness Visits</span>
            {pendingHealthCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                {pendingHealthCount}
              </span>
            )}
          </button>

          {/* Tab 2: Production Logs */}
          <button
            type="button"
            onClick={() => handleTabChange("production")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "production"
                ? "bg-[#1A365D] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="text-sm">🥛</span>
            <span>Milk & Harvest Logs</span>
            {pendingProdCount > 0 && (
              <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-black">
                {pendingProdCount}
              </span>
            )}
          </button>

          {/* Tab 3: Livestock Inventory */}
          <button
            type="button"
            onClick={() => handleTabChange("inventory")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "inventory"
                ? "bg-[#1A365D] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="text-sm">🏷️</span>
            <span>Animal Ear Tagging</span>
            {pendingInvCount > 0 && (
              <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 rounded-full font-black">
                {pendingInvCount}
              </span>
            )}
          </button>

          {/* Tab 4: Quarterly Census */}
          <button
            type="button"
            onClick={() => handleTabChange("census")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === "census"
                ? "bg-[#1A365D] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span className="text-sm">📋</span>
            <span>Barangay Census Surveys ({censuses.length})</span>
          </button>
        </div>

        {/* ═══ TAB 1 VIEW: Clinical Health & Mortality ═══ */}
        {activeTab === "health" && (
          <SibatHealthQueue
            records={healthRecords}
            isLoading={isLoadingHealth}
            onInspectRecord={handleOpenInspection}
            statusFilter={healthStatusFilter}
            onStatusFilterChange={setHealthStatusFilter}
            typeFilter={healthTypeFilter}
            onTypeFilterChange={setHealthTypeFilter}
            barangayFilter={healthBarangayFilter}
            onBarangayFilterChange={setHealthBarangayFilter}
            searchQuery={healthSearchQuery}
            onSearchChange={setHealthSearchQuery}
          />
        )}

        {/* ═══ TAB 2 VIEW: Production Logs ═══ */}
        {activeTab === "production" && (
          <SibatProductionQueue
            submissions={submissions}
            isLoading={isLoadingSubmissions}
            onReview={(item) => setSelectedSubmissionForReview(item)}
            statusFilter={prodStatusFilter}
            onStatusFilterChange={setProdStatusFilter}
            searchQuery={prodSearchQuery}
            onSearchChange={setProdSearchQuery}
            prodTypeFilter={prodTypeFilter}
            onProdTypeFilterChange={setProdTypeFilter}
          />
        )}

        {/* ═══ TAB 3 VIEW: Livestock & Ear Tagging ═══ */}
        {activeTab === "inventory" && (
          <SibatInventoryQueue
            submissions={submissions}
            isLoading={isLoadingSubmissions}
            onReview={(item) => setSelectedSubmissionForReview(item)}
            statusFilter={invStatusFilter}
            onStatusFilterChange={setInvStatusFilter}
            searchQuery={invSearchQuery}
            onSearchChange={setInvSearchQuery}
            entryTypeFilter={invEntryTypeFilter}
            onEntryTypeFilterChange={setInvEntryTypeFilter}
          />
        )}

        {/* ═══ TAB 4 VIEW: Quarterly Census Surveys ═══ */}
        {activeTab === "census" && (
          <CensusSubmissionsView
            censusSubmissions={censuses}
            onOpenSubmitDialog={() => setIsCensusDialogOpen(true)}
            onSelectCensusForDetail={(census) => setSelectedCensusForDetail(census)}
          />
        )}
      </div>

      {/* ═══ Clinical Health Physical Inspection Modal ═══ */}
      <SibatInspectionDialog
        record={selectedHealthRecord}
        open={isInspectionDialogOpen}
        onOpenChange={setIsInspectionDialogOpen}
        onConfirmInspection={handleConfirmInspection}
      />

      {/* ═══ Production & Inventory Review Dialog ═══ */}
      <SibatReviewDialog
        submission={selectedSubmissionForReview}
        open={selectedSubmissionForReview !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSubmissionForReview(null);
        }}
        onReviewSuccess={handleReviewSuccess}
      />

      {/* ═══ Census Survey & Details Dialogs ═══ */}
      <CensusSubmissionDialog
        open={isCensusDialogOpen}
        onOpenChange={setIsCensusDialogOpen}
        onSubmissionSuccess={handleCensusSubmissionSuccess}
      />

      <CensusDetailsDialog
        submission={selectedCensusForDetail}
        open={selectedCensusForDetail !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCensusForDetail(null);
        }}
      />
    </>
  );
}

export default function SibatPortal() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">Loading Field Inspection Center...</div>}>
      <SibatPortalContent />
    </Suspense>
  );
}
