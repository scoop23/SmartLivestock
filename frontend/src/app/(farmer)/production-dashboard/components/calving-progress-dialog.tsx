"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCalendarDate } from "@/lib/livestock-age";
import type { CalvingRecordItem } from "../production-calving-tab";
import { AlertCircle, Check, Clock3, ClipboardCheck, PawPrint } from "lucide-react";
import Link from "next/link";

interface CalvingProgressDialogProps {
  record: CalvingRecordItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${formatCalendarDate(value)} · ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

interface ProgressStep {
  title: string;
  detail: string;
  complete: boolean;
  current: boolean;
  attention?: boolean;
}

export default function CalvingProgressDialog({ record, open, onOpenChange }: CalvingProgressDialogProps) {
  if (!record) return null;

  const status = record.status || "PENDING";
  const needsCorrection = status === "SUBJECT_TO_REVISION" || status === "SUBJECT_FOR_REVISION";
  const fieldReviewComplete = status === "VERIFIED" || status === "APPROVED" || needsCorrection;
  const maoReviewComplete = status === "APPROVED";
  const inventoryCreated = record.offspring_inventory != null;
  const submittedAt = formatDateTime(record.created_at);
  const reviewedAt = formatDateTime(record.reviewed_at);

  const steps: ProgressStep[] = [
    {
      title: "Submitted by you",
      detail: submittedAt ? `Birth record submitted · ${submittedAt}` : "Birth record submitted",
      complete: true,
      current: false,
    },
    {
      title: "SIBAT field verification",
      detail: fieldReviewComplete
        ? `Field verification completed${reviewedAt && status === "VERIFIED" ? ` · ${reviewedAt}` : ""}`
        : "Waiting for an on-farm field review",
      complete: fieldReviewComplete,
      current: status === "PENDING",
    },
    {
      title: "MAO review",
      detail: needsCorrection
        ? `Correction requested${reviewedAt ? ` · ${reviewedAt}` : ""}`
        : maoReviewComplete
          ? `Calving record approved${reviewedAt ? ` · ${reviewedAt}` : ""}`
          : "Waiting for municipal approval",
      complete: maoReviewComplete,
      current: status === "VERIFIED" || needsCorrection,
      attention: needsCorrection,
    },
    {
      title: "Official calf registration",
      detail: inventoryCreated
        ? `Added to livestock inventory · #${record.offspring_inventory}`
        : "The calf will appear in official inventory after approval",
      complete: inventoryCreated,
      current: maoReviewComplete && !inventoryCreated,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-xl max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl bg-white p-5 sm:p-7">
        <DialogHeader className="border-b border-slate-100 pb-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ClipboardCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold text-slate-900">Calving record progress</DialogTitle>
              <p className="mt-1 break-words text-sm text-slate-600">
                {record.calf_tag || `Calf record #${record.id}`} · Dam {record.dam_tag ? `#${record.dam_tag}` : `#${record.dam}`}
              </p>
            </div>
            <Badge variant="outline" className={needsCorrection
              ? "shrink-0 border-rose-200 bg-rose-50 text-rose-700"
              : status === "APPROVED"
                ? "shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800"
                : "shrink-0 border-amber-200 bg-amber-50 text-amber-800"}>
              {needsCorrection ? "Correction needed" : status === "APPROVED" ? "Approved" : status === "VERIFIED" ? "In MAO review" : "In progress"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="py-2">
          <ol className="space-y-0">
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex gap-3 pb-6 last:pb-0">
                {index < steps.length - 1 && (
                  <span className={`absolute left-[15px] top-8 h-[calc(100%-0.75rem)] w-px ${step.complete ? "bg-emerald-300" : "bg-slate-200"}`} aria-hidden="true" />
                )}
                <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${
                  step.attention
                    ? "border-rose-200 bg-rose-50 text-rose-600"
                    : step.complete
                      ? "border-emerald-200 bg-emerald-600 text-white"
                      : step.current
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-white text-slate-400"
                }`}>
                  {step.attention ? <AlertCircle className="size-4" /> : step.complete ? <Check className="size-4" /> : index === 3 ? <PawPrint className="size-4" /> : <Clock3 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
                    {step.current && !step.attention && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Current step</span>}
                    {step.attention && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Action required</span>}
                  </div>
                  <p className={`mt-1 text-xs leading-relaxed ${step.attention ? "text-rose-700" : "text-slate-500"}`}>{step.detail}</p>
                  {step.attention && record.review_remarks && (
                    <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50/70 p-3 text-xs leading-relaxed text-rose-800">
                      <span className="font-semibold">Reviewer’s note: </span>{record.review_remarks}
                    </div>
                  )}
                  {record.reviewed_by_name && (
                    (status === "VERIFIED" && step.title === "SIBAT field verification") ||
                    ((maoReviewComplete || needsCorrection) && step.title === "MAO review")
                  ) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {status === "VERIFIED" ? "Verified by" : "Reviewed by"} {record.reviewed_by_name}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {inventoryCreated && (
          <Link href={`/livestock-inventory/${record.offspring_inventory}`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
            View official inventory record
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
