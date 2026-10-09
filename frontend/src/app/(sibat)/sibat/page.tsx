"use client";



import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";

import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";

import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";



import SibatHealthQueue from "./components/sibat-health-queue";
import SibatProductionQueue from "./components/sibat-production-queue";

import SibatInventoryQueue from "./components/sibat-inventory-queue";

import SibatReviewDialog from "./components/sibat-review-dialog";

import {

  SibatInspectionDialog,

  type SibatValidationRecord,

  type SibatInspectionData,

} from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

import CensusDetailsDialog from "./census-details-dialog";

import CensusSubmissionsView from "./census-submissions-view";
import { SibatWorkspaceSummary } from "./components/sibat-workspace-summary";
import { SibatFarmerFinderDialog } from "./components/sibat-farmer-finder-dialog";


import {

  useSibatSubmissions,

  useCensusSubmission,

  useClinicalHealthRecords,

  useReviewClinicalHealth,
  useSibatFarmers,
  type UnifiedSubmissionItem,

  type CensusSubmissionRecord,

} from "./sibat-analytics";



type SibatActiveTab = "inventory" | "production" | "health" | "calving" | "census";

function resolveLegacyReviewSubmission(
  submissions: UnifiedSubmissionItem[],
  legacyType: string | null,
  legacyMessage: string | null,
) {
  if (!legacyType || !legacyMessage) return undefined;
  const message = legacyMessage.trim();
  const farmerName = message.match(/^(.+?)\s+(?:registered|corrected|resubmitted|logged|recorded)\b/i)?.[1]?.trim();
  let candidates = submissions.filter((item) => item.sourceType === legacyType);
  if (farmerName) {
    candidates = candidates.filter((item) => item.farmerName.trim().toLowerCase() === farmerName.toLowerCase());
  }

  if (legacyType === "SALE") {
    const saleId = message.match(/sale\s*#(\d+)/i)?.[1];
    if (saleId) candidates = candidates.filter((item) => String(item.rawId) === saleId);
  } else if (legacyType === "BATCH") {
    const batchCode = message.match(/(?:batch|herd)\s+([\w-]+)/i)?.[1];
    if (batchCode) candidates = candidates.filter((item) => item.batchCode === batchCode);
  } else if (legacyType === "INVENTORY") {
    const animalTag = message.match(/(?:registered|resubmitted)\s+(.+?)(?:\s+for field verification|\.|$)/i)?.[1]?.trim();
    if (animalTag) {
      candidates = candidates.filter((item) =>
        [item.tagNumber, item.breed, item.livestockTypeName, item.detailsTitle].some(
          (value) => value?.trim().toLowerCase() === animalTag.toLowerCase(),
        ),
      );
    }
  } else if (legacyType === "CALVING") {
    const calfTag = message.match(/calf\s+(.+?)(?:\s+from dam|\.|$)/i)?.[1]?.trim();
    if (calfTag) candidates = candidates.filter((item) => item.calfTag?.toLowerCase() === calfTag.toLowerCase());
  } else if (legacyType === "PRODUCTION") {
    const logged = message.match(/logged\s+(.+?)\s+of\s+(.+?)\./i);
    if (logged) {
      candidates = candidates.filter((item) =>
        item.quantityDisplay.toLowerCase().includes(logged[1].toLowerCase()) &&
        item.submissionTypeLabel.toLowerCase().includes(logged[2].toLowerCase()),
      );
    } else {
      const productionType = message.match(/corrected a (.+?) production record/i)?.[1];
      if (productionType) {
        candidates = candidates.filter((item) => item.submissionTypeLabel.toLowerCase().includes(productionType.toLowerCase()));
      }
    }
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}


function SibatPortalContent() {

  const { user, isLoading: isLoadingAccount } = useAuth();

  const queryClient = useQueryClient();

  const searchParams = useSearchParams();

  const router = useRouter();



  // Active Tab: "health" | "production" | "inventory" | "census"

  const tabParam = searchParams.get("tab") as SibatActiveTab | null;
  const tabOptions: SibatActiveTab[] = ["inventory", "production", "health", "calving", "census"];
  const [activeTabState, setActiveTabState] = useState<SibatActiveTab>("health");
  const activeTab = tabParam && tabOptions.includes(tabParam) ? tabParam : activeTabState;
  const [isFarmerFinderOpen, setIsFarmerFinderOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleTabChange = (newTab: SibatActiveTab) => {

    setActiveTabState(newTab);
    const url = new URL(window.location.href);

    url.searchParams.set("tab", newTab);

    window.history.replaceState({}, "", url.toString());
  };



  // Clinical health and mortality review state.

  const { records: healthRecords, isLoading: isLoadingHealth, isError: isHealthError, refetch: refetchHealth } = useClinicalHealthRecords();
  const [selectedHealthRecord, setSelectedHealthRecord] = useState<SibatValidationRecord | null>(null);

  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);

  const [healthStatusFilter, setHealthStatusFilter] = useState("ALL");

  const [healthTypeFilter, setHealthTypeFilter] = useState<"ALL" | "DISEASE" | "MORTALITY">("ALL");

  const [healthBarangayFilter, setHealthBarangayFilter] = useState("ALL");

  const [healthSearchQuery, setHealthSearchQuery] = useState("");



  const reviewHealthMutation = useReviewClinicalHealth();



  // Production and inventory review state.

  const { submissions, isLoading: isLoadingSubmissions, isError: isSubmissionsError, refetch: refetchSubmissions } = useSibatSubmissions();
  const scopeKey = `${user?.email ?? "unknown"}:${user?.accessScope ?? ""}:${user?.assignedBarangayId ?? ""}`;
  const { data: farmers = [], isLoading: isLoadingFarmers, isError: isFarmersError, refetch: refetchFarmers } = useSibatFarmers(scopeKey);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<UnifiedSubmissionItem | null>(null);
  const attemptedReviewLinkRef = useRef<string | null>(null);



  // Production Filters

  const [prodStatusFilter, setProdStatusFilter] = useState<"all" | "pending" | "verified" | "decided">("all");

  const [prodSearchQuery, setProdSearchQuery] = useState("");

  const [prodTypeFilter, setProdTypeFilter] = useState("ALL");



  // Inventory Filters

  const [invStatusFilter, setInvStatusFilter] = useState<"all" | "pending" | "verified" | "decided">("all");

  const [invSearchQuery, setInvSearchQuery] = useState("");

  const [invEntryTypeFilter, setInvEntryTypeFilter] = useState<"ALL" | "INDIVIDUAL" | "BATCH">("ALL");



  // Census review state.

  const { data: censuses = [], isLoading: isLoadingCensus, isError: isCensusError, refetch: refetchCensus } = useCensusSubmission();
  const [selectedCensusForDetail, setSelectedCensusForDetail] = useState<CensusSubmissionRecord | null>(null);
  const censusIdParam = searchParams.get("censusId");
  const notificationCensus = !isLoadingCensus && censusIdParam
    ? censuses.find((item) => String(item.id) === censusIdParam) ?? null
    : null;
  const activeCensusForDetail = selectedCensusForDetail ?? notificationCensus;
  const clearCensusLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("censusId");
    window.history.replaceState({}, "", url.toString());
  };

  const [isScannerOpen, setIsScannerOpen] = useState(false);



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

            toast.success(`Record ${recordId} verified.`, {

              description: "Status updated to VERIFIED. Forwarded to MAO queue for municipal sign-off.",

            });

          } else if (action === "FLAGGED") {
            toast.warning(`Record ${recordId} marked as needing follow-up.`, {
              description: "The report was returned with your field remarks for the next review step.",
            });

          } else {

            toast.info(`Record ${recordId} marked as discrepancy / false alarm.`);

          }

          setIsInspectionDialogOpen(false);

          setSelectedHealthRecord(null);

        },

        onError: (err: unknown) => {

          toast.error("Failed to submit review", {

            description: axios.isAxiosError(err) ? err.response?.data?.error || err.message || "Check network connection" : "Check network connection and try again.",

          });

        },

      }

    );

  };



  // Census dialog callbacks

  const handleOpenNewCensus = () => {

    router.push("/sibat/census/submit");

  };



  const handleOpenCensusRevision = (submission: CensusSubmissionRecord) => {

    setSelectedCensusForDetail(null);

    router.push("/sibat/census/submit?revise=" + submission.id);

  };



  const handleReviewSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["sibat-production-records"] });

    queryClient.invalidateQueries({ queryKey: ["sibat-calving-records"] });

    queryClient.invalidateQueries({ queryKey: ["calving_records"] });

    queryClient.invalidateQueries({ queryKey: ["sibat-inventory-records"] });

  };

  const handleOpenSubmission = (item: UnifiedSubmissionItem) => {
    setSelectedSubmissionForReview(item);
    const tab: SibatActiveTab = item.sourceType === "INVENTORY" || item.sourceType === "BATCH"
      ? "inventory"
      : item.sourceType === "CALVING"
        ? "calving"
        : "production";
    handleTabChange(tab);
  };

  // Notification links carry the canonical queue type and record ID. Resolve
  // through the existing authorized queue data before opening the normal dialog.
  const reviewTypeParam = searchParams.get("reviewType");
  const reviewIdParam = searchParams.get("reviewId");
  const legacyTypeParam = searchParams.get("legacyType");
  const legacyMessageParam = searchParams.get("legacyMessage");
  const directLinkIsValid =
    !!reviewIdParam &&
    !!reviewTypeParam &&
    ["INVENTORY", "BATCH", "PRODUCTION", "SALE", "CALVING"].includes(reviewTypeParam);
  const notificationSubmission = directLinkIsValid
    ? submissions.find((item) => item.sourceType === reviewTypeParam && String(item.rawId) === reviewIdParam)
    : resolveLegacyReviewSubmission(submissions, legacyTypeParam, legacyMessageParam);
  const activeSubmissionForReview = selectedSubmissionForReview ?? notificationSubmission ?? null;

  useEffect(() => {
    const linkType = directLinkIsValid ? reviewTypeParam : legacyTypeParam;
    const linkId = reviewIdParam ?? legacyMessageParam;
    if (isLoadingSubmissions || !linkType || notificationSubmission) return;
    const linkKey = `${linkType}:${linkId ?? ""}`;
    if (attemptedReviewLinkRef.current === linkKey) return;
    attemptedReviewLinkRef.current = linkKey;
    void refetchSubmissions();
  }, [directLinkIsValid, isLoadingSubmissions, legacyMessageParam, legacyTypeParam, notificationSubmission, refetchSubmissions, reviewIdParam, reviewTypeParam]);

  const clearReviewLink = () => {
    const url = new URL(window.location.href);
    ["reviewType", "reviewId", "legacyType", "legacyMessage"].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, "", url.toString());
  };

  const handleReviewRecords = () => {
    const pendingHealth = healthRecords.find((record) => record.status === "PENDING");
    if (pendingHealth) {
      handleOpenInspection(pendingHealth);
      handleTabChange("health");
      return;
    }
    const pendingSubmission = submissions.find((item) => item.status === "PENDING");
    if (pendingSubmission) {
      handleOpenSubmission(pendingSubmission);
      return;
    }
    handleTabChange("census");
  };

  const handleRefreshQueues = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchHealth(), refetchSubmissions(), refetchCensus(), refetchFarmers()]);
    } finally {
      setIsRefreshing(false);
    }
  };


  // Counts for Badges

  const pendingHealthCount = healthRecords.filter((r) => r.status === "PENDING").length;

  const pendingProdCount = submissions.filter((s) => (s.sourceType === "PRODUCTION" || s.sourceType === "CALVING" || s.sourceType === "SALE") && s.status === "PENDING").length;
  const pendingInvCount = submissions.filter((s) => (s.sourceType === "INVENTORY" || s.sourceType === "BATCH") && s.status === "PENDING").length;
  const hasDataError = isHealthError || isSubmissionsError || isCensusError || isFarmersError;


  return (

    <>

      <PageHeader
        title="Field Inspection Center"
        subtitle="Review farmer records, assist with corrections, and forward checked submissions to MAO."
        variant="sibat"
        maxWidthClass="w-full"
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-5 p-3 sm:p-5 lg:px-8 lg:py-6 2xl:px-10">
        {!isLoadingAccount && user?.role === "SIBAT" && user.accessScope !== "ALL_BARANGAYS" && !user.assignedBarangayId && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">Barangay assignment required</p>
            <p className="mt-1 text-sm">Private farmer records and review queues are unavailable until MAO/Admin assigns a barangay or access scope.</p>
          </div>
        )}

        <SibatWorkspaceSummary
          scopeLabel={user?.accessScope === "ALL_BARANGAYS" ? "All authorized barangays" : user?.assignedBarangayName || "No barangay assigned"}
          submissions={submissions}
          healthRecords={healthRecords}
          censuses={censuses}
          isLoading={isLoadingHealth || isLoadingSubmissions || isLoadingCensus}
          isRefreshing={isRefreshing}
          onReviewRecords={handleReviewRecords}
          onFindFarmer={() => setIsFarmerFinderOpen(true)}
          onScan={() => setIsScannerOpen(true)}
          onNewCensus={handleOpenNewCensus}
          onRefresh={handleRefreshQueues}
        />

        {hasDataError && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Some field data could not be loaded.</p>
              <p className="mt-1 text-xs">Refresh to retry. A failed request is not shown as an empty or completed queue.</p>
            </div>
            <Button type="button" variant="outline" onClick={handleRefreshQueues} disabled={isRefreshing} className="min-h-11 shrink-0">Try again</Button>
          </div>
        )}

        <div role="tablist" aria-label="Field review tasks" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {([
            { id: "inventory", label: "Livestock registration", count: pendingInvCount },
            { id: "production", label: "Production & sales", count: pendingProdCount },
            { id: "health", label: "Health & mortality", count: pendingHealthCount },
            { id: "calving", label: "Calving & births", count: submissions.filter((item) => item.sourceType === "CALVING" && item.status === "PENDING").length },
            { id: "census", label: "Census", count: censuses.filter((item) => item.status === "PENDING").length },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors sm:text-sm ${activeTab === tab.id ? "border-[#1A365D] bg-[#1A365D] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
            >
              <span className="min-w-0 break-words">{tab.label}</span>
              {tab.count > 0 && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.id ? "bg-white/15" : "bg-slate-100 text-slate-700"}`}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Review queues stay connected to the existing scoped APIs and mutations. */}
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



        {/* Production records */}

        {(activeTab === "production" || activeTab === "calving") && (
          <SibatProductionQueue

            submissions={submissions}

            isLoading={isLoadingSubmissions}

            onReview={handleOpenSubmission}
            statusFilter={prodStatusFilter}

            onStatusFilterChange={setProdStatusFilter}

            searchQuery={prodSearchQuery}

            onSearchChange={setProdSearchQuery}

            prodTypeFilter={activeTab === "calving" ? "Calving" : prodTypeFilter}
            onProdTypeFilterChange={(type) => {
              setProdTypeFilter(type);
              handleTabChange(type === "Calving" ? "calving" : "production");
            }}
          />

        )}



        {/* Livestock registration records */}

        {activeTab === "inventory" && (

          <SibatInventoryQueue

            submissions={submissions}

            isLoading={isLoadingSubmissions}

            onReview={handleOpenSubmission}
            statusFilter={invStatusFilter}

            onStatusFilterChange={setInvStatusFilter}

            searchQuery={invSearchQuery}

            onSearchChange={setInvSearchQuery}

            entryTypeFilter={invEntryTypeFilter}

            onEntryTypeFilterChange={setInvEntryTypeFilter}

          />

        )}



        {/* Quarterly census records */}

        {activeTab === "census" && (

          <CensusSubmissionsView

            censusSubmissions={censuses}

            onOpenSubmitDialog={handleOpenNewCensus}

            onSelectCensusForDetail={(census) => setSelectedCensusForDetail(census)}

          />

        )}

      </div>



      {/* Clinical health physical inspection dialog */}

      <SibatInspectionDialog
        key={selectedHealthRecord?.id ?? "empty"}
        record={selectedHealthRecord}
        open={isInspectionDialogOpen}
        onOpenChange={(open) => {
          setIsInspectionDialogOpen(open);
          if (!open) setSelectedHealthRecord(null);
        }}
        onConfirmInspection={handleConfirmInspection}
        isSubmitting={reviewHealthMutation.isPending}
      />



      {/* Production and inventory review dialog */}

      <SibatReviewDialog

        submission={activeSubmissionForReview}

        open={activeSubmissionForReview !== null}

        onOpenChange={(open) => {

          if (!open) setSelectedSubmissionForReview(null);
          if (!open && (reviewIdParam || legacyMessageParam)) clearReviewLink();

        }}

        onReviewSuccess={handleReviewSuccess}
      />

      <SibatFarmerFinderDialog
        open={isFarmerFinderOpen}
        onOpenChange={setIsFarmerFinderOpen}
        farmers={farmers}
        submissions={submissions}
        onOpenRecord={handleOpenSubmission}
        isLoading={isLoadingFarmers}
      />


      {/* Census submission and details dialogs */}
      <CensusDetailsDialog
        submission={activeCensusForDetail}
        open={activeCensusForDetail !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCensusForDetail(null);
            if (censusIdParam) clearCensusLink();
          }
        }}
        onRevise={handleOpenCensusRevision}
      />


      {/* SIBAT livestock QR scanner */}

      <UniversalQrScannerDialog

        isOpen={isScannerOpen}

        onOpenChange={setIsScannerOpen}

        role="sibat"

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
