"use client";

import { useState, useEffect } from "react";
import {
  Baby,
  Calendar,
  CheckCircle2,
  Clock,
  Droplets,
  HeartPulse,
  Info,
  Layers,
  MapPin,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  XCircle,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import SibatStatusBadge from "./sibat-status-badge";
import { useReviewSubmission, type UnifiedSubmissionItem } from "../sibat-analytics";

interface SibatReviewDialogProps {
  submission: UnifiedSubmissionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewSuccess?: () => void;
}

export default function SibatReviewDialog({
  submission,
  open,
  onOpenChange,
  onReviewSuccess,
}: SibatReviewDialogProps) {
  const [remarks, setRemarks] = useState("");
  const reviewMutation = useReviewSubmission();

  useEffect(() => {
    if (submission) {
      setRemarks(submission.reviewRemarks || "");
    }
  }, [submission]);

  if (!submission) return null;

  const isPending = submission.status === "PENDING";
  const isVerified = submission.status === "VERIFIED";
  const isApproved = submission.status === "APPROVED";
  const isRejected = submission.status === "SUBJECT_TO_REVISION" || submission.status === "REJECTED";

  const handleReviewAction = (newStatus: "VERIFIED" | "SUBJECT_TO_REVISION") => {
    reviewMutation.mutate(
      {
        item: submission,
        status: newStatus,
        remarks: remarks.trim(),
      },
      {
        onSuccess: () => {
          if (newStatus === "VERIFIED") {
            toast.success("Submission verified and forwarded to MAO queue for municipal approval.");
          } else {
            toast.success("Submission returned to raiser for revision & clarification.");
          }
          onOpenChange(false);
        },
        onError: (err) => {
          console.error("Failed to submit review action:", err);
          toast.error("Failed to update status. Please try again.");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#1A365D]/10 text-[#1A365D] flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  Review Farmer Submission
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  {submission.sourceType === "PRODUCTION" ? "Production Yield Log" : "Livestock Registry Entry"} • #{submission.rawId}
                </DialogDescription>
              </div>
            </div>

            <SibatStatusBadge status={submission.status} />
          </div>
        </DialogHeader>

        {/* ═══ Content: Two-Column Operational View ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* LEFT COLUMN: Farmer Submitted Information (Read-Only) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
              <Layers className="size-3.5 text-[#1A365D]" />
              <span>Farmer Submission Details</span>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70 space-y-3 text-xs">
              {/* Farmer & Barangay */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Farmer Name</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 pt-0.5">
                    <User className="size-3.5 text-slate-500" />
                    {submission.farmerName}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Barangay Sector</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1.5 pt-0.5">
                    <MapPin className="size-3.5 text-slate-500" />
                    {submission.barangayName}
                  </span>
                </div>
              </div>

              {/* Livestock Type & Details */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Livestock Enterprise</span>
                  <span className="font-bold text-slate-900 block pt-0.5">
                    {submission.livestockTypeName}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block">Reported Yield / Quantity</span>
                  <span className="font-bold text-emerald-800 text-sm block pt-0.5">
                    {submission.quantityDisplay}
                  </span>
                </div>
              </div>

              {/* Specific Metadata for Inventory */}
              {submission.sourceType === "INVENTORY" && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                  {submission.tagNumber && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Ear Tag Number</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1 pt-0.5">
                        <Tag className="size-3 text-emerald-600" />
                        {submission.tagNumber}
                      </span>
                    </div>
                  )}
                  {submission.breed && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Breed</span>
                      <span className="font-bold text-slate-800 block pt-0.5">
                        {submission.breed}
                      </span>
                    </div>
                  )}
                  {submission.sex && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Sex / Classification</span>
                      <span className="font-bold text-slate-800 block pt-0.5">
                        {submission.sex}
                      </span>
                    </div>
                  )}
                  {submission.weight && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Body Weight</span>
                      <span className="font-bold text-slate-800 block pt-0.5">
                        {submission.weight} kg
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Date of Record */}
              <div className="pt-1 border-t border-slate-200/50 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Date of Record:</span>
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Calendar className="size-3 text-slate-400" />
                  {submission.recordDate}
                </span>
              </div>

              {/* Farmer Notes */}
              <div className="pt-2 border-t border-slate-200/50">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Farmer Observation / Remarks
                </span>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 italic text-[11px] min-h-[50px]">
                  {submission.notes ? `"${submission.notes}"` : "No additional remarks submitted by farmer."}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SIBAT Field Validation Action */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-100">
              <ShieldCheck className="size-3.5 text-[#1A365D]" />
              <span>SIBAT Validation Actions</span>
            </div>

            {/* Workflow status box */}
            <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
              isPending
                ? "bg-amber-50/70 border-amber-200 text-amber-900"
                : isVerified
                ? "bg-sky-50/70 border-sky-200 text-sky-900"
                : isApproved
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                : "bg-rose-50/70 border-rose-200 text-rose-900"
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs">
                <Info className="size-4 shrink-0" />
                <span>Validation Protocol Guidelines</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {isPending
                  ? "As SIBAT field officer, inspect this submission against local barangay logs. Clicking 'Verify & Forward' forwards the record directly into the Municipal Agriculture Office (MAO) approval queue."
                  : isVerified
                  ? "This submission has been field-verified by SIBAT and is queued for final municipal certification by MAO."
                  : isApproved
                  ? "This submission is officially approved by the Municipal Agriculture Office."
                  : "This submission was returned for revision. The farmer must update the entry."}
              </p>
            </div>

            {/* SIBAT Remarks Textarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>SIBAT Field Verification Remarks</span>
                {isPending && <span className="text-[10px] text-slate-400 font-normal">Optional</span>}
              </Label>
              <Textarea
                placeholder="Enter field observation notes, ear tag confirmation, or validation remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={!isPending || reviewMutation.isPending}
                className="text-xs min-h-[90px] rounded-xl bg-white focus-visible:ring-emerald-500/30"
              />
            </div>

            {/* Previous Review Info if Available */}
            {(submission.reviewedByName || submission.reviewedAt) && (
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                <span className="font-semibold text-slate-700 block">Last Review Log:</span>
                {submission.reviewedByName && (
                  <div>Reviewed By: <strong className="text-slate-800">{submission.reviewedByName}</strong></div>
                )}
                {submission.reviewedAt && (
                  <div>Timestamp: {new Date(submission.reviewedAt).toLocaleString()}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Bottom: Workflow Step Trail ═══ */}
        <div className="border-t border-slate-100 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
            Official Municipal Verification Trail
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            {/* Step 1: Farmer Submitted */}
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                <CheckCircle2 className="size-3.5 text-emerald-700" />
                <span>1. Farmer Submitted</span>
              </div>
              <span className="text-[10px] text-emerald-700/80 block mt-0.5">
                {submission.recordDate}
              </span>
            </div>

            {/* Step 2: SIBAT Review */}
            <div className={`p-2.5 rounded-xl border ${
              isPending
                ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}>
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                {isPending ? (
                  <Clock className="size-3.5 text-amber-700 animate-pulse" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-700" />
                )}
                <span>2. SIBAT Field Check</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {isPending ? "In Progress" : "Completed"}
              </span>
            </div>

            {/* Step 3: SIBAT Verified */}
            <div className={`p-2.5 rounded-xl border ${
              isVerified
                ? "bg-sky-50 border-sky-300 text-sky-900 font-bold"
                : isApproved
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                {isVerified || isApproved ? (
                  <CheckCircle2 className="size-3.5 text-sky-700" />
                ) : (
                  <div className="size-3 rounded-full border border-slate-300" />
                )}
                <span>3. Forwarded to MAO</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {isVerified || isApproved ? "Forwarded" : "Pending Verification"}
              </span>
            </div>

            {/* Step 4: MAO Final Decision */}
            <div className={`p-2.5 rounded-xl border ${
              isApproved
                ? "bg-emerald-100 border-emerald-300 text-emerald-950 font-bold"
                : isRejected
                ? "bg-amber-50 border-amber-300 text-amber-950 font-bold"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                {isApproved ? (
                  <CheckCircle2 className="size-3.5 text-emerald-700" />
                ) : isRejected ? (
                  <AlertCircle className="size-3.5 text-amber-700" />
                ) : (
                  <div className="size-3 rounded-full border border-slate-300" />
                )}
                <span>4. MAO Decision</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {isApproved ? "Approved" : isRejected ? "Subject to Revision" : "Awaiting MAO"}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Dialog Actions ═══ */}
        <DialogFooter className="border-t border-slate-100 pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reviewMutation.isPending}
            className="text-xs font-semibold rounded-xl w-full sm:w-auto"
          >
            Close
          </Button>

          {isPending ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleReviewAction("SUBJECT_TO_REVISION")}
                disabled={reviewMutation.isPending}
                className="border-amber-300 text-amber-900 hover:bg-amber-50 font-bold text-xs rounded-xl gap-1.5 flex-1 sm:flex-initial"
              >
                <RotateCcw className="size-3.5 text-amber-700" />
                Return for Revision
              </Button>

              <Button
                type="button"
                onClick={() => handleReviewAction("VERIFIED")}
                disabled={reviewMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm shadow-emerald-950/20 flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="size-3.5" />
                {reviewMutation.isPending ? "Forwarding..." : "Verify & Forward to MAO"}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium italic">
              Status is {submission.status.toLowerCase()} — no further SIBAT action required.
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
