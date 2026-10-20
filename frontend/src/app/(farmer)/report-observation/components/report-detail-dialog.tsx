"use client";

import { DiseaseCaseFollowUp } from "@/components/disease-case-follow-up";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { printElement } from "@/lib/print-element";
import { cowHead } from "@lucide/lab";
import {
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  History,
  Icon,
  MapPin,
  Printer,
  RotateCcw,
  ShieldCheck,
  Skull,
  Users,
  X,
} from "lucide-react";
import React from "react";
import { FarmerReport } from "../report-observation-types";

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
  if (!report) return null;

  const isMortality = report.reportType === "MORTALITY";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-print-root
        className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 rounded-3xl border border-slate-200/90 bg-white shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:max-h-[92dvh]"
      >
        {/* Header - Clean white style with icon container and Close button */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`size-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs border ${
                isMortality
                  ? "bg-rose-50 text-rose-800 border-rose-200/80"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200/80"
              }`}
            >
              {isMortality ? (
                <Skull className="size-5 text-rose-700" />
              ) : (
                <ClipboardList className="size-5 text-[#2D5A27]" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  {isMortality ? "Mortality Incident Details" : "Health Observation Details"}
                </DialogTitle>
                <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                  Ref #{report.id}
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                Official livestock health declaration and municipal review record
              </DialogDescription>
            </div>
          </div>

          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* 1. Review progress - 4-step horizontal stepper */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900 mb-4">
              <BarChart3 className="size-4 text-[#2D5A27]" />
              <span>Review progress</span>
            </div>

            <div className="relative flex items-start justify-between">
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
              <div className="relative z-1 flex flex-col items-center text-center max-w-[76px] sm:max-w-[90px]">
                <div className="size-7 rounded-full bg-[#1A3D22] text-white flex items-center justify-center text-xs font-black shadow-2xs">
                  ✓
                </div>
                <span className="text-[11px] font-bold text-slate-800 mt-2 leading-tight">
                  Farmer Submitted
                </span>
              </div>

              {/* Step 2: Field Review */}
              <div className="relative z-1 flex flex-col items-center text-center max-w-[76px] sm:max-w-[90px]">
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
              </div>

              {/* Step 3: MAO Review */}
              <div className="relative z-1 flex flex-col items-center text-center max-w-[76px] sm:max-w-[90px]">
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
              </div>

              {/* Step 4: Case Resolution */}
              <div className="relative z-1 flex flex-col items-center text-center max-w-[76px] sm:max-w-[90px]">
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

          {/* 2. Follow-up & case resolution card */}
          {!isMortality && <DiseaseCaseFollowUp key={report.id} caseId={report.id} />}

          {/* Section Divider */}
          <hr className="border-slate-200/80 my-5" />

          {/* 3. Case history section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <History className="size-4 text-slate-800" />
              <span>Case history</span>
            </div>

            {/* Metadata badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-bold shadow-2xs">
                <Users className="size-3.5 text-slate-500" />
                {report.affectedCount} head{report.affectedCount > 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-bold shadow-2xs">
                <MapPin className="size-3.5 text-slate-500" />
                {report.barangayName ? `Brgy. ${report.barangayName}` : "Local check"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-bold shadow-2xs">
                <Calendar className="size-3.5 text-slate-500" />
                {formatDate(report.recordDate)}
              </span>
            </div>

            {/* Official Review Status Banner */}
            <div
              className={`rounded-xl border p-3 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-2xs ${statusConfig.bg}`}
            >
              <div className="shrink-0">{statusConfig.icon}</div>
              <div className="flex-1 leading-snug">
                <span>{statusConfig.title}</span>
                {report.reviewedByName && (
                  <span className="block text-[11px] font-normal opacity-90 mt-0.5">
                    Inspected by {report.reviewedByName}
                    {report.reviewedAt ? ` on ${formatDate(report.reviewedAt)}` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Official Inspector Revision Remarks */}
            {(report.status === "SUBJECT_TO_REVISION" ||
              report.status === "SUBJECT_FOR_REVISION" ||
              report.status === "REJECTED") &&
              report.reviewRemarks && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-1">
                  <p className="font-bold text-rose-900">Feedback from SIBAT Inspector:</p>
                  <p className="leading-relaxed">{report.reviewRemarks}</p>
                </div>
              )}

            {/* Case Summary Card */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-500">Case summary</p>
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 flex items-center gap-3.5 shadow-2xs">
                <div className="size-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                  <Icon iconNode={cowHead} className="size-6 text-slate-800" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {isMortality ? "Deceased Livestock" : "Cattle"} •{" "}
                    {report.cattleBreed || report.cattleType || "Livestock"}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>👥 {report.affectedCount} head</span>
                    <span className="text-slate-300">|</span>
                    <span>📅 Reported {formatDate(report.recordDate)}</span>
                    {report.cattleTag && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono font-bold text-slate-700 bg-slate-200/60 px-1.5 py-0.2 rounded text-[11px]">
                          Tag: {report.cattleTag}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Reported Symptoms / Cause */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-500">
                {isMortality ? "Reported cause of mortality" : "Reported symptoms"}
              </p>
              <div className="flex flex-wrap gap-2">
                {report.symptoms && report.symptoms.length > 0 ? (
                  report.symptoms.map((sym) => (
                    <span
                      key={sym}
                      className="rounded-xl border border-amber-300/80 bg-amber-50/80 text-amber-950 px-3 py-1.5 text-xs font-bold shadow-2xs"
                    >
                      {sym}
                    </span>
                  ))
                ) : (
                  <span className="rounded-xl border border-amber-300/80 bg-amber-50/80 text-amber-950 px-3 py-1.5 text-xs font-bold shadow-2xs">
                    {report.name}
                  </span>
                )}
              </div>
            </div>

            {/* Farmer Observations */}
            {report.description && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-500">Farmer observations</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-700 leading-relaxed flex items-start gap-2.5">
                  <FileText className="size-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="whitespace-pre-wrap break-words">{report.description}</p>
                </div>
              </div>
            )}

            {/* Photo Evidence */}
            {report.photoUrl && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Camera className="size-3.5 text-[#2D5A27]" />
                  Attached Photo Evidence
                </p>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video max-h-72 shadow-2xs group">
                  <img
                    src={report.photoUrl}
                    alt={report.photoName || "Farmer Photo Evidence"}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-2.5 flex items-center justify-between text-white text-[11px]">
                    <span className="font-mono truncate">
                      {report.photoName || "farmer_attached_evidence.jpg"}
                    </span>
                    <a
                      href={report.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 font-bold hover:underline"
                    >
                      View Fullscreen
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2.5">
            {report.status === "SUBJECT_TO_REVISION" && onEditReport && (
              <Button
                type="button"
                onClick={() => onEditReport(report)}
                className="w-full sm:w-auto h-11 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-bold px-4 cursor-pointer gap-1.5"
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
              className="w-full sm:w-auto h-11 gap-1.5 rounded-xl border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="size-3.5 text-slate-500" />
              <span>Print Details</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:flex-1 h-11 rounded-xl border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-xs sm:text-sm cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
