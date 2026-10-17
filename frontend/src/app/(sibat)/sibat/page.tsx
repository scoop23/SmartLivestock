"use client";



import axios from "axios";
import { useRouter,useSearchParams } from "next/navigation";
import { Suspense,useEffect,useMemo,useRef,useState } from "react";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { ValidationLoadingScreen,useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import { getSchedules,type ProgramSchedule } from "@/lib/community-api";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import {
Activity,
CalendarDays,
Check,
ClipboardList,
Clock3,
FileSpreadsheet,
Info,
MapPin,
Megaphone,
QrCode,
RefreshCw,
Search,
Send
} from "lucide-react";

import { toast } from "sonner";

import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";



import SibatHealthQueue from "./components/sibat-health-queue";
import SibatProductionQueue from "./components/sibat-production-queue";

import SibatInventoryQueue from "./components/sibat-inventory-queue";

import SibatReviewDialog from "./components/sibat-review-dialog";

import {
SibatInspectionDialog,
type SibatInspectionData,
type SibatValidationRecord,
} from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

import CensusDetailsDialog from "./census-details-dialog";

import { ReviewWorkloadPanel } from "@/app/(admin)/admin/review-workload-panel";
import { AskSmartLivestock } from "@/app/components/ask-smartlivestock";
import CensusSubmissionsView from "./census-submissions-view";
import { SibatFarmerFinderDialog } from "./components/sibat-farmer-finder-dialog";


import {
useCensusSubmission,

useClinicalHealthRecords,

useReviewClinicalHealth,
useSibatFarmers,
useSibatSubmissions,
type CensusSubmissionRecord,
type UnifiedSubmissionItem,
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

  // Community schedules query for upcoming field activities
  const { data: schedules = [] } = useQuery<ProgramSchedule[]>({
    queryKey: ["sibat-community-schedules"],
    queryFn: getSchedules,
    staleTime: 60_000,
  });

  const upcomingSchedule = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return (
      schedules
        .filter((s) => s.publication_status === "PUBLISHED" && s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || schedules[0] || null
    );
  }, [schedules]);

  const upcomingSchedulesCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return schedules.filter((s) => s.publication_status === "PUBLISHED" && s.date >= today).length;
  }, [schedules]);

  const pendingDiseaseCases = useMemo(() => {
    return healthRecords.filter((r) => r.status === "PENDING");
  }, [healthRecords]);

  const pendingFarmerSubmissions = useMemo(() => {
    return submissions.filter((s) => s.status === "PENDING");
  }, [submissions]);

  const recentUpdates = useMemo(() => {
    return submissions.slice(0, 3).map((item) => ({
      id: item.id,
      title: `${item.farmerName} submitted ${item.submissionTypeLabel}`,
      time: new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
  }, [submissions]);

  const assignedAreaDescription =
    user?.accessScope === "ALL_BARANGAYS"
      ? "All 18 Barangays • Padre Garcia Livestock Verification Hub"
      : user?.assignedBarangayName
      ? `Area • ${user.assignedBarangayName}`
      : "Area 2 • Banaba, Castillo, Pansol, and San Felipe";

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

      <div className="mx-auto w-full max-w-[1600px] space-y-4 sm:space-y-6 px-3.5 py-4 sm:p-6 lg:px-8 lg:py-7 2xl:px-10">
        {!isLoadingAccount && user?.role === "SIBAT" && user.accessScope !== "ALL_BARANGAYS" && !user.assignedBarangayId && (
          <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 sm:p-4 text-amber-950 text-xs sm:text-sm">
            <p className="font-semibold">Barangay assignment required</p>
            <p className="mt-1">Private farmer records and review queues are unavailable until MAO/Admin assigns a barangay or access scope.</p>
          </div>
        )}

        {hasDataError && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 sm:p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm">
            <div>
              <p className="font-semibold">Some field data could not be loaded.</p>
              <p className="mt-1 text-[11px] sm:text-xs">Could not load: {failedDataSources.join(", ")}. Refresh to retry. Failed requests are not counted as empty queues.</p>
            </div>
            <Button type="button" variant="outline" onClick={handleRefreshQueues} disabled={isRefreshing} className="min-h-10 sm:min-h-11 shrink-0 w-full sm:w-auto">Try again</Button>
          </div>
        )}

        {/* Header Greeting & Action */}
        <div>
          {currentDateStr && (
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#1E3A2F]">
              {currentDateStr}
            </p>
          )}
          <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {timeGreeting}, {officerName}
              </h1>
              <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-medium text-slate-500">
                {assignedAreaDescription}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleReviewRecords}
              className="bg-[#1E3A2F] hover:bg-[#152e24] text-white font-semibold rounded-xl px-4 py-2.5 h-auto text-xs sm:text-sm shrink-0 flex items-center justify-center gap-2 shadow-xs transition-colors w-full sm:w-auto cursor-pointer"
            >
              <Check className="size-4" />
              Verify farmer records
            </Button>
          </div>
        </div>

        {/* Notice Strip */}
        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/70 p-3 sm:px-4 text-xs sm:text-sm text-emerald-950 shadow-2xs">
          <Info className="size-4.5 sm:size-5 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <span className="leading-relaxed">
            <b className="font-bold">Field Validation Hub:</b> Reviewing records for {assignedAreaDescription}. Verify farmer-submitted livestock data before forwarding each record to the MAO.
          </span>
        </div>

        {/* Summary Grid: 4 Clickable Action Cards (2 cols on mobile, 4 on desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Card 1: Pending Records (Green) */}
          <button
            type="button"
            onClick={handleReviewRecords}
            className="group relative flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-white p-3.5 sm:p-5 text-left shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-2 sm:mb-3">
              <div className="size-9 sm:size-11 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <ClipboardList className="size-4.5 sm:size-5.5" />
              </div>
              <strong className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {waitingForReviewCount}
              </strong>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Pending Records</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden sm:block">Farmer records waiting for review</p>
            </div>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-emerald-700 mt-2 sm:mt-3 group-hover:text-emerald-800 group-hover:translate-x-0.5 transition-all">
              Review records <span>→</span>
            </span>
          </button>

          {/* Card 2: Disease Reports (Orange / Amber) */}
          <button
            type="button"
            onClick={() => handleTabChange("health")}
            className="group relative flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-white p-3.5 sm:p-5 text-left shadow-2xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-2 sm:mb-3">
              <div className="size-9 sm:size-11 rounded-xl bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <Activity className="size-4.5 sm:size-5.5" />
              </div>
              <strong className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {pendingDiseaseCases.length}
              </strong>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Disease Reports</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden sm:block">Reports that need your attention</p>
            </div>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-amber-700 mt-2 sm:mt-3 group-hover:text-amber-800 group-hover:translate-x-0.5 transition-all">
              View reports <span>→</span>
            </span>
          </button>

          {/* Card 3: Upcoming Activities (Blue / Sky) */}
          <button
            type="button"
            onClick={() => router.push("/sibat-scheduling")}
            className="group relative flex flex-col justify-between rounded-2xl border border-sky-200/80 bg-white p-3.5 sm:p-5 text-left shadow-2xs hover:shadow-md hover:border-sky-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-2 sm:mb-3">
              <div className="size-9 sm:size-11 rounded-xl bg-sky-100/80 text-sky-800 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <CalendarDays className="size-4.5 sm:size-5.5" />
              </div>
              <strong className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {upcomingSchedulesCount}
              </strong>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Upcoming Activities</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden sm:block">Scheduled animal health activities</p>
            </div>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-sky-700 mt-2 sm:mt-3 group-hover:text-sky-800 group-hover:translate-x-0.5 transition-all">
              View schedule <span>→</span>
            </span>
          </button>

          {/* Card 4: Forwarded to MAO (Teal / Soft) */}
          <button
            type="button"
            onClick={() => {
              setInvStatusFilter("verified");
              setProdStatusFilter("verified");
              setHealthStatusFilter("VERIFIED");
            }}
            className="group relative flex flex-col justify-between rounded-2xl border border-teal-200/80 bg-white p-3.5 sm:p-5 text-left shadow-2xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-2 sm:mb-3">
              <div className="size-9 sm:size-11 rounded-xl bg-teal-100/80 text-teal-800 flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                <Send className="size-4.5 sm:size-5.5" />
              </div>
              <strong className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {sentToMaoCount}
              </strong>
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800">Forwarded to MAO</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden sm:block">Records sent for MAO review</p>
            </div>
            <span className="inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold text-teal-700 mt-2 sm:mt-3 group-hover:text-teal-800 group-hover:translate-x-0.5 transition-all">
              View records <span>→</span>
            </span>
          </button>
        </div>

        {/* Main Section: Left = Submission Queues, Right = Sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
          {/* LEFT COLUMN: Main Queue Content */}
          <div className="min-w-0 space-y-6">
            {/* Needs Attention Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Needs Attention</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Review these recently submitted items.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReviewRecords}
                  className="text-xs font-semibold rounded-xl text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  View All
                </Button>
              </div>

              <div className="p-4 sm:p-5 space-y-3">
                {/* Farmer Pending Records */}
                {pendingFarmerSubmissions.slice(0, 2).map((item: UnifiedSubmissionItem) => {
                  const daysWaiting = Math.floor(
                    (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const isResubmitted = Boolean(
                    item.notes?.toLowerCase().includes("resubmitted") ||
                    item.notes?.toLowerCase().includes("correction")
                  );

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <ClipboardList className="size-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {item.submissionTypeLabel}
                            </h3>
                            <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-[10px] font-black px-2 py-0.5">
                              Pending Review
                            </span>
                            {isResubmitted && (
                              <span className="rounded-full bg-blue-50 text-blue-800 border border-blue-200/80 text-[10px] font-black px-2 py-0.5">
                                Correction resubmitted
                              </span>
                            )}
                            {!isResubmitted && daysWaiting >= 2 && (
                              <span className="rounded-full bg-rose-50 text-rose-800 border border-rose-200/80 text-[10px] font-black px-2 py-0.5">
                                Waiting for {daysWaiting} days
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            <b className="font-bold text-slate-900">{item.farmerName}</b> • {item.barangayName || "Assigned Barangay"}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Submitted {new Date(item.createdAt).toLocaleDateString()} • {item.tagNumber || item.detailsTitle || item.id}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenSubmission(item)}
                        className="w-full sm:w-auto shrink-0 text-xs font-bold rounded-xl text-emerald-800 border-emerald-200 hover:bg-emerald-50 justify-center cursor-pointer"
                      >
                        Review Record
                      </Button>
                    </div>
                  );
                })}

                {/* Urgent Disease Report */}
                {pendingDiseaseCases.slice(0, 1).map((caseItem: SibatValidationRecord) => (
                  <div
                    key={caseItem.id}
                    className="p-3 sm:p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/50 hover:bg-rose-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="size-10 rounded-xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0 mt-0.5">
                        <Activity className="size-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="text-sm font-bold text-rose-950 truncate">
                            Disease Report
                          </h3>
                          <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black px-2 py-0.5">
                            Needs Review
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">
                          <b className="font-bold text-slate-900">{caseItem.farmerName}</b> • {caseItem.barangayName}
                        </p>
                        <p className="text-[11px] text-rose-800/80">
                          Reported {new Date(caseItem.reportedAt).toLocaleDateString()} • {caseItem.name || caseItem.livestockTag || caseItem.id}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenInspection(caseItem)}
                      className="w-full sm:w-auto shrink-0 text-xs font-bold rounded-xl text-rose-900 border-rose-300 hover:bg-rose-100 justify-center cursor-pointer"
                    >
                      View Report
                    </Button>
                  </div>
                ))}

                {pendingFarmerSubmissions.length === 0 && pendingDiseaseCases.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No pending items requiring immediate attention. All records are up to date!
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
              {/* Card Header */}
              <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Recent farmer submissions
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Verify farmer-submitted livestock records before forwarding them to the MAO.
                  </p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshQueues}
                    disabled={isRefreshing}
                    className="h-8.5 sm:h-9 px-3 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-900 flex-1 sm:flex-none justify-center cursor-pointer"
                  >
                    <RefreshCw className={`size-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <span className="inline-flex items-center rounded-xl bg-slate-100 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-slate-700 shrink-0">
                    {waitingForReviewCount} pending
                  </span>
                </div>
              </div>

              {/* Queue Navigation Tabs with horizontal touch scroll */}
              <div className="flex overflow-x-auto no-scrollbar scrollbar-none gap-2 border-b border-slate-100 px-3.5 sm:px-5 py-2.5 sm:py-3 bg-slate-50/50" role="tablist" aria-label="Field review tasks">
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
                    className={`flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-[#1E3A2F] text-white shadow-xs"
                        : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${
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
              <div className="p-3.5 sm:p-5">
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

          {/* RIGHT COLUMN: Sidebar (Next Activity + Quick Actions + Workload + Recent Updates) */}
          <aside className="min-w-0 space-y-6">
            {/* Next Activity Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Next Activity</h2>
                  <p className="text-xs text-slate-500">Your next animal health schedule.</p>
                </div>
                <span className="rounded-lg bg-[#1E3A2F] text-white font-bold text-[10px] px-2 py-0.5">
                  Upcoming
                </span>
              </div>

              {upcomingSchedule ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3.5">
                    <div className="size-13 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex flex-col items-center justify-center text-center shrink-0 shadow-2xs">
                      <b className="text-lg font-black text-emerald-950 leading-none">
                        {new Date(`${upcomingSchedule.date}T12:00:00`).toLocaleDateString("en-US", { day: "2-digit" })}
                      </b>
                      <span className="text-[10px] font-black uppercase text-emerald-700 leading-none mt-1">
                        {new Date(`${upcomingSchedule.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {upcomingSchedule.program}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <Clock3 className="size-3.5 text-slate-400 shrink-0" />
                        <span>
                          {upcomingSchedule.available_times?.[0] || "8:00 AM"} – {upcomingSchedule.available_times?.[upcomingSchedule.available_times.length - 1] || "11:30 AM"}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                        <MapPin className="size-3.5 text-slate-400 shrink-0" />
                        <span>{upcomingSchedule.location || (user?.assignedBarangayName ? `${user.assignedBarangayName} Barangay Hall` : "Padre Garcia")}</span>
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/sibat-scheduling")}
                    className="w-full text-xs font-semibold rounded-xl text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                  >
                    View Schedule
                  </Button>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  No upcoming activity scheduled.
                </div>
              )}
            </div>

            {/* Quick Actions Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
                <p className="text-xs text-slate-500">Start a common task.</p>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleReviewRecords}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer border border-transparent hover:border-slate-200/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                      <ClipboardList className="size-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Review Farmer Records</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/sibat-scheduling")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer border border-transparent hover:border-slate-200/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
                      <CalendarDays className="size-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Create Schedule</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-sky-700 group-hover:translate-x-0.5 transition-all">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/sibat-announcement")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer border border-transparent hover:border-slate-200/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                      <Megaphone className="size-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Post Announcement</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all">→</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer border border-transparent hover:border-slate-200/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <QrCode className="size-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Scan Livestock QR</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all">→</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenNewCensus}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group cursor-pointer border border-transparent hover:border-slate-200/70"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="size-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">Record Census</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all">→</span>
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

            {/* Recent Updates Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Recent Updates</h2>
                  <p className="text-xs text-slate-500">Latest activity in your assigned area.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/sibat-alerts")}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 h-8 px-2 cursor-pointer"
                >
                  View All
                </Button>
              </div>

              <div className="space-y-2.5">
                {recentUpdates.slice(0, 3).map((item: { id: string; title: string; time: string }) => (
                  <div key={item.id} className="flex items-start gap-2.5 text-left">
                    <span className="size-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-slate-400">{item.time}</p>
                    </div>
                  </div>
                ))}
                {recentUpdates.length === 0 && (
                  <p className="text-xs text-slate-400 py-2 text-center">No recent updates.</p>
                )}
              </div>
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
      {activeSubmissionForReview && (
        <SibatReviewDialog
          submission={activeSubmissionForReview}
          open={activeSubmissionForReview !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedSubmissionForReview(null);
            if (!open && (reviewIdParam || legacyMessageParam)) clearReviewLink();
          }}
          onReviewSuccess={handleReviewSuccess}
        />
      )}

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
