"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { KpiCard,type KpiVariant } from "@/components/ui/kpi-card";
import { cowHead } from "@lucide/lab";
import {
Activity,
AlertTriangle,
CheckCircle2,
ChevronRight,
Clock,
HeartPulse,
Icon,
RefreshCw,
RotateCcw,
Search,
ShieldCheck,
Sparkles,
Skull,
Stethoscope
} from "lucide-react";
import React,{ Suspense,startTransition,useEffect,useMemo,useRef,useState } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { useUserInventory } from "../livestock-inventory/livestock-inventory";

import api from "@/lib/axios";
import { getAttachedPhoto } from "@/lib/photo-storage";
import { useQuery } from "@tanstack/react-query";
import ReportDetailDialog from "./components/report-detail-dialog";
import ReportDetailsExampleDialog from "./components/report-details-example-dialog";
import ReportIllnessDialog from "./components/report-illness-dialog";
import {
BackendStatus,
FarmerReport,
ReportType,
} from "./report-observation-types";

type HealthReportFilter = "ALL" | "DISEASE" | "MORTALITY" | "PENDING" | "REVISION" | "VERIFIED" | "APPROVED";

function ReportObservationContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReportId = searchParams.get("reportId");
  const { data: inventory = [], isLoading: isLoadingInventory, isError: isInventoryError } = useUserInventory({ includeInactive: true });

  // ── Dialog States ──
  const [isReportIllnessOpen, setIsReportIllnessOpen] = useState<boolean>(false);
  const [reportIllnessDefaultType, setReportIllnessDefaultType] = useState<ReportType>("DISEASE");
  const [selectedReport, setSelectedReport] = useState<FarmerReport | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isDetailsExampleOpen, setIsDetailsExampleOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FarmerReport | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);

  const handleOpenReportIllness = (type: ReportType = "DISEASE") => {
    setReportIllnessDefaultType(type);
    setIsReportIllnessOpen(true);
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const requestedType = url.searchParams.get("newReport");
    if (requestedType !== "DISEASE" && requestedType !== "MORTALITY") return;

    startTransition(() => {
      setReportIllnessDefaultType(requestedType);
      setIsReportIllnessOpen(true);
    });
    url.searchParams.delete("newReport");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  // ── Live Queries for Farmer's Previous Reports ──
  const {
    data: diseaseCases = [],
    isLoading: isLoadingDiseases,
    isError: isDiseaseError,
    refetch: refetchDiseases,
    isFetching: isFetchingDiseases,
  } = useQuery({
    queryKey: ["farmer-disease-cases"],
    queryFn: async () => {
      const res = await api.get("diseases/cases/", { params: { mine: true } });
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const {
    data: mortalityRecords = [],
    isLoading: isLoadingMortality,
    isError: isMortalityError,
    refetch: refetchMortality,
    isFetching: isFetchingMortality,
  } = useQuery({
    queryKey: ["farmer-mortality-records"],
    queryFn: async () => {
      const res = await api.get("diseases/mortality/", { params: { mine: true } });
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const isRefreshing = isFetchingDiseases || isFetchingMortality;

  const handleRefresh = () => {
    refetchDiseases();
    refetchMortality();
    toast.success("Animal health reports updated.");
  };

  const handleEditReport = (report: FarmerReport) => {
    setSelectedReport(report);
    setEditingReport(report);
    setIsDetailOpen(false);
    setIsEditDialogOpen(true);
  };

  // ── Consolidated Reports from Database ──
  const reports: FarmerReport[] = useMemo(() => {
    const list: FarmerReport[] = [];

    diseaseCases.forEach((dc) => {
      const attached = getAttachedPhoto(`DIS-${dc.id}`, dc.tag_number);
      const photoUrl = dc.photo_url || dc.photo || (attached.isFarmerUpload ? attached.photoUrl : undefined);
      const photoName = (dc.photo_url || dc.photo) ? "Attached Field Photo" : (attached.isFarmerUpload ? attached.photoName : undefined);
      const inspectorPhotoUrl = dc.inspector_photo_url || dc.inspector_photo || (!attached.isFarmerUpload ? attached.photoUrl : undefined);
      list.push({
        id: `DIS-${dc.id}`,
        reportType: "DISEASE",
        inventoryId: String(dc.livestock),
        cattleTag: dc.tag_number || `Animal #${dc.livestock}`,
        cattleBreed: dc.breed || "Standard",
        cattleType: dc.livestock_type_name || "Livestock",
        name: dc.name || "Disease Case",
        affectedCount: dc.affected_count || 1,
        recordDate: dc.record_date || (dc.created_at ? dc.created_at.slice(0, 10) : ""),
        status: (dc.status || "PENDING").toUpperCase() as BackendStatus,
        symptoms: [dc.name],
        description: dc.name,
        photoUrl,
        photoName,
        inspectorPhotoUrl,
        createdAt: dc.created_at || new Date().toISOString(),
        reviewedBy: dc.reviewed_by,
        reviewedByName: dc.reviewed_by_name,
        reviewedAt: dc.reviewed_at,
        reviewRemarks: dc.review_remarks,
        previousReviewRemarks: dc.previous_remarks,
        farmerName: dc.farmer_name,
        barangayName: dc.barangay_name,
        rawItem: dc,
        inspectionDetails: dc.inspection_details || null,
      });
    });

    mortalityRecords.forEach((m) => {
      const affectedTags = Array.isArray(m.affected_animals)
        ? m.affected_animals.map((animal: { tag_number?: string }) => animal.tag_number).filter(Boolean)
        : [];
      const attached = getAttachedPhoto(`MOR-${m.id}`, m.tag_number);
      const photoUrl = m.photo_url || m.photo || (attached.isFarmerUpload ? attached.photoUrl : undefined);
      const photoName = (m.photo_url || m.photo) ? "Mortality Photo Evidence" : (attached.isFarmerUpload ? attached.photoName : undefined);
      const inspectorPhotoUrl = m.inspector_photo_url || m.inspector_photo || (!attached.isFarmerUpload ? attached.photoUrl : undefined);
      list.push({
        id: `MOR-${m.id}`,
        reportType: "MORTALITY",
        inventoryId: String(m.livestock),
        cattleTag: affectedTags.length ? affectedTags.join(", ") : m.tag_number || `Animal #${m.livestock}`,
        cattleBreed: m.breed || "Standard",
        cattleType: m.livestock_type_name || "Livestock",
        name: m.cause || "Mortality Record",
        affectedCount: m.death_count || 1,
        recordDate: m.record_date || (m.created_at ? m.created_at.slice(0, 10) : ""),
        status: (m.status || "PENDING").toUpperCase() as BackendStatus,
        symptoms: [m.cause],
        description: m.cause,
        photoUrl,
        photoName,
        inspectorPhotoUrl,
        createdAt: m.created_at || new Date().toISOString(),
        reviewedBy: m.reviewed_by,
        reviewedByName: m.reviewed_by_name,
        reviewedAt: m.reviewed_at,
        reviewRemarks: m.review_remarks,
        previousReviewRemarks: m.previous_remarks,
        farmerName: m.farmer_name,
        barangayName: m.barangay_name,
        rawItem: m,
        inspectionDetails: m.inspection_details || null,
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [diseaseCases, mortalityRecords]);

  // Keep deceased-linked reports as audit records, but show their staff review
  // trail under Livestock History instead of the active report queue.
  const deceasedAnimalIds = useMemo(
    () => new Set(inventory.filter((animal) => animal.operationalStatus === "DECEASED").map((animal) => String(animal.id))),
    [inventory],
  );
  const reportsInHistory = useMemo(() => {
    if (isLoadingInventory || isInventoryError) return [];
    return reports.filter((report) => {
      const raw = report.rawItem as {
        livestock?: number | string | null;
        batch?: number | string | null;
        affected_animals?: Array<{ id: number | string }>;
      } | undefined;
      const linkedIds = new Set<string>();
      if (report.inventoryId && !["null", "undefined"].includes(report.inventoryId)) linkedIds.add(report.inventoryId);
      if (raw?.livestock != null) linkedIds.add(String(raw.livestock));
      raw?.affected_animals?.forEach((animal) => linkedIds.add(String(animal.id)));
      if (raw?.batch != null) {
        inventory
          .filter((animal) => String(animal.batchId ?? "") === String(raw.batch))
          .forEach((animal) => linkedIds.add(String(animal.id)));
      }
      return linkedIds.size > 0 && [...linkedIds].every((id) => deceasedAnimalIds.has(id));
    });
  }, [reports, inventory, deceasedAnimalIds, isLoadingInventory, isInventoryError]);
  const archivedReportIds = useMemo(() => new Set(reportsInHistory.map((report) => report.id)), [reportsInHistory]);
  const activeReports = useMemo(
    () => reports.filter((report) => !archivedReportIds.has(report.id)),
    [reports, archivedReportIds],
  );

  const chronologyConflicts = useMemo(() => {
    const conflicts = new Map<string, Array<{ counterpartId: string; eventDate: string }>>();
    const deaths = activeReports.filter(
      (report) =>
        report.reportType === "MORTALITY" &&
        (report.status === "VERIFIED" || report.status === "APPROVED") &&
        Boolean(report.recordDate),
    );
    const diseases = activeReports.filter(
      (report) => report.reportType === "DISEASE" && Boolean(report.recordDate),
    );

    const animalIds = (report: FarmerReport) => {
      const ids = new Set<string>();
      if (report.inventoryId && !["null", "undefined"].includes(report.inventoryId)) {
        ids.add(report.inventoryId);
      }
      if (report.reportType === "MORTALITY") {
        const affectedAnimals = (
          report.rawItem as { affected_animals?: Array<{ id: number }> } | undefined
        )?.affected_animals;
        affectedAnimals?.forEach((animal) => ids.add(String(animal.id)));
      }
      return ids;
    };

    diseases.forEach((disease) => {
      const diseaseAnimalIds = animalIds(disease);
      deaths.forEach((death) => {
        const sharesAnimal = [...animalIds(death)].some((id) => diseaseAnimalIds.has(id));
        if (!sharesAnimal || death.recordDate >= disease.recordDate) return;

        conflicts.set(disease.id, [
          ...(conflicts.get(disease.id) || []),
          { counterpartId: death.id, eventDate: death.recordDate },
        ]);
        conflicts.set(death.id, [
          ...(conflicts.get(death.id) || []),
          { counterpartId: disease.id, eventDate: disease.recordDate },
        ]);
      });
    });

    return conflicts;
  }, [activeReports]);

  // ── Filter State ──
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterType, setFilterType] = useState<HealthReportFilter>("ALL");
  const [pendingNewReportIds, setPendingNewReportIds] = useState<string[]>([]);
  const [highlightedReportIds, setHighlightedReportIds] = useState<string[]>([]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return activeReports.filter((rep) => {
      const matchesSearch =
        rep.cattleTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.cattleBreed.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rep.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === "ALL") return true;
      if (filterType === "DISEASE") return rep.reportType === "DISEASE";
      if (filterType === "MORTALITY") return rep.reportType === "MORTALITY";
      if (filterType === "PENDING") return rep.status === "PENDING";
      if (filterType === "REVISION") {
        const s = (rep.status || "") as string;
        return s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION";
      }
      if (filterType === "VERIFIED") return rep.status === "VERIFIED";
      if (filterType === "APPROVED") return rep.status === "APPROVED";

      return true;
    });
  }, [activeReports, searchQuery, filterType]);

  const handleReportDialogSuccess = async (createdReportIds?: string[]) => {
    if (!createdReportIds?.length) {
      handleRefresh();
      return;
    }

    setSearchQuery("");
    setFilterType("ALL");
    await Promise.all([refetchDiseases(), refetchMortality()]);
    setPendingNewReportIds(createdReportIds);
  };

  useEffect(() => {
    if (
      pendingNewReportIds.length === 0 ||
      isLoadingDiseases || isLoadingMortality || isLoadingInventory ||
      isFetchingDiseases || isFetchingMortality
    ) return;

    const targetId = pendingNewReportIds[0];
    if (!filteredReports.some((report) => report.id === targetId)) return;

    const targetCard = document.getElementById(`report-card-${targetId}`);
    if (!targetCard) return;

    setPendingNewReportIds([]);
    setHighlightedReportIds(pendingNewReportIds);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      targetCard.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
    });
  }, [
    pendingNewReportIds,
    filteredReports,
    isLoadingDiseases,
    isLoadingMortality,
    isLoadingInventory,
    isFetchingDiseases,
    isFetchingMortality,
  ]);

  useEffect(() => {
    if (highlightedReportIds.length === 0) return;
    const timeout = window.setTimeout(() => setHighlightedReportIds([]), 6500);
    return () => window.clearTimeout(timeout);
  }, [highlightedReportIds]);

  const startReportTour = React.useCallback(() => {
    const candidates: DriveStep[] = [
      { element: '[data-tour="report-action-banner"]', popover: { title: "Report an animal problem", description: "Use the disease or mortality button to tell the livestock office about an incident on your farm.", side: "bottom", align: "center" } },
      { element: '[data-tour="report-disease-action"]', popover: { title: "Report a sick animal", description: "Choose this for symptoms or signs of illness. Report observations; do not guess a confirmed diagnosis.", side: "bottom", align: "center" } },
      { element: '[data-tour="report-mortality-action"]', popover: { title: "Report an animal death", description: "Choose this to record a death and the known or suspected cause for review.", side: "bottom", align: "center" } },
      { element: '[data-tour="report-kpis"]', popover: { title: "Report overview", description: "These counts summarize disease and mortality reports and show how many are pending, verified, or approved.", side: "bottom", align: "center" } },
      { element: '[data-tour="report-filters"]', popover: { title: "Filter your reports", description: "Narrow the list by report type or review status. Filters change which report cards appear below.", side: "bottom", align: "start" } },
      { element: '[data-tour="report-search"]', popover: { title: "Search reports", description: "Search by tag, symptoms or cause, breed, or report reference.", side: "bottom", align: "end" } },
    ];
    if (document.querySelector('[data-tour="report-card"]')) {
      candidates.push({ element: '[data-tour="report-card"]', popover: { title: "Open a report", description: "Each card summarizes one report. Select Details to open the full report, review progress, staff notes, photo evidence, and its QR pass.", side: "top", align: "center" } });
    } else if (document.querySelector('[data-tour="report-empty-state"]')) {
      const hasPreview = Boolean(document.querySelector('[data-tour="report-details-preview"]'));
      candidates.push({
        element: '[data-tour="report-empty-state"]',
        popover: {
          title: hasPreview ? "No report details yet" : "No matching reports",
          description: hasPreview
            ? "A real detail dialog becomes available after you submit a report. Use the example preview button to see what information it will contain."
            : "No report matches the current search or filter. Clear the search or return to All to see your reports again.",
          side: "top",
          align: "center",
        },
      });
      if (document.querySelector('[data-tour="report-details-preview"]')) {
        candidates.push({ element: '[data-tour="report-details-preview"]', popover: { title: "Preview report details", description: "This opens a clearly labeled mockup. It explains report information without creating or changing a real report.", side: "top", align: "center" } });
      }
    }

    startGuidedTutorial({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}",
      steps: candidates.filter((step) => typeof step.element !== "string" || document.querySelector(step.element)),
    });
  }, []);

  const newReportParam = searchParams.get("newReport");
  useEffect(() => {
    if (
      isLoadingDiseases || isLoadingMortality || isDiseaseError || isMortalityError ||
      requestedReportId || newReportParam || isReportIllnessOpen || isDetailOpen ||
      !getAutomaticTutorialsEnabled()
    ) return;
    const timer = window.setTimeout(startReportTour, 600);
    return () => window.clearTimeout(timer);
  }, [isLoadingDiseases, isLoadingMortality, isLoadingInventory, isDiseaseError, isMortalityError, requestedReportId, newReportParam, isReportIllnessOpen, isDetailOpen, startReportTour]);

  const handledReportLinkRef = useRef<string | null>(null);
  const missingReportLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedReportId) {
      handledReportLinkRef.current = null;
      missingReportLinkRef.current = null;
      return;
    }
    if (isLoadingDiseases || isLoadingMortality || isLoadingInventory || isDiseaseError || isMortalityError || handledReportLinkRef.current === requestedReportId) return;

    const requestedReport = reports.find((report) => report.id === requestedReportId);
    if (requestedReport) {
      missingReportLinkRef.current = null;
      if (archivedReportIds.has(requestedReport.id)) {
        toast.info("This report is part of a deceased animal's history.");
        router.replace("/livestock-inventory/history");
        handledReportLinkRef.current = requestedReportId;
        return;
      }
      startTransition(() => {
        setSelectedReport(requestedReport);
        setIsDetailOpen(true);
      });
      handledReportLinkRef.current = requestedReportId;
    } else if (missingReportLinkRef.current !== requestedReportId) {
      toast.error("That health report could not be found in your reports.");
      missingReportLinkRef.current = requestedReportId;
    }
  }, [requestedReportId, reports, archivedReportIds, isLoadingDiseases, isLoadingMortality, isLoadingInventory, isDiseaseError, isMortalityError, router]);

  const clearReportLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("reportId");
    router.replace(`${pathname}${url.search}${url.hash}`, { scroll: false });
  };

  // KPI Metrics
  const totalDiseaseCases = activeReports.filter((r) => r.reportType === "DISEASE").length;
  const totalMortality = activeReports.filter((r) => r.reportType === "MORTALITY").length;
  const pendingVerification = activeReports.filter((r) => r.status === "PENDING").length;
  const approvedCases = activeReports.filter((r) => r.status === "APPROVED").length;
  const verifiedCases = activeReports.filter((r) => r.status === "VERIFIED").length;
  const verifiedAndApprovedCases = activeReports.filter(
    (r) => r.status === "APPROVED" || r.status === "VERIFIED"
  ).length;

  const kpis: {
    label: string;
    value: string | number;
    sub: string;
    icon: React.ReactNode;
    variant: KpiVariant;
  }[] = [
    {
      label: "Sick Animals Reported",
      value: totalDiseaseCases,
      sub: "Active health incidents",
      icon: <Stethoscope className="size-4.5" />,
      variant: "amber",
    },
    {
      label: "Deceased Animals",
      value: totalMortality,
      sub: "Mortality records",
      icon: <Skull className="size-4.5" />,
      variant: "rose",
    },
    {
      label: "Waiting for SIBAT",
      value: pendingVerification,
      sub: "Pending field inspection",
      icon: <Clock className="size-4.5" />,
      variant: "sky",
    },
    {
      label: "Verified & Approved",
      value: verifiedAndApprovedCases,
      sub: "Certified by MAO Vet",
      icon: <ShieldCheck className="size-4.5" />,
      variant: "emerald",
    },
  ];

  return (
    <>
      <PageHeader
        title="Record"
        subtitle="Report sick or deceased livestock."
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={startReportTour}
              className="h-11 gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25 hover:text-white"
              aria-label="Start report observation tutorial"
            >
              <Sparkles className="size-4" aria-hidden="true" /> Tutorial
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh reports"
            >
              <RefreshCw className={`size-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!isLoadingInventory && reportsInHistory.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <p>{reportsInHistory.length} report{reportsInHistory.length === 1 ? " is" : "s are"} linked only to deceased livestock. Their review details are available in Livestock History.</p>
            <Button asChild variant="outline" size="sm" className="shrink-0 border-amber-300 bg-white">
              <Link href="/livestock-inventory/history">Open Livestock History</Link>
            </Button>
          </div>
        )}
        {/* ── TOP KPI STATS ── */}
        <div data-tour="report-kpis" className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              title={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              badge={kpi.sub}
              variant={kpi.variant}
            />
          ))}
        </div>

        {/* ── ACTION BANNER ── */}
        <div data-tour="report-action-banner" className="rounded-3xl bg-gradient-to-br from-[#1E3D1A] via-[#2D5A27] to-emerald-800 p-5 sm:p-6 text-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-emerald-700/30">
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Activity className="size-5 text-emerald-200" />
              Report an Animal Problem
            </h3>
            <p className="text-xs text-emerald-100/85 font-medium max-w-xl leading-relaxed">
              Early reports help local animal health staff respond to possible illness.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              data-tour="report-mortality-action"
              onClick={() => handleOpenReportIllness("MORTALITY")}
              className="flex-1 sm:flex-none rounded-xl bg-rose-600/25 hover:bg-rose-600/40 text-rose-100 text-xs font-bold h-10 px-4 gap-1.5 border border-rose-400/30 cursor-pointer"
            >
              <Skull className="size-4 text-rose-300" />
              <span>Report Animal Death</span>
            </Button>

            <Button
              data-tour="report-disease-action"
              onClick={() => handleOpenReportIllness("DISEASE")}
              className="flex-1 sm:flex-none rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-black h-10 px-4 gap-1.5 shadow-sm cursor-pointer"
            >
              <Stethoscope className="size-4" />
              <span>Report Sick Animal</span>
            </Button>
          </div>
        </div>

        {/* ── INTERACTIVE REPORTS SURVEILLANCE LEDGER ── */}
        <Card data-tour="report-ledger" className="border-2 border-emerald-900/10 bg-white shadow-xs rounded-3xl overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-4">
            {/* Header with Title & Live Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Activity className="size-5 text-emerald-700" />
                  Your Reports
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Select a report to see its details and review updates.
                </p>
              </div>

              <span className="text-xs font-bold text-slate-400 self-start sm:self-center">
                Showing {filteredReports.length} of {activeReports.length} active reports
              </span>
            </div>

            {/* Filter Pills & Live Search */}
            <div data-tour="report-filters" className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {([
                  { id: "ALL", label: `All (${activeReports.length})` },
                  { id: "DISEASE", label: `Sick Animals (${totalDiseaseCases})` },
                  { id: "MORTALITY", label: `Deceased (${totalMortality})` },
                  { id: "PENDING", label: `Pending (${pendingVerification})` },
                  { id: "REVISION", label: "Needs Revision" },
                  { id: "VERIFIED", label: `Verified (${verifiedCases})` },
                  { id: "APPROVED", label: `Approved (${approvedCases})` },
                ] satisfies ReadonlyArray<{ id: HealthReportFilter; label: string }>).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={filterType === tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`inline-flex min-h-11 items-center rounded-xl px-3.5 py-2 text-sm font-bold transition-all cursor-pointer ${
                      filterType === tab.id
                        ? "bg-[#2D5A27] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div data-tour="report-search" className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tag #, symptoms, diagnosis..."
                  className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#2D5A27]"
                />
              </div>
            </div>

            {/* Grid of Report Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {isLoadingDiseases || isLoadingMortality || isLoadingInventory ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-50 animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                    <div className="h-8 bg-slate-100 rounded w-full" />
                  </div>
                ))
              ) : filteredReports.length === 0 ? (
                <div data-tour="report-empty-state" className="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl">
                  <HeartPulse className="size-10 mx-auto mb-2.5 text-slate-300" />
                  <p className="text-sm font-black text-slate-700">No reports found</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchQuery || filterType !== "ALL"
                      ? "No records match your active search or filter criteria."
                      : "You haven't submitted any disease or mortality reports yet."}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenReportIllness()}
                      className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold rounded-xl h-8 px-3.5"
                    >
                      + File Incident Report
                    </Button>
                    {activeReports.length === 0 && reportsInHistory.length === 0 && (
                      <Button
                        data-tour="report-details-preview"
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsDetailsExampleOpen(true)}
                        className="rounded-xl text-xs font-bold"
                      >
                        Preview report details
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                filteredReports.map((rep) => {
                  const isMortality = rep.reportType === "MORTALITY";

                  // Status Badge Styles
                  const statusInfo = {
                    APPROVED: {
                      badgeClass: "bg-emerald-100 text-emerald-800 border-0",
                      icon: <CheckCircle2 className="size-3 text-emerald-600" />,
                      label: "MAO Approved",
                    },
                    VERIFIED: {
                      badgeClass: "bg-sky-100 text-sky-800 border-0",
                      icon: <ShieldCheck className="size-3 text-sky-600" />,
                      label: "SIBAT Verified",
                    },
                    SUBJECT_TO_REVISION: {
                      badgeClass: "bg-rose-100 text-rose-800 border-0",
                      icon: <RotateCcw className="size-3 text-rose-600" />,
                      label: "Needs Revision",
                    },
                    SUBJECT_FOR_REVISION: {
                      badgeClass: "bg-rose-100 text-rose-800 border-0",
                      icon: <RotateCcw className="size-3 text-rose-600" />,
                      label: "Needs Revision",
                    },
                    REJECTED: {
                      badgeClass: "bg-rose-100 text-rose-800 border-0",
                      icon: <RotateCcw className="size-3 text-rose-600" />,
                      label: "Subject for Revision",
                    },
                    PENDING: {
                      badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
                      icon: <Clock className="size-3 text-amber-600" />,
                      label: "Pending SIBAT Visit",
                    },
                  }[rep.status] || {
                    badgeClass: "bg-slate-100 text-slate-700 border-0",
                    icon: <Clock className="size-3 text-slate-500" />,
                    label: "Pending",
                  };

                  return (
                    <div
                      key={rep.id}
                      id={`report-card-${rep.id}`}
                      data-tour={rep.id === filteredReports[0]?.id ? "report-card" : undefined}
                      onClick={() => {
                        setSelectedReport(rep);
                        setIsDetailOpen(true);
                      }}
                      className={`p-4 rounded-2xl border bg-white hover:border-[#2D5A27] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3 ${
                        highlightedReportIds.includes(rep.id)
                          ? "border-emerald-400 bg-emerald-50/70 ring-4 ring-emerald-300/70 shadow-lg shadow-emerald-200/60"
                          : "border-slate-200"
                      }`}
                    >
                      {/* Top Row: Animal Info & Date */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`p-2 rounded-xl shrink-0 ${
                                isMortality
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isMortality ? (
                                <Skull className="size-4" />
                              ) : (
                                <Icon iconNode={cowHead} className="size-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 group-hover:text-[#2D5A27] transition-colors">
                                #{rep.cattleTag}
                              </p>
                              <p className="text-[10px] text-slate-500 font-semibold">
                                {rep.cattleBreed} • {rep.cattleType}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 font-medium">
                            {rep.recordDate}
                          </span>
                        </div>

                        {/* Symptoms / Diagnosis */}
                        <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100/80">
                          <p className="text-xs font-black text-slate-900 whitespace-normal break-words">
                            {rep.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Affected: <strong className="text-slate-800">{rep.affectedCount}</strong> Head{rep.affectedCount > 1 ? "s" : ""}
                          </p>
                        </div>

                        {chronologyConflicts.get(rep.id)?.map((conflict) => (
                          <div
                            key={`${rep.id}-${conflict.counterpartId}`}
                            role="status"
                            className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-950"
                          >
                            <p className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="size-3.5 shrink-0" />
                              Timeline needs review
                            </p>
                            <p className="mt-1">
                              {rep.reportType === "DISEASE"
                                ? `This disease report (${rep.id}, ${rep.recordDate}) is dated after verified/approved death ${conflict.counterpartId} (${conflict.eventDate}) for the same animal.`
                                : `Disease report ${conflict.counterpartId} (${conflict.eventDate}) is dated after this verified/approved death report (${rep.id}, ${rep.recordDate}) for the same animal.`}
                              {" "}Check the animal and event dates with field staff. This date match does not show that the disease caused the death.
                            </p>
                          </div>
                        ))}

                        {/* Revision Callout if Subject to Revision */}
                        {rep.status === "SUBJECT_TO_REVISION" && rep.reviewRemarks && (
                          <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900 font-medium line-clamp-2">
                            <strong>Validator Note:</strong> {rep.reviewRemarks}
                          </div>
                        )}
                      </div>

                      {/* Bottom Row: Status Badge & Details Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge className={`text-[10px] font-extrabold px-2 py-0.5 gap-1 ${statusInfo.badgeClass}`}>
                            {statusInfo.icon}
                            <span>{statusInfo.label}</span>
                          </Badge>
                          {highlightedReportIds.includes(rep.id) && (
                            <Badge className="border border-emerald-300 bg-emerald-100 text-[10px] font-extrabold text-emerald-900">
                              Just submitted
                            </Badge>
                          )}
                        </div>

                        <span className="text-xs font-black text-[#2D5A27] group-hover:underline flex items-center gap-0.5">
                          <span>Details</span>
                          <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── MODALS ── */}
      <ReportIllnessDialog
        open={isReportIllnessOpen}
        onOpenChange={setIsReportIllnessOpen}
        defaultType={reportIllnessDefaultType}
        onSuccess={handleReportDialogSuccess}
      />

      <ReportIllnessDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setEditingReport(null);
        }}
        defaultType={editingReport?.reportType ?? "DISEASE"}
        existingReport={editingReport}
        mode={editingReport ? "edit" : "create"}
        onSuccess={handleReportDialogSuccess}
      />

      <ReportDetailDialog
        report={selectedReport}
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) {
            setSelectedReport(null);
            if (requestedReportId) {
              handledReportLinkRef.current = requestedReportId;
              clearReportLink();
            }
          }
        }}
        onEditReport={handleEditReport}
      />

      <ReportDetailsExampleDialog open={isDetailsExampleOpen} onOpenChange={setIsDetailsExampleOpen} />
    </>
  );
}

export default function ReportObservationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading animal health reports...</div>}>
      <ReportObservationContent />
    </Suspense>
  );
}
