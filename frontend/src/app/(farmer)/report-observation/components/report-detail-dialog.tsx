"use client";

import { DiseaseCaseFollowUp } from "@/components/disease-case-follow-up";
import { QrCodePass } from "@/components/qr-code-pass";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { printElement } from "@/lib/print-element";
import { cowHead } from "@lucide/lab";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Icon,
  MapPin,
  Printer,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Skull,
  Stethoscope,
  Tag,
  Thermometer,
  Users,
} from "lucide-react";
import React from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { useAutomaticTutorialsEnabled } from "@/hooks/use-automatic-tutorials-enabled";
import { FarmerReport } from "../report-observation-types";

const BIOSECURITY_LABELS: Record<string, string> = {
  NONE: "None / General Advisory",
  PEN_ISOLATION: "Temporary Pen Isolation (7 Days)",
  TREATMENT_PRESCRIBED: "Supportive Treatment Prescribed",
  BIOSECURE_BURIAL: "Biosecure Deep Pit Burial & Lime",
  LAB_SAMPLE_SENT: "Blood/Tissue Sample Sent to Lab",
  CARCASS_SECURED: "Carcass Secured Pending MAO",
  AREA_DISINFECTED: "Area and Equipment Disinfected",
  VETERINARY_ESCALATION: "Referred to Municipal Veterinarian",
};

interface ReportDetailDialogProps {
  report: FarmerReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditReport?: (report: FarmerReport) => void;
}

