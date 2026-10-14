"use client";



import React, { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";

import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  MapPin,
  QrCode,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UsersRound,
} from "lucide-react";
import { ValidationLoadingScreen, useLoadingScreenTransition } from "@/components/validation-loading-screen";

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
import { ReviewWorkloadPanel } from "@/app/(admin)/admin/review-workload-panel";
import { SibatFarmerFinderDialog } from "./components/sibat-farmer-finder-dialog";
import { AskSmartLivestock } from "@/app/components/ask-smartlivestock";


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

  // Include the signed-in reviewer's scope in the farmer-directory cache key.
  // The directory stays idle until the finder dialog is opened.
  const scopeKey = `${user?.email ?? "unknown"}:${user?.accessScope ?? ""}:${user?.assignedBarangayId ?? ""}`;

  const { records: healthRecords, isLoading: isLoadingHealth, failedSources: failedHealthSources, refetch: refetchHealth } = useClinicalHealthRecords();
  const [selectedHealthRecord, setSelectedHealthRecord] = useState<SibatValidationRecord | null>(null);

  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);

  const [healthStatusFilter, setHealthStatusFilter] = useState("ALL");

  const [healthTypeFilter, setHealthTypeFilter] = useState<"ALL" | "DISEASE" | "MORTALITY">("ALL");

  const [healthBarangayFilter, setHealthBarangayFilter] = useState("ALL");

  const [healthSearchQuery, setHealthSearchQuery] = useState("");



  const reviewHealthMutation = useReviewClinicalHealth();



  // Production and inventory review state.

  const { submissions, isLoading: isLoadingSubmissions, failedSources: failedSubmissionSources, refetch: refetchSubmissions } = useSibatSubmissions();
  const { data: farmers = [], isLoading: isLoadingFarmers, isError: isFarmersError, refetch: refetchFarmers } = useSibatFarmers(scopeKey, isFarmerFinderOpen);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<UnifiedSubmissionItem | null>(null);
  const attemptedReviewLinkRef = useRef<string | null>(null);



  // Production Filters
  const [prodStatusFilter, setProdStatusFilter] = useState<"all" | "pending" | "verified" | "approved" | "needs_correction" | "decided">("all");
  const [prodSearchQuery, setProdSearchQuery] = useState("");
  const [prodTypeFilter, setProdTypeFilter] = useState("ALL");

  // Inventory Filters
  const [invStatusFilter, setInvStatusFilter] = useState<"all" | "pending" | "verified" | "approved" | "needs_correction" | "decided">("all");
  const [invSearchQuery, setInvSearchQuery] = useState("");
  const [invEntryTypeFilter, setInvEntryTypeFilter] = useState<"ALL" | "INDIVIDUAL" | "BATCH">("ALL");



  // Census review state.

  const { data: censuses = [], isLoading: isLoadingCensus, isError: isCensusError, refetch: refetchCensus } = useCensusSubmission();
  const isInitialQueueLoading = isLoadingHealth || isLoadingSubmissions || isLoadingCensus;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isInitialQueueLoading);
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
      // Refresh the directory only when the user is currently using it.
      await Promise.all([
        refetchHealth(),
        refetchSubmissions(),
        refetchCensus(),
        ...(isFarmerFinderOpen ? [refetchFarmers()] : []),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };


  // Counts for Badges
  const pendingHealthCount = healthRecords.filter((r) => r.status === "PENDING").length;
  const pendingProdCount = submissions.filter((s) => (s.sourceType === "PRODUCTION" || s.sourceType === "SALE") && s.status === "PENDING").length;
  const pendingInvCount = submissions.filter((s) => (s.sourceType === "INVENTORY" || s.sourceType === "BATCH") && s.status === "PENDING").length;
  const pendingCalvingCount = submissions.filter((item) => item.sourceType === "CALVING" && item.status === "PENDING").length;
  const pendingCensusCount = censuses.filter((item) => item.status === "PENDING").length;

  const allSubmissions = [
    ...submissions,
    ...healthRecords.map((record) => ({ farmerName: record.farmerName, status: record.status })),
  ];
  const pendingSubmissions = allSubmissions.filter((record) => record.status === "PENDING");
  const waitingForReviewCount = pendingSubmissions.length + pendingCensusCount;
  const farmersToAssistCount = new Set(
    pendingSubmissions.map((record) => record.farmerName.trim().toLowerCase()).filter(Boolean)
  ).size;
  const sentToMaoCount =
    allSubmissions.filter((record) => record.status === "VERIFIED").length +
    censuses.filter((record) => record.status === "VERIFIED").length;
  const needsCorrectionCount =
    allSubmissions.filter((record) => ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"].includes(record.status)).length +
    censuses.filter((record) => ["SUBJECT_TO_REVISION", "SUBJECT_FOR_REVISION"].includes(record.status)).length;

  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  useEffect(() => {
    setCurrentDateStr(
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()).toUpperCase()
    );
  }, []);

  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
  const officerName = user?.firstName || user?.username || "Juan";

  const failedDataSources = [
    ...failedHealthSources,
    ...failedSubmissionSources,
    ...(isCensusError ? ["census submissions"] : []),
    ...(isFarmersError ? ["farmer directory"] : []),
  ];
  const hasDataError = failedDataSources.length > 0;

  if (isInitialQueueLoading || keepLoadingScreenMounted) {
    return (
      <>
        <PageHeader
          title={
            <div className="relative w-full max-w-md">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/80 text-slate-400 text-xs sm:text-sm font-normal w-full">
                <Search className="size-4 shrink-0 text-slate-400" />
                <span>Search farmer, animal record, or barangay</span>
              </div>
            </div>
          }
          variant="admin"
          maxWidthClass="w-full"
          showNotifications={true}
          className="bg-white border-b border-slate-200/80"
        />
        <div className="mx-auto w-full max-w-[1600px] p-3 sm:p-5 lg:px-8 lg:py-6 2xl:px-10">
          <ValidationLoadingScreen
            isLoading={isInitialQueueLoading}
            title="Loading SIBAT Field Inspection Center"
            subtitle="Connecting your authorized production, livestock, health, mortality, and census review queues."
            badgeLabel="SIBAT Queue Sync"
            authorityText="SIBAT Field Review · Barangay-scoped records"
            items={[
              {
                id: "submissions",
                label: "Farmer Submissions",
                sublabel: "Production, livestock, sales and calving",
                icon: <ClipboardList className="size-4" />,
                loaded: !isLoadingSubmissions,
              },
              {
                id: "health",
                label: "Health & Mortality",
                sublabel: "Disease and field declarations",
                icon: <Activity className="size-4" />,
                loaded: !isLoadingHealth,
              },
              {
                id: "census",
                label: "Barangay Census",
                sublabel: "Quarterly livestock surveys",
                icon: <FileSpreadsheet className="size-4" />,
                loaded: !isLoadingCensus,
              },
            ]}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <div className="relative w-full max-w-md">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsFarmerFinderOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setIsFarmerFinderOpen(true);
              }}
              className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-slate-400 hover:text-slate-600 cursor-pointer transition-all text-xs sm:text-sm font-normal w-full"
            >
              <Search className="size-4 shrink-0 text-slate-400" />
              <span>Search farmer, animal record, or barangay</span>
            </div>
          </div>
        }
        variant="admin"
        maxWidthClass="w-full"
        showNotifications={true}
        className="bg-white border-b border-slate-200/80"
      />

      <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:px-8 lg:py-7 2xl:px-10">
        {!isLoadingAccount && user?.role === "SIBAT" && user.accessScope !== "ALL_BARANGAYS" && !user.assignedBarangayId && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <p className="font-semibold">Barangay assignment required</p>
            <p className="mt-1 text-sm">Private farmer records and review queues are unavailable until MAO/Admin assigns a barangay or access scope.</p>
          </div>
        )}

        {hasDataError && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Some field data could not be loaded.</p>
              <p className="mt-1 text-xs">Could not load: {failedDataSources.join(", ")}. Refresh to retry. Failed requests are not counted as empty queues.</p>
            </div>
            <Button type="button" variant="outline" onClick={handleRefreshQueues} disabled={isRefreshing} className="min-h-11 shrink-0">Try again</Button>
          </div>
        )}

        {/* Header Greeting & Action */}
        <div>
          {currentDateStr && (
            <p className="text-xs font-bold uppercase tracking-wider text-[#1E3A2F]">
              {currentDateStr}
            </p>
          )}
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {timeGreeting}, {officerName}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Here is what needs your attention today.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleReviewRecords}
              className="bg-[#1E3A2F] hover:bg-[#152e24] text-white font-semibold rounded-xl px-4 py-2.5 h-auto text-sm shrink-0 flex items-center gap-2 shadow-xs transition-colors self-start sm:self-auto"
            >
              <Check className="size-4" />
              Verify farmer records
            </Button>
          </div>
        </div>

        {/* Attention Banner */}
        <div className="rounded-2xl border border-[#F4DFB8] bg-[#FFF9EE] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="size-10 rounded-xl bg-white border border-[#E9D4AA] flex items-center justify-center text-[#B45309] shrink-0">
              <Check className="size-5" />
            </div>
            <div>
              <h2 className="font-bold text-[#78350F] text-base">
                {waitingForReviewCount} farmer {waitingForReviewCount === 1 ? "record is" : "records are"} waiting for verification
              </h2>
              <p className="text-xs sm:text-sm text-[#92400E]/85 mt-0.5">
                Check the inventory, production, disease, or mortality details before forwarding each record to the MAO.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReviewRecords}
            className="font-bold text-[#78350F] hover:text-[#92400E] text-sm flex items-center gap-1.5 shrink-0 self-start sm:self-auto transition-colors cursor-pointer"
          >
            Verify now <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Retained KPI Cards */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Records to verify */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-4 transition-all hover:border-slate-300">
            <div className="size-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
              <Check className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                {waitingForReviewCount.toLocaleString()}
              </div>
              <p className="text-sm font-bold text-slate-800 truncate">Records to verify</p>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {farmersToAssistCount > 0 ? `${farmersToAssistCount} need closer checking` : "All records verified"}
              </p>
            </div>
          </div>

          {/* Card 2: Farmers to assist */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-4 transition-all hover:border-slate-300">
            <div className="size-12 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <UsersRound className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                {farmersToAssistCount.toLocaleString()}
              </div>
              <p className="text-sm font-bold text-slate-800 truncate">Farmers to assist</p>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                Waiting for field check
              </p>
            </div>
          </div>

          {/* Card 3: Sent to MAO */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-4 transition-all hover:border-slate-300">
            <div className="size-12 rounded-xl bg-sky-50 text-sky-700 border border-sky-200/60 flex items-center justify-center shrink-0">
              <Send className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                {sentToMaoCount.toLocaleString()}
              </div>
              <p className="text-sm font-bold text-slate-800 truncate">Sent to MAO</p>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                Waiting for municipal decision
              </p>
            </div>
          </div>

          {/* Card 4: Needs correction */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs flex items-center gap-4 transition-all hover:border-slate-300">
            <div className="size-12 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/60 flex items-center justify-center shrink-0">
              <RotateCcw className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
                {needsCorrectionCount.toLocaleString()}
              </div>
              <p className="text-sm font-bold text-slate-800 truncate">Needs correction</p>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                Returned for revision
              </p>
            </div>
          </div>
        </div>

        {/* Main Section: Left = Submission Queues, Right = Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
          {/* LEFT COLUMN: Main Queue Content */}
          <div className="min-w-0 space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
              {/* Card Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Recent farmer submissions
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Verify farmer-submitted livestock records before forwarding them to the MAO.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshQueues}
                    disabled={isRefreshing}
                    className="h-9 px-3 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                    {waitingForReviewCount} pending
                  </span>
                </div>
              </div>

              {/* Queue Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 sm:px-5 py-3 bg-slate-50/50" role="tablist" aria-label="Field review tasks">
                {([
                  { id: "inventory", label: "Livestock registration", count: pendingInvCount },
                  { id: "production", label: "Production & sales", count: pendingProdCount },
                  { id: "health", label: "Health & mortality", count: pendingHealthCount },
                  { id: "calving", label: "Calving & births", count: pendingCalvingCount },
                  { id: "census", label: "Census", count: pendingCensusCount },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-[#1E3A2F] text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Active Tab Queue Content */}
              <div className="p-4 sm:p-5">
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

                {activeTab === "census" && (
                  <CensusSubmissionsView
                    censusSubmissions={censuses}
                    onOpenSubmitDialog={handleOpenNewCensus}
                    onSelectCensusForDetail={(census) => setSelectedCensusForDetail(census)}
                  />
                )}
              </div>
            </div>

            {(user?.accessScope === "ALL_BARANGAYS" || Boolean(user?.assignedBarangayId)) && (
              <AskSmartLivestock />
            )}
          </div>

          {/* RIGHT COLUMN: Sidebar (Workload in sidebar + Quick actions + Next activity) */}
          <aside className="min-w-0 space-y-6">
            {/* Quick Actions Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Quick actions</h2>
              <div className="space-y-1.5">
                {/* Verify records */}
                <button
                  type="button"
                  onClick={handleReviewRecords}
                  className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 leading-snug">Verify records</p>
                    <p className="text-xs text-slate-500 truncate">Check farmer submissions</p>
                  </div>
                </button>

                {/* Find a farmer */}
                <button
                  type="button"
                  onClick={() => setIsFarmerFinderOpen(true)}
                  className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <UsersRound className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 leading-snug">Find a farmer</p>
                    <p className="text-xs text-slate-500 truncate">Search farmer directory & records</p>
                  </div>
                </button>

                {/* Scan livestock QR */}
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <QrCode className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 leading-snug">Scan livestock QR</p>
                    <p className="text-xs text-slate-500 truncate">Quick scan animal ear tag</p>
                  </div>
                </button>

                {/* Record census */}
                <button
                  type="button"
                  onClick={handleOpenNewCensus}
                  className="w-full flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer"
                >
                  <div className="size-10 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CalendarDays className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 leading-snug">Record census</p>
                    <p className="text-xs text-slate-500 truncate">Submit quarterly survey</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Review Workload Panel in Sidebar */}
            {user?.role === "SIBAT" && (user.accessScope === "ALL_BARANGAYS" || user.assignedBarangayId ? (
              <ReviewWorkloadPanel
                scopeLabel={user.accessScope === "ALL_BARANGAYS" ? "All authorized barangays" : `Assigned: ${user.assignedBarangayName || "Assigned barangay"}`}
                hideMaoQueue
              />
            ) : (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" aria-label="Review workload unavailable">
                <h2 className="text-sm font-bold text-amber-950">Review Workload</h2>
                <p className="mt-1 text-xs text-amber-900">
                  This account has no assigned barangay, so a barangay-specific workload cannot be shown. Ask MAO/Admin to assign the SIBAT account to a barangay.
                </p>
              </section>
            ))}

            {/* Next Activity Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Next Activity
                </span>
                <span className="rounded-lg bg-[#1E3A2F] text-white font-bold text-[11px] px-2 py-0.5">
                  Upcoming
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">Field Vaccination & Tagging Drive</h3>
              <div className="mt-2 space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5 text-slate-400" />
                  <span>8:00 AM – 11:30 AM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-slate-400" />
                  <span>{user?.assignedBarangayName ? `${user.assignedBarangayName} Barangay Hall` : "Padre Garcia Agricultural Office"}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/sibat-scheduling")}
                className="mt-4 w-full text-xs font-semibold rounded-xl text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
              >
                View activity details
              </Button>
            </div>
          </aside>
        </div>
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

    <Suspense fallback={
      <ValidationLoadingScreen
        title="Opening SIBAT Field Inspection Center"
        subtitle="Preparing the authorized review workspace."
        badgeLabel="SIBAT Workspace"
        authorityText="SIBAT Field Review · Barangay-scoped records"
      />
    }>

      <SibatPortalContent />

    </Suspense>

  );

}
