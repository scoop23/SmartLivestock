"use client";

import { DiseaseCaseFollowUp } from "@/components/disease-case-follow-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
Dialog,
DialogContent,
DialogDescription,
DialogTitle
} from "@/components/ui/dialog";
import {
Camera,
CheckCircle2,
Clock,
Printer,
RotateCcw,
ShieldCheck,
Skull,
Stethoscope
} from "lucide-react";
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
          bg: "bg-emerald-100 text-emerald-900 border-emerald-300",
          icon: <CheckCircle2 className="size-3.5 text-emerald-700" />,
          title: "Approved by local veterinarian",
          stage: 3,
        };
      case "VERIFIED":
        return {
          bg: "bg-sky-100 text-sky-900 border-sky-300",
          icon: <ShieldCheck className="size-3.5 text-sky-700" />,
          title: "Verified by SIBAT Inspector",
          stage: 2,
        };
      case "SUBJECT_TO_REVISION":
      case "SUBJECT_FOR_REVISION":
      case "REJECTED":
        return {
          bg: "bg-rose-100 text-rose-950 border-rose-300",
          icon: <RotateCcw className="size-3.5 text-rose-700" />,
          title: "Needs Revision",
          stage: 2,
        };
      default:
        return {
          bg: "bg-amber-50 text-amber-900 border-amber-200",
          icon: <Clock className="size-3.5 text-amber-700" />,
          title: "Pending SIBAT Field Check",
          stage: 1,
        };
    }
  };

  const statusConfig = getStatusConfig(report.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain p-0 rounded-2xl border-0 shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:max-h-[92dvh] sm:rounded-3xl">
        {/* Header */}
        <div
          className={`p-4 text-white relative overflow-hidden sm:p-6 ${
            isMortality
              ? "bg-gradient-to-br from-rose-950 via-rose-900 to-rose-800"
              : "bg-gradient-to-br from-[#1E3D1A] via-[#2D5A27] to-emerald-800"
          }`}
        >
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="p-3 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-md">
                {isMortality ? (
                  <Skull className="size-6 text-rose-200" />
                ) : (
                  <Stethoscope className="size-6 text-emerald-200" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="break-words text-base font-black text-white tracking-tight sm:text-lg">
                    {isMortality ? "Mortality Incident Details" : "Health Observation Details"}
                  </DialogTitle>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-white/20 text-white font-bold">
                    Ref #{report.id}
                  </span>
                </div>
                <DialogDescription className="text-xs text-white/80 font-medium mt-0.5">
                  Your report for the local livestock team
                </DialogDescription>
              </div>
            </div>

            <Badge className={`px-2.5 py-1 font-extrabold text-[11px] gap-1.5 ${statusConfig.bg}`}>
              {statusConfig.icon}
              <span>{report.status === "SUBJECT_TO_REVISION" || report.status === "SUBJECT_FOR_REVISION" ? "Needs Revision" : report.status}</span>
            </Badge>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-6">
          {!isMortality && <DiseaseCaseFollowUp key={report.id} caseId={report.id} />}
          {/* 1. 3-Step Lifecycle Stepper */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
              Review Progress
            </p>
            <div className="grid grid-cols-3 gap-2">
              {/* Step 1 */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="size-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                    ✓
                  </div>
                  <span className="text-xs font-bold text-slate-800">1. Lodged</span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">Farmer Declaration</p>
              </div>

              {/* Step 2 */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      statusConfig.stage >= 2
                        ? report.status === "SUBJECT_TO_REVISION" || report.status === "SUBJECT_FOR_REVISION"
                          ? "bg-rose-500 text-white"
                          : "bg-emerald-600 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {statusConfig.stage >= 2 ? (report.status === "SUBJECT_TO_REVISION" || report.status === "SUBJECT_FOR_REVISION" ? "!" : "✓") : "2"}
                  </div>
                  <span className="text-xs font-bold text-slate-800">2. SIBAT Check</span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">
                  {statusConfig.stage >= 2
                    ? report.status === "SUBJECT_TO_REVISION" || report.status === "SUBJECT_FOR_REVISION"
                      ? "Subject for Revision"
                      : "Inspection Complete"
                    : "Scheduled Visit"}
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      statusConfig.stage >= 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {statusConfig.stage >= 3 ? "✓" : "3"}
                  </div>
                  <span className="text-xs font-bold text-slate-800">3. MAO Certify</span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1">
                  {statusConfig.stage >= 3 ? "Report Approved" : "Pending Sign-off"}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Official Inspector / Review Remarks Alert */}
          {(report.status === "SUBJECT_TO_REVISION" || report.status === "SUBJECT_FOR_REVISION") && (
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-300 text-rose-950 space-y-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="size-4 text-rose-700 shrink-0" />
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                  Needs Revision
                </h4>
              </div>
              <p className="text-xs font-medium text-rose-900">
                {report.reviewRemarks ||
                  "Please clarify the affected animal tag or clinical progression with your SIBAT field validator."}
              </p>
              {report.reviewedByName && (
                <p className="text-[10px] text-rose-700 font-bold pt-1">
                  Reviewed by: {report.reviewedByName} • {report.reviewedAt ? new Date(report.reviewedAt).toLocaleDateString() : "Recent"}
                </p>
              )}
            </div>
          )}

          {report.status === "APPROVED" && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-1.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-700 shrink-0" />
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  Reviewed by the local livestock office
                </h4>
              </div>
              <p className="text-xs font-medium text-emerald-900">
                {report.reviewRemarks || "Your report has been reviewed."}
              </p>
              {report.reviewedByName && (
                <p className="text-[10px] text-emerald-700 font-bold">
                  Certified by: {report.reviewedByName}
                </p>
              )}
            </div>
          )}

          {/* 3. Animal Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ear Tag #
              </span>
              <p className="text-xs font-black text-slate-900 mt-0.5 truncate">
                {report.cattleTag}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Breed / Type
              </span>
              <p className="text-xs font-black text-slate-900 mt-0.5 truncate">
                {report.cattleBreed} • {report.cattleType}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Affected Heads
              </span>
              <p className="text-xs font-black text-slate-900 mt-0.5">
                {report.affectedCount} Head{report.affectedCount > 1 ? "s" : ""}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Date Noticed
              </span>
              <p className="text-xs font-black text-slate-900 mt-0.5">
                {report.recordDate || "Recent"}
              </p>
            </div>
          </div>

          {/* 4. Clinical Condition & Symptoms */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              {isMortality ? "Reported Cause of Mortality" : "Reported Signs & Symptoms"}
            </h4>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <p className="text-sm font-black text-slate-900">{report.name}</p>
              {report.symptoms && report.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {report.symptoms.map((sym, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5"
                    >
                      {sym}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. Farmer Notes & Description */}
          {report.description && report.description !== report.name && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Farmer Clinical Notes & Narrative
              </h4>
              <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-700 leading-relaxed">
                {report.description}
              </p>
            </div>
          )}

          {/* 6. Farmer Attached Photo Evidence */}
          {report.photoUrl && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Camera className="size-3.5 text-emerald-700" />
                Attached Photo Evidence
              </h4>
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video max-h-72 shadow-2xs group">
                <img
                  src={report.photoUrl}
                  alt={report.photoName || "Farmer Photo Evidence"}
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-2.5 flex items-center justify-between text-white text-[11px]">
                  <span className="font-mono truncate">{report.photoName || "farmer_attached_evidence.jpg"}</span>
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

          {/* Actions */}
          <div className="flex flex-col items-stretch justify-between gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-center">
            {report.status === "SUBJECT_TO_REVISION" && onEditReport && (
              <Button
                type="button"
                size="sm"
                onClick={() => onEditReport(report)}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-black h-9 px-4 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Edit & Resubmit</span>
              </Button>
            )}

            <div className="ml-auto flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-10 w-full gap-1.5 rounded-xl text-xs font-bold sm:h-9 sm:w-auto"
              >
                <Printer className="size-3.5 text-slate-500" />
                <span>Print Details</span>
              </Button>

              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-10 w-full rounded-xl bg-[#2D5A27] px-5 text-xs font-black text-white hover:bg-[#22441d] cursor-pointer sm:h-9 sm:w-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