export default function ReportDetailDialog({
  report,
  open,
  onOpenChange,
  onEditReport,
}: ReportDetailDialogProps) {
  const tutorialsEnabled = useAutomaticTutorialsEnabled();
  const startDetailsTour = React.useCallback(() => {
    const isMortalityReport = report?.reportType === "MORTALITY";
    const steps: DriveStep[] = [
      { element: '[data-tour="report-detail-header"]', popover: { title: "Report reference", description: "This heading identifies whether the record is a disease or mortality report. The reference number helps you and staff find the same case.", side: "bottom", align: "start" } },
      { element: '[data-tour="report-detail-progress"]', popover: { title: "Review progress", description: "Follow the workflow from farmer submission through SIBAT field review and MAO review. The status shows the current stage.", side: "bottom", align: "center" } },
      { element: '[data-tour="report-detail-history"]', popover: { title: "Case history", description: "This section shows the affected headcount, barangay when available, report date, and overall review status or revision feedback.", side: "bottom", align: "start" } },
      { element: '[data-tour="report-detail-official-notes"]', popover: { title: "Field and municipal notes", description: "CBAT / SIBAT findings and MAO remarks appear separately here. A pending message means that review step has not been completed yet.", side: "top", align: "center" } },
      { element: '[data-tour="report-detail-summary"]', popover: { title: "Animal and case summary", description: "Check the livestock type, breed, tag, affected count, and date connected to this report.", side: "top", align: "start" } },
      { element: '[data-tour="report-detail-concern"]', popover: { title: isMortalityReport ? "Reported cause" : "Reported symptoms", description: "These are the concern reported by the farmer. They are observations and do not by themselves confirm a diagnosis.", side: "top", align: "start" } },
      { element: '[data-tour="report-detail-observations"]', popover: { title: "Farmer observations", description: "Read the farmer’s description and context for the incident.", side: "top", align: "start" } },
      { element: '[data-tour="report-detail-photo"]', popover: { title: "Photo evidence", description: "If a photo was attached to the report, view it here. An absent section means no photo is available.", side: "top", align: "center" } },
      { element: '[data-tour="report-detail-qr"]', popover: { title: "QR report pass", description: "Staff can scan this QR pass to open the linked report in SmartLivestock.", side: "top", align: "center" } },
      { element: '[data-tour="report-detail-actions"]', popover: { title: "Print, revise, or close", description: "Print the details for reference. If revision was requested, use Edit & Resubmit to correct the report.", side: "top", align: "center" } },
    ];
    startGuidedTutorial({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}",
      steps: steps.filter((step) => typeof step.element !== "string" || document.querySelector(step.element)),
    });
  }, [report?.reportType]);

  React.useEffect(() => {
    if (!open || !report || !getAutomaticTutorialsEnabled()) return;
    const timer = window.setTimeout(startDetailsTour, 500);
    return () => window.clearTimeout(timer);
  }, [open, report, startDetailsTour]);

  if (!report) return null;

  const isMortality = report.reportType === "MORTALITY";
  const linkedDisease = isMortality && report.rawItem && "source_disease_case" in report.rawItem
    ? report.rawItem.source_disease_case
    : null;
  const linkedDiseaseName = isMortality && report.rawItem && "source_disease_name" in report.rawItem
    ? report.rawItem.source_disease_name
    : null;
  const qrRecordId = report.id.match(/^(?:DIS|MOR)-(\d+)$/i)?.[1];
  const qrPayload = qrRecordId
    ? `/health-report-qr?recordType=${report.reportType}&recordId=${qrRecordId}`
    : "";

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "APPROVED":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          icon: <CheckCircle2 className="size-4 text-emerald-700" />,
          title: "Reviewed by the local livestock office",
          stage: 3,
        };
      case "VERIFIED":
        return {
          bg: "bg-sky-50 text-sky-800 border-sky-200",
          icon: <ShieldCheck className="size-4 text-sky-700" />,
          title: "Verified by SIBAT Inspector",
          stage: 2,
        };
      case "SUBJECT_TO_REVISION":
      case "SUBJECT_FOR_REVISION":
      case "REJECTED":
        return {
          bg: "bg-rose-50 text-rose-900 border-rose-300",
          icon: <RotateCcw className="size-4 text-rose-700" />,
          title: "Needs Revision",
          stage: 2,
        };
      default:
        return {
          bg: "bg-amber-50 text-amber-900 border-amber-200",
          icon: <Clock className="size-4 text-amber-700" />,
          title: "Pending SIBAT Field Check",
          stage: 1,
        };
    }
  };

  const statusConfig = getStatusConfig(report.status);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Recent";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ── Multi-Tier Review Notes: CBAT & MAO ──
  const isApproved = report.status === "APPROVED";
  const isVerified = report.status === "VERIFIED";
  const isRevision =
    report.status === "SUBJECT_TO_REVISION" ||
    report.status === "SUBJECT_FOR_REVISION" ||
    report.status === "REJECTED";
  const isPending = report.status === "PENDING";

  // CBAT (Field Verification) Details
  const cbatVerifiedBy =
    report.inspectionDetails?.verifiedBy ||
    (isVerified ? report.reviewedByName : null) ||
    "CBAT / SIBAT Field Officer";

  const cbatVerifiedAt =
    report.inspectionDetails?.verifiedAt ||
    (isVerified ? report.reviewedAt : null);

  const cbatRemarks =
    report.inspectionDetails?.remarks ||
    (isVerified ? report.reviewRemarks : null);

  const confirmedSymptoms = report.inspectionDetails?.confirmedSymptoms || [];
  const biosecurityAction = report.inspectionDetails?.biosecurityAction;
  const biosecurityText = biosecurityAction ? BIOSECURITY_LABELS[biosecurityAction] || biosecurityAction : null;
  const temperature = report.inspectionDetails?.temperatureCelsius;
  const isFmdSuspected = report.inspectionDetails?.fmdAssessment === "SUSPECTED";
  const tagConfirmed = report.inspectionDetails?.tagConfirmed;
  const severity = report.inspectionDetails?.severity;

  // MAO (Municipal Agriculture Office) Details
  const maoReviewedBy =
    report.inspectionDetails?.maoReviewedBy ||
    (isApproved ? report.reviewedByName : null) ||
    "Municipal Agriculture Officer (MAO)";

  const maoReviewedAt =
    report.inspectionDetails?.maoReviewedAt ||
    (isApproved ? report.reviewedAt : null);

  const maoRemarks =
    report.inspectionDetails?.maoRemarks ||
    (isApproved ? report.reviewRemarks : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-print-root
        className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[96rem] min-w-0 flex-col overflow-hidden overscroll-contain rounded-[28px] border border-slate-200/90 bg-white p-0 shadow-2xl [&>button:last-child]:size-10 [&>button:last-child>svg]:size-6 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[96rem]"
      >
        {/* Header - Clean white style with icon container and Close button */}
        <div data-tour="report-detail-header" className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white p-4 pr-12 sm:p-6 sm:pr-14 lg:p-7 lg:pr-16">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`size-12 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border ${
                isMortality
                  ? "bg-rose-50 text-rose-800 border-rose-200/80"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200/80"
              }`}
            >
              {isMortality ? (
                <Skull className="size-6 sm:size-8 text-rose-700" />
              ) : (
                <ClipboardList className="size-6 sm:size-8 text-[#2D5A27]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                  {isMortality ? "Mortality Incident Details" : "Health Observation Details"}
                </DialogTitle>
                <span className="font-mono text-xs sm:text-base font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                  Ref #{report.id}
                </span>
              </div>
              <DialogDescription className="text-xs sm:text-base text-slate-500 font-medium mt-1">
                Official livestock health declaration and municipal review record
              </DialogDescription>
            </div>
          </div>

          {tutorialsEnabled && (
            <Button type="button" variant="ghost" size="icon" onClick={startDetailsTour} aria-label="Start report details tutorial" className="size-9 shrink-0 rounded-full text-slate-500 hover:bg-emerald-50 hover:text-emerald-800">
              <Sparkles className="size-4" aria-hidden="true" />
            </Button>
          )}

        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 p-3 sm:space-y-5 sm:p-5 lg:p-6">
          {/* 1. Review progress - 4-step horizontal stepper */}
          <div data-tour="report-detail-progress" className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 sm:p-5">
            <div className="relative flex items-start justify-between gap-1 sm:gap-3">
              {/* Connecting line */}
              <div
                aria-hidden
                className="absolute top-3.5 left-6 right-6 h-0.5 -translate-y-1/2 flex -z-0 pointer-events-none"
              >
                <div
                  className={`flex-1 transition-colors ${
                    statusConfig.stage >= 2 ? "bg-[#1A3D22]" : "bg-slate-200"
                  }`}
                />
                <div
                  className={`flex-1 transition-colors ${
                    statusConfig.stage >= 3 ? "bg-[#1A3D22]" : "bg-slate-200"
                  }`}
                />
                <div
                  className={`flex-1 transition-colors ${
                    report.status === "APPROVED" ? "bg-slate-300" : "bg-slate-200"
                  }`}
                />
              </div>

              {/* Step 1: Farmer Submitted */}
              <div className="relative z-1 flex min-w-0 flex-1 flex-col items-center text-center">
                <div className="size-7 rounded-full bg-[#1A3D22] text-white flex items-center justify-center text-xs font-black shadow-2xs">
                  ✓
                </div>
                <span className="text-[11px] font-bold text-slate-800 mt-2 leading-tight">
                  Farmer Submitted
                </span>
                <span className="mt-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800 sm:text-[10px]">Complete</span>
                <span className="mt-1 text-[10px] text-slate-500 sm:text-xs">{formatDate(report.createdAt)}</span>
              </div>

              {/* Step 2: Field Review */}
              <div className="relative z-1 flex min-w-0 flex-1 flex-col items-center text-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-black shadow-2xs ${
                    statusConfig.stage >= 2
                      ? report.status === "SUBJECT_TO_REVISION" ||
                        report.status === "SUBJECT_FOR_REVISION"
                        ? "bg-rose-500 text-white"
                        : "bg-[#1A3D22] text-white"
                      : "bg-white border-2 border-slate-300 text-slate-400"
                  }`}
                >
                  {statusConfig.stage >= 2 ? (
                    report.status === "SUBJECT_TO_REVISION" ||
                    report.status === "SUBJECT_FOR_REVISION" ? (
                      "!"
                    ) : (
                      "✓"
                    )
                  ) : (
                    "2"
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-800 mt-2 leading-tight">
                  Field Review
                </span>
                <span className={`mt-1 rounded-full border px-2 py-0.5 text-[9px] font-bold sm:text-[10px] ${isRevision ? "border-rose-200 bg-rose-50 text-rose-800" : statusConfig.stage >= 2 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {isRevision ? "Revision" : statusConfig.stage >= 2 ? "Complete" : "Pending"}
                </span>
                <span className="mt-1 text-[10px] text-slate-500 sm:text-xs">{cbatVerifiedAt ? formatDate(cbatVerifiedAt) : "—"}</span>
              </div>

              {/* Step 3: MAO Review */}
              <div className="relative z-1 flex min-w-0 flex-1 flex-col items-center text-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-black shadow-2xs ${
                    statusConfig.stage >= 3
                      ? "bg-[#1A3D22] text-white"
                      : "bg-white border-2 border-slate-300 text-slate-400"
                  }`}
                >
                  {statusConfig.stage >= 3 ? "✓" : "3"}
                </div>
                <span className="text-[11px] font-bold text-slate-800 mt-2 leading-tight">
                  MAO Review
                </span>
                <span className={`mt-1 rounded-full border px-2 py-0.5 text-[9px] font-bold sm:text-[10px] ${isApproved ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-600"}`}>
                  {isApproved ? "Complete" : "Pending"}
                </span>
                <span className="mt-1 text-[10px] text-slate-500 sm:text-xs">{maoReviewedAt ? formatDate(maoReviewedAt) : "—"}</span>
              </div>

              {/* Step 4: Case Resolution */}
              <div className="relative z-1 flex min-w-0 flex-1 flex-col items-center text-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-black shadow-2xs ${
                    statusConfig.stage >= 3
                      ? "bg-white border-2 border-amber-500 p-1"
                      : "bg-white border-2 border-slate-300 text-slate-400"
                  }`}
                >
                  {statusConfig.stage >= 3 ? (
                    <div className="size-2 rounded-full bg-amber-500" />
                  ) : (
                    "4"
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-800 mt-2 leading-tight">
                  Case Resolution
                </span>
                <span className="mt-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 sm:text-[10px]">Pending</span>
                <span className="mt-1 text-[10px] text-slate-500 sm:text-xs">—</span>
              </div>
            </div>

            {/* Stepper Status Callout Banner */}
            <div className="mt-4 rounded-xl bg-slate-100/90 border border-slate-200/70 py-2.5 px-3 text-center text-xs font-bold text-slate-700">
              {report.status === "APPROVED"
                ? "Report reviewed · Case resolution pending"
                : report.status === "VERIFIED"
                ? "Field review complete · MAO certification pending"
                : report.status === "SUBJECT_TO_REVISION" ||
                  report.status === "SUBJECT_FOR_REVISION"
                ? "Needs revision · SIBAT feedback required"
                : "Report submitted · Pending field review"}
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.95fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
          {/* 2. Follow-up & case resolution card */}
          {!isMortality && <div className="order-5"><DiseaseCaseFollowUp key={report.id} caseId={report.id} /></div>}

          {/* Section Divider */}
          {/* 3. Incident information and review history */}
          <section data-tour="report-detail-history" className="order-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <FileText className="size-5 text-emerald-800" />
                Incident Information
              </h2>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusConfig.bg}`}>{statusConfig.title}</span>
            </div>

            <div data-tour="report-detail-summary" className="grid gap-x-5 px-4 sm:grid-cols-2 sm:px-5">
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 sm:pr-4">
                <ClipboardList className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Incident ID</p>
                  <p className="break-words text-sm font-semibold text-slate-900">{report.id}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3">
                <Icon iconNode={cowHead} className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Livestock Type</p>
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {report.cattleType || "Livestock"}{report.cattleBreed ? ` · ${report.cattleBreed}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 sm:pr-4">
                <Calendar className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Date Reported</p>
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {formatDate(report.recordDate)} · {new Date(report.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3">
                <Users className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Head Count</p>
                  <p className="text-sm font-semibold text-slate-900">{report.affectedCount} Head{report.affectedCount === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 sm:pr-4">
                <Users className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Reported by</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-sm font-semibold text-slate-900">{report.farmerName || "Registered Farmer"}</p>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Farmer</span>
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3">
                <Tag className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Tag / Animal ID</p>
                  <p className="break-all text-sm font-semibold text-slate-900">{report.cattleTag || "Not recorded"}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3 sm:pr-4">
                <MapPin className="mt-0.5 size-5 shrink-0 text-slate-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="break-words text-sm font-semibold text-slate-900">{report.barangayName ? `Brgy. ${report.barangayName}, Padre Garcia, Batangas` : "Not recorded"}</p>
                </div>
              </div>
              <div data-tour="report-detail-concern" className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{isMortality ? "Suspected Cause of Death" : "Reported Symptoms"}</p>
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {report.symptoms?.length ? report.symptoms.join(", ") : report.name || "Not recorded"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="order-3 space-y-4">
            {/* Official Review Status Banner */}
            <div
              className={`rounded-xl border p-3 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-2xs ${statusConfig.bg}`}
            >
              <div className="shrink-0">{statusConfig.icon}</div>
              <div className="flex-1 leading-snug">
                <span>{statusConfig.title}</span>
                {report.reviewedByName && (
                  <span className="block text-[11px] font-normal opacity-90 mt-0.5">
                    {isApproved
                      ? `Certified by ${report.reviewedByName}`
                      : `Inspected by ${report.reviewedByName}`}
                    {report.reviewedAt ? ` on ${formatDate(report.reviewedAt)}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Official Revision Feedback Banner */}
            {isRevision && report.reviewRemarks && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-1 shadow-2xs">
                <p className="font-bold text-rose-900 flex items-center gap-1.5">
                  <RotateCcw className="size-3.5 text-rose-700" />
                  Revision Feedback:
                </p>
                <p className="leading-relaxed font-medium">{report.reviewRemarks}</p>
              </div>
            )}

            {/* ══ MULTI-TIER OFFICIAL REVIEW NOTES: CBAT & MAO ══ */}
            <div data-tour="report-detail-official-notes" className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-[#1A365D]" />
                  Official Field & Municipal Verification Notes
                </span>
                <span className="text-[10px] font-bold text-slate-400">2-Tier Verification</span>
              </div>

              {/* ── CARD 1: NOTED FROM CBAT ── */}
              <div
                className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs ${
                  isVerified || isApproved
                    ? "border-sky-200 bg-gradient-to-br from-sky-50/70 via-white to-sky-50/20 text-slate-900"
                    : isRevision
                    ? "border-rose-200 bg-rose-50/40 text-slate-900"
                    : "border-slate-200 bg-slate-50/60 text-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`size-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                        isVerified || isApproved
                          ? "bg-sky-100 text-sky-800 border-sky-300"
                          : isRevision
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <Stethoscope className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-sky-950">
                          Noted from CBAT
                        </span>
                        <span className="text-[10px] text-sky-800 font-bold bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">
                          SIBAT Field Verification
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {isVerified || isApproved
                          ? `Inspected by ${cbatVerifiedBy}${cbatVerifiedAt ? ` · ${formatDate(cbatVerifiedAt)}` : ""}`
                          : isRevision
                          ? `Revision requested by ${cbatVerifiedBy || "Field Inspector"}`
                          : "Pending on-site visit & physical verification"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                      isVerified || isApproved
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : isRevision
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-amber-100 text-amber-800 border-amber-300"
                    }`}
                  >
                    {isVerified || isApproved ? "Field Verified" : isRevision ? "Revision Needed" : "Pending Visit"}
                  </span>
                </div>

                {/* CBAT Remarks Text */}
                <div className="mt-3 rounded-xl bg-white/95 border border-slate-200/90 p-3.5 text-xs text-slate-800 leading-relaxed shadow-2xs">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Inspector Observations & Field Findings:
                  </span>
                  <p className="whitespace-pre-wrap font-medium text-slate-800">
                    {cbatRemarks ||
                      (isPending
                        ? "A CBAT / SIBAT officer is assigned to conduct an on-site physical examination to verify clinical signs and confirm animal identity."
                        : isApproved
                        ? "On-farm physical examination confirmed the animal's identity and clinical condition prior to MAO approval."
                        : "No specific inspector remarks entered.")}
                  </p>
                </div>

                {/* CBAT Checkpoint Chips (if available) */}
                {(confirmedSymptoms.length > 0 || biosecurityText || temperature != null || isFmdSuspected || severity || tagConfirmed) && (
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    {confirmedSymptoms.length > 0 &&
                      confirmedSymptoms.map((sym) => (
                        <span
                          key={sym}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-sky-100/90 text-sky-900 border border-sky-300 text-[11px] font-bold shadow-2xs"
                        >
                          <CheckCircle2 className="size-3 text-sky-700" />
                          Confirmed: {sym}
                        </span>
                      ))}

                    {biosecurityText && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-950 border border-amber-300 text-[11px] font-bold shadow-2xs">
                        <ShieldAlert className="size-3 text-amber-700" />
                        Protocol: {biosecurityText}
                      </span>
                    )}

                    {temperature != null && (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold shadow-2xs ${
                          temperature >= 39.5
                            ? "bg-rose-50 text-rose-950 border-rose-300"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                        }`}
                      >
                        <Thermometer className="size-3 text-rose-600" />
                        Temp: {temperature}°C {temperature >= 39.5 ? "(High Fever)" : "(Normal)"}
                      </span>
                    )}

                    {isFmdSuspected && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-100 text-rose-950 border border-rose-300 text-[11px] font-black shadow-2xs">
                        <AlertTriangle className="size-3 text-rose-700" />
                        Suspected FMD Flagged
                      </span>
                    )}

                    {severity && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold">
                        Severity: {severity}
                      </span>
                    )}

                    {tagConfirmed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold">
                        <CheckCircle2 className="size-3 text-emerald-700" />
                        Tag Confirmed
                      </span>
                    )}
                  </div>
                )}

                {/* CBAT On-Site Photo (if available) */}
                {report.inspectorPhotoUrl && (
                  <div className="mt-3 pt-3 border-t border-sky-200/60">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1">
                      <Camera className="size-3 text-sky-700" />
                      CBAT On-Site Inspection Photo Evidence:
                    </span>
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-48 aspect-video shadow-2xs">
                      <img
                        src={report.inspectorPhotoUrl}
                        alt="CBAT Inspector Evidence"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-2 flex items-center justify-between text-white text-[10px]">
                        <span className="font-mono truncate">cbat_field_verification.jpg</span>
                        <a
                          href={report.inspectorPhotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-300 font-bold hover:underline"
                        >
                          View Fullscreen
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── CARD 2: NOTED FROM MAO ── */}
              <div
                className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-2xs ${
                  isApproved
                    ? "border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 text-slate-900"
                    : isRevision && !isVerified
                    ? "border-rose-200 bg-rose-50/40 text-slate-900"
                    : "border-slate-200 bg-slate-50/60 text-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`size-8 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <Building2 className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-[#1A365D]">
                          Noted from MAO
                        </span>
                        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                          Municipal Agriculture Office (Padre Garcia)
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        {isApproved
                          ? `Authorized by ${maoReviewedBy}${maoReviewedAt ? ` · ${formatDate(maoReviewedAt)}` : ""}`
                          : isVerified
                          ? "CBAT verification submitted · Queued for MAO municipal sign-off"
                          : "Awaiting CBAT field verification prior to municipal certification"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                      isApproved
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : isVerified
                        ? "bg-sky-100 text-sky-800 border-sky-300"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}
                  >
                    {isApproved ? "MAO Approved & Certified" : isVerified ? "Pending MAO Sign-Off" : "Queued"}
                  </span>
                </div>

                {/* MAO Remarks Text */}
                <div
                  className={`mt-3 rounded-xl border p-3.5 text-xs leading-relaxed shadow-2xs ${
                    isApproved
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950 font-medium"
                      : "bg-white/95 border-slate-200/90 text-slate-700"
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Municipal Directives & Veterinary Certification:
                  </span>
                  <p className="whitespace-pre-wrap font-medium">
                    {maoRemarks ||
                      (isApproved
                        ? "Official MAO Animal Health Certificate verified and filed in municipal surveillance registry."
                        : isVerified
                        ? "The field verification report has been received and is awaiting final administrative sign-off and veterinary advisory release from the Municipal Agriculture Office."
                        : "Awaiting field verification before municipal certification.")}
                  </p>
                </div>
              </div>
            </div>
          </div>

            {isMortality && linkedDisease && (
              <div className="order-4 space-y-1.5">
                <p className="text-xs font-bold text-slate-500">Linked disease report</p>
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-slate-800">
                  <p className="font-bold">DIS-{linkedDisease}{linkedDiseaseName ? ` · ${linkedDiseaseName}` : ""}</p>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    This is a report reference and does not confirm that the disease caused the death.
                  </p>
                </div>
              </div>
            )}

            {/* Farmer Observations */}
            {(report.description || report.photoUrl) && (
              <section className="order-2 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <FileText className="size-5 text-emerald-800" />
                  Farmer Observations
                </h2>
                {report.description && (
                  <div data-tour="report-detail-observations" className="rounded-xl bg-slate-50/80 p-3 text-sm leading-relaxed text-slate-700">
                    <p className="whitespace-pre-wrap break-words">{report.description}</p>
                  </div>
                )}
                {report.photoUrl && (
                  <div data-tour="report-detail-photo" className="space-y-2 border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Camera className="size-3.5 text-emerald-700" />
                      Photos / Documents (1)
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img
                          src={report.photoUrl}
                          alt={report.photoName || "Farmer Photo Evidence"}
                          className="size-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-950/80 to-transparent p-2 text-[10px] text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                          <span className="truncate font-mono">{report.photoName || "farmer_attached_evidence.jpg"}</span>
                          <a
                            href={report.photoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 font-bold text-emerald-300 hover:underline"
                          >
                            View
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

          </div>

          <aside className="min-w-0 lg:sticky lg:top-2">
            <div data-tour="report-detail-qr" aria-label="Report QR pass" className="min-w-0">
              <QrCodePass
                code={report.id}
                qrPayload={qrPayload}
                variant="clinical"
                title={`${isMortality ? "Mortality" : "Disease"} Report Pass`}
                subtitle={qrPayload ? "Scan to open this report in SmartLivestock" : "This report has no supported database record ID"}
                ownerName={report.farmerName || "Registered Farmer"}
                barangay={report.barangayName}
                specie={report.cattleType}
                headCount={report.affectedCount}
                status={report.status}
              />
            </div>
          </aside>
          </div>
        </div>
        </div>

        {/* Footer Actions */}
        <div data-tour="report-detail-actions" className="flex shrink-0 flex-col gap-2.5 border-t border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:p-4 lg:px-7">
            {report.status === "SUBJECT_TO_REVISION" && onEditReport && (
              <Button
                type="button"
                onClick={() => onEditReport(report)}
                className="w-full h-11 rounded-xl bg-amber-500 px-4 text-xs font-bold text-amber-950 hover:bg-amber-600 sm:order-2 sm:w-auto"
              >
                <RotateCcw className="size-3.5" />
                <span>Edit & Resubmit</span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={(event) =>
                printElement(event.currentTarget.closest<HTMLElement>("[data-print-root]"))
              }
              className="h-11 w-full gap-1.5 rounded-xl border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:order-1 sm:mr-auto sm:w-auto"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Print Details</span>
            </Button>

            <Button
              type="button"
              variant="default"
              onClick={() => onOpenChange(false)}
              className="h-11 w-full rounded-xl border-emerald-800 bg-emerald-800 px-8 text-xs font-bold text-white hover:bg-emerald-900 hover:text-white sm:order-3 sm:w-auto sm:text-sm"
            >
              Close
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
