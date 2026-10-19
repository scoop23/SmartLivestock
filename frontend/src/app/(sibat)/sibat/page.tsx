"use client";



import axios from "axios";
import { useRouter,useSearchParams } from "next/navigation";
import { Suspense,useEffect,useMemo,useRef,useState } from "react";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { ValidationLoadingScreen,useLoadingScreenTransition } from "@/components/validation-loading-screen";
import { useAuth } from "@/contexts/auth-context";
import { getSchedules,type ProgramSchedule } from "@/lib/community-api";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import {
Activity,
CalendarDays,
ClipboardList,
Clock3,
FileSpreadsheet,
Info,
MapPin,
Megaphone,
QrCode,
Search
} from "lucide-react";

import { toast } from "sonner";

import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";



import SibatReviewDialog from "./components/sibat-review-dialog";

import {
SibatInspectionDialog,
type SibatInspectionData,
type SibatValidationRecord,
} from "@/app/(sibat)/sibat-validation/sibat-inspection-dialog";

import CensusDetailsDialog from "./census-details-dialog";
import { ReviewWorkloadPanel } from "@/app/(admin)/admin/review-workload-panel";

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



  const [isFarmerFinderOpen, setIsFarmerFinderOpen] = useState(false);
  const [isReviewRecordsOpen, setIsReviewRecordsOpen] = useState(false);
  const [selectedReviewCategory, setSelectedReviewCategory] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Clinical health and mortality review state.

  // Include the signed-in reviewer's scope in the farmer-directory cache key.
  // The directory stays idle until the finder dialog is opened.
  const scopeKey = `${user?.email ?? "unknown"}:${user?.accessScope ?? ""}:${user?.assignedBarangayId ?? ""}`;

  const { records: healthRecords, isLoading: isLoadingHealth, failedSources: failedHealthSources, refetch: refetchHealth } = useClinicalHealthRecords();
  const [selectedHealthRecord, setSelectedHealthRecord] = useState<SibatValidationRecord | null>(null);

  const [isInspectionDialogOpen, setIsInspectionDialogOpen] = useState(false);

  const reviewHealthMutation = useReviewClinicalHealth();



  // Production and inventory review state.

  const { submissions, isLoading: isLoadingSubmissions, failedSources: failedSubmissionSources, refetch: refetchSubmissions } = useSibatSubmissions();
  const { data: farmers = [], isLoading: isLoadingFarmers, isError: isFarmersError, refetch: refetchFarmers } = useSibatFarmers(scopeKey, isFarmerFinderOpen);
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<UnifiedSubmissionItem | null>(null);
  const attemptedReviewLinkRef = useRef<string | null>(null);



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
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  };

  const [isScannerOpen, setIsScannerOpen] = useState(false);



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
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  };

  const handleReviewRecords = () => {
    setSelectedReviewCategory(null);
    setIsReviewRecordsOpen(true);
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
  const pendingInvCount = submissions.filter((s) => (s.sourceType === "INVENTORY" || s.sourceType === "BATCH") && s.status === "PENDING").length;
  const pendingCensusCount = censuses.filter((item) => item.status === "PENDING").length;

  const allSubmissions = [
    ...submissions,
    ...healthRecords.map((record) => ({ farmerName: record.farmerName, status: record.status })),
  ];
  const pendingSubmissions = allSubmissions.filter((record) => record.status === "PENDING");
  const waitingForReviewCount = pendingSubmissions.length + pendingCensusCount;

  // Community schedules query for upcoming field activities
  const { data: schedules = [] } = useQuery<ProgramSchedule[]>({
    queryKey: ["sibat-community-schedules"],
    queryFn: getSchedules,
    staleTime: 60_000,
  });

  const upcomingSchedule = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return (
      schedules
        .filter((s) => s.publication_status === "PUBLISHED" && s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || null
    );
  }, [schedules]);

  const upcomingSchedulesCount = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return schedules.filter((s) => s.publication_status === "PUBLISHED" && s.date >= today).length;
  }, [schedules]);

  const pendingDiseaseCases = useMemo(() => {
    return healthRecords.filter((r) => r.status === "PENDING");
  }, [healthRecords]);

  const openSubmissionReviewRoute = (item: UnifiedSubmissionItem) => {
    setIsReviewRecordsOpen(false);
    if (item.sourceType === "INVENTORY") {
      router.push(`/sibat/livestock-registry?reviewType=INVENTORY&reviewId=${item.rawId}`);
      return;
    }
    if (item.sourceType === "BATCH") {
      router.push(`/sibat/batches?batchId=${item.rawId}`);
      return;
    }
    router.push(`/sibat/production-records?reviewType=${item.sourceType}&reviewId=${item.rawId}`);
  };

  const reviewCategories = [
    {
      title: "Livestock Records",
      icon: <ClipboardList className="size-4 text-emerald-700" />,
      items: submissions.filter((item) => item.status === "PENDING" && ["INVENTORY", "BATCH"].includes(item.sourceType)).map((item) => ({
        id: item.id,
        title: item.detailsTitle || item.submissionTypeLabel,
        detail: `${item.farmerName} · ${item.barangayName}`,
        onSelect: () => openSubmissionReviewRoute(item),
      })),
    },
    {
      title: "Production Records",
      icon: <FileSpreadsheet className="size-4 text-sky-700" />,
      items: submissions.filter((item) => item.status === "PENDING" && item.sourceType === "PRODUCTION").map((item) => ({
        id: item.id,
        title: item.detailsTitle || item.submissionTypeLabel,
        detail: `${item.farmerName} · ${item.barangayName}`,
        onSelect: () => openSubmissionReviewRoute(item),
      })),
    },
    {
      title: "Sales Records",
      icon: <FileSpreadsheet className="size-4 text-indigo-700" />,
      items: submissions.filter((item) => item.status === "PENDING" && item.sourceType === "SALE").map((item) => ({
        id: item.id,
        title: item.detailsTitle || item.submissionTypeLabel,
        detail: `${item.farmerName} · ${item.barangayName}`,
        onSelect: () => openSubmissionReviewRoute(item),
      })),
    },
    {
      title: "Calving & Birth Records",
      icon: <CalendarDays className="size-4 text-purple-700" />,
      items: submissions.filter((item) => item.status === "PENDING" && item.sourceType === "CALVING").map((item) => ({
        id: item.id,
        title: item.detailsTitle || item.submissionTypeLabel,
        detail: `${item.farmerName} · ${item.barangayName}`,
        onSelect: () => openSubmissionReviewRoute(item),
      })),
    },
    {
      title: "Disease Reports",
      icon: <Activity className="size-4 text-amber-700" />,
      items: pendingDiseaseCases.filter((item) => item.reportType === "DISEASE").map((item) => ({
        id: item.id,
        title: item.name || "Disease report",
        detail: `${item.farmerName} · ${item.barangayName}`,
        onSelect: () => {
          setIsReviewRecordsOpen(false);
          router.push(`/sibat-alerts?recordType=DISEASE&recordId=${encodeURIComponent(item.id.replace(/^DIS-/, ""))}`);
        },
      })),
    },
    {
      title: "Mortality Reports",
      icon: <Info className="size-4 text-rose-700" />,
      items: pendingDiseaseCases.filter((item) => item.reportType === "MORTALITY").map((item) => ({
        id: item.id,
        title: item.name || "Mortality report",
        detail: `${item.farmerName} · ${item.barangayName}`,
        onSelect: () => {
          setIsReviewRecordsOpen(false);
          router.push(`/sibat-alerts?recordType=MORTALITY&recordId=${encodeURIComponent(item.id.replace(/^MOR-/, ""))}`);
        },
      })),
    },
    {
      title: "Census Submissions",
      icon: <ClipboardList className="size-4 text-teal-700" />,
      items: censuses.filter((item) => item.status === "PENDING").map((item) => ({
        id: String(item.id),
        title: `${item.barangay} · Q${item.reportQuarter} ${item.reportYear}`,
        detail: `${item.totalHeads} heads · Submitted by ${item.submittedBy}`,
        onSelect: () => {
          setIsReviewRecordsOpen(false);
          router.push(`/sibat/census-submissions?censusId=${encodeURIComponent(String(item.id))}`);
        },
      })),
    },
  ];

  const recentUpdates = useMemo(() => submissions.slice(0, 3).map((item) => ({
    id: item.id,
    title: `${item.farmerName} submitted ${item.submissionTypeLabel}`,
    time: new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  })), [submissions]);

  const [clock] = useState(() => new Date());
  const currentHour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(clock));
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

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="min-w-0 space-y-4 sm:space-y-5" aria-labelledby="sibat-dashboard-title">
          <header>
            <h1 id="sibat-dashboard-title" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {timeGreeting}, {officerName}!
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Field Officer · {user?.accessScope === "ALL_BARANGAYS" ? "All Barangays" : user?.assignedBarangayName || "Assigned area"}
            </p>
          </header>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleReviewRecords}
              className="group col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="size-5 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Records for Review</p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900">{waitingForReviewCount}</p>
                </div>
              </div>
              <span className="mt-2 inline-block text-sm font-semibold text-emerald-800 group-hover:underline">Review Records →</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/sibat-alerts")}
              className="group rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <div className="flex items-center gap-3">
                <Activity className="size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Disease Reports</p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900">{pendingDiseaseCases.length}</p>
                </div>
              </div>
              <span className="mt-2 inline-block text-sm font-semibold text-amber-800 group-hover:underline">View Reports →</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/sibat-scheduling")}
              className="group rounded-xl border border-sky-200 bg-sky-50/60 p-4 text-left transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <div className="flex items-center gap-3">
                <CalendarDays className="size-5 shrink-0 text-sky-700" />
                <div>
                  <p className="text-sm font-medium text-slate-600">Upcoming Activities</p>
                  <p className="mt-0.5 text-2xl font-bold text-slate-900">{upcomingSchedulesCount}</p>
                </div>
              </div>
              <span className="mt-2 inline-block text-sm font-semibold text-sky-800 group-hover:underline">View Schedule →</span>
            </button>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-labelledby="needs-attention-title">
            <div className="border-b border-slate-100 p-4">
              <h2 id="needs-attention-title" className="font-bold text-slate-900">Needs Attention</h2>
              <p className="mt-1 text-sm text-slate-600">Items that may need your action.</p>
            </div>
            <div className="divide-y divide-slate-100 px-4">
              <button
                type="button"
                onClick={() => router.push("/sibat/livestock-registry")}
                className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
              >
                <Info className="size-4 shrink-0 text-amber-700" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Animal Records</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{pendingInvCount} records waiting for review</span>
                </span>
                <span aria-hidden="true" className="text-lg text-slate-500">›</span>
              </button>
              <button
                type="button"
                onClick={() => router.push("/sibat-alerts")}
                className="flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
              >
                <Activity className="size-4 shrink-0 text-rose-700" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Disease Reports</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{pendingDiseaseCases.length} reports need attention</span>
                </span>
                <span aria-hidden="true" className="text-lg text-slate-500">›</span>
              </button>
            </div>
          </section>

          {user?.role === "SIBAT" && (user.accessScope === "ALL_BARANGAYS" || user.assignedBarangayId) && (
            <ReviewWorkloadPanel scopeLabel={user.accessScope === "ALL_BARANGAYS" ? "All authorized barangays" : `Assigned: ${user.assignedBarangayName || "Assigned barangay"}`} hideMaoQueue />
          )}

        </section>

        <aside className="min-w-0 space-y-4" aria-label="CBAT quick access">
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="next-activity-title">
            <div>
              <h2 id="next-activity-title" className="font-bold text-slate-900">Next Activity</h2>
              <p className="mt-1 text-sm text-slate-600">Your next animal health schedule.</p>
            </div>
            {upcomingSchedule ? (
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-emerald-200 bg-emerald-50 text-center">
                  <span><strong className="block text-lg leading-5 text-emerald-950">{new Date(`${upcomingSchedule.date}T12:00:00`).toLocaleDateString("en-US", { day: "2-digit" })}</strong><span className="text-[10px] font-bold uppercase text-emerald-700">{new Date(`${upcomingSchedule.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span></span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{upcomingSchedule.program}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600"><Clock3 className="size-3.5 shrink-0" />{upcomingSchedule.available_times?.[0] || "8:00 AM"}–{upcomingSchedule.available_times?.[upcomingSchedule.available_times.length - 1] || "11:30 AM"}</p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-600"><MapPin className="size-3.5 shrink-0" />{upcomingSchedule.location || user?.assignedBarangayName || "Padre Garcia"}</p>
                </div>
              </div>
            ) : <p className="py-2 text-sm text-slate-600">No upcoming activity scheduled.</p>}
            <Button type="button" variant="outline" onClick={() => router.push("/sibat-scheduling")} className="min-h-10 w-full rounded-lg">View Schedule</Button>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="quick-actions-title">
            <div><h2 id="quick-actions-title" className="font-bold text-slate-900">Quick Actions</h2><p className="mt-1 text-sm text-slate-600">Start a common task.</p></div>
            <div className="space-y-1">
              {[
                { label: "Review Farmer Records", icon: <ClipboardList className="size-4" />, color: "text-emerald-700", action: handleReviewRecords },
                { label: "Create Schedule", icon: <CalendarDays className="size-4" />, color: "text-sky-700", action: () => router.push("/sibat-scheduling") },
                { label: "Post Announcement", icon: <Megaphone className="size-4" />, color: "text-amber-700", action: () => router.push("/sibat-announcement") },
                { label: "Scan Livestock QR", icon: <QrCode className="size-4" />, color: "text-teal-700", action: () => setIsScannerOpen(true) },
                { label: "Record Census", icon: <FileSpreadsheet className="size-4" />, color: "text-indigo-700", action: handleOpenNewCensus },
              ].map((item) => (
                <button key={item.label} type="button" onClick={item.action} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                  <span className={item.color}>{item.icon}</span>{item.label}<span className="ml-auto text-slate-400">→</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="recent-updates-title">
            <div className="flex items-center justify-between gap-2"><div><h2 id="recent-updates-title" className="font-bold text-slate-900">Recent Updates</h2><p className="mt-1 text-sm text-slate-600">Latest activity in your assigned area.</p></div><Button type="button" variant="ghost" size="sm" onClick={() => router.push("/sibat-alerts")} className="shrink-0">View All</Button></div>
            {recentUpdates.length ? <div className="space-y-3">{recentUpdates.map((item) => <div key={item.id} className="flex gap-2.5 text-sm"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-600" /><div className="min-w-0"><p className="line-clamp-2 font-medium text-slate-800">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{item.time}</p></div></div>)}</div> : <p className="text-sm text-slate-600">No recent updates.</p>}
          </section>
        </aside>
        </div>
      </div>



      <Dialog open={isReviewRecordsOpen} onOpenChange={(open) => {
        setIsReviewRecordsOpen(open);
        if (!open) setSelectedReviewCategory(null);
      }}>
        <DialogContent className="max-h-[88dvh] max-w-4xl overflow-y-auto rounded-2xl p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-bold text-slate-900">
              {selectedReviewCategory ?? "Records for Review"}
            </DialogTitle>
            <DialogDescription>
              {selectedReviewCategory
                ? "Select a pending record to review."
                : "Choose a category to view its pending records."}
            </DialogDescription>
          </DialogHeader>

          {selectedReviewCategory ? (() => {
            const category = reviewCategories.find((item) => item.title === selectedReviewCategory);
            if (!category) return null;

            return (
              <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Button type="button" variant="ghost" onClick={() => setSelectedReviewCategory(null)} className="m-2 h-9 px-3 text-sm text-emerald-800">
                  ← All categories
                </Button>
                {category.items.length ? (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {category.items.map((item) => (
                      <button key={item.id} type="button" onClick={item.onSelect} className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-600">{item.detail}</span>
                        </span>
                        <span aria-hidden="true" className="text-lg text-slate-400">›</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="border-t border-slate-100 px-3 py-4 text-sm text-slate-500">No records waiting for review in this category.</p>
                )}
              </section>
            );
          })() : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reviewCategories.map((category) => (
                <button key={category.title} type="button" onClick={() => setSelectedReviewCategory(category.title)} className="flex min-h-20 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">{category.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900">{category.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{category.items.length} pending {category.items.length === 1 ? "record" : "records"}</span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-slate-400">›</span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
