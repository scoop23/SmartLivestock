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
  Pencil,
  Save,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  useReviewSubmission,
  useUpdateSubmissionData,
  type UnifiedSubmissionItem,
} from "../sibat-analytics";

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
  const [isEditing, setIsEditing] = useState(false);

  // Edit fields state
  const [editTagNumber, setEditTagNumber] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editSex, setEditSex] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editHousingPen, setEditHousingPen] = useState("");
  const [editFeedType, setEditFeedType] = useState("");
  const [editTargetWeight, setEditTargetWeight] = useState("");

  const reviewMutation = useReviewSubmission();
  const updateMutation = useUpdateSubmissionData();

  useEffect(() => {
    if (submission) {
      setRemarks(submission.reviewRemarks || "");
      setEditTagNumber(submission.tagNumber || "");
      setEditBreed(submission.breed || "");
      setEditSex(submission.sex || "Female");
      setEditWeight(submission.weight !== null && submission.weight !== undefined ? String(submission.weight) : "");
      setEditHousingPen(submission.housingPen || "");
      setEditFeedType(submission.feedType || "");
      setEditTargetWeight(submission.targetWeight ? String(submission.targetWeight) : "");
      setIsEditing(false);
    }
  }, [submission]);

  if (!submission) return null;

  const isPending = submission.status === "PENDING";
  const isVerified = submission.status === "VERIFIED";
  const isApproved = submission.status === "APPROVED";
  const isRejected = submission.status === "SUBJECT_TO_REVISION" || submission.status === "REJECTED";
  const isBatch = submission.sourceType === "BATCH" || submission.entryType === "BATCH";

  const handleSaveEdits = async () => {
    try {
      const payload: Record<string, any> = {};
      if (isBatch) {
        if (editHousingPen !== undefined) payload.housing_pen = editHousingPen;
        if (editFeedType !== undefined) payload.feed_type = editFeedType;
        if (editTargetWeight) payload.target_weight = parseFloat(editTargetWeight);
      } else {
        if (editTagNumber) payload.tag_number = editTagNumber;
        if (editBreed) payload.breed = editBreed;
        if (editSex) payload.sex = editSex;
        if (editWeight) payload.weight = parseFloat(editWeight);
      }
      await updateMutation.mutateAsync({
        id: submission.rawId,
        isBatch,
        data: payload,
      });
      toast.success("Record details updated successfully!");
      setIsEditing(false);
    } catch (err: any) {
      toast.error("Failed to update record details", {
        description: err?.response?.data?.error || "Check your inputs.",
      });
    }
  };

  const handleReviewAction = async (newStatus: "VERIFIED" | "SUBJECT_TO_REVISION") => {
    if (isEditing) {
      await handleSaveEdits();
    }
    reviewMutation.mutate(
      {
        item: submission,
        status: newStatus,
        remarks: remarks.trim(),
      },
      {
        onSuccess: () => {
          if (newStatus === "VERIFIED") {
            toast.success(
              isBatch
                ? "Cohort Batch verified and forwarded to MAO queue!"
                : "Animal verified and forwarded to MAO queue!"
            );
          } else {
            toast.success("Submission returned to raiser for revision & clarification.");
          }
          if (onReviewSuccess) onReviewSuccess();
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
                  {isBatch ? "Review Cohort Batch" : "Review Animal Submission"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  {submission.sourceType === "PRODUCTION"
                    ? "Production Yield Log"
                    : isBatch
                    ? `Cohort Batch #${submission.rawId}`
                    : `Livestock Tag #${submission.tagNumber || submission.rawId}`}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {submission.batchCode && !isBatch && (
                <Badge className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-bold">
                  Cohort: {submission.batchCode}
                </Badge>
              )}
              <SibatStatusBadge status={submission.status} />
            </div>
          </div>
        </DialogHeader>


        {/* ═══ Content: Two-Column Operational View ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* LEFT COLUMN: Farmer Submitted Information (Editable by SIBAT) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Layers className="size-3.5 text-[#1A365D]" />
                <span>{isBatch ? "Cohort Batch Information" : "Animal Identification"}</span>
              </div>
              {isPending && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-6 px-2 text-[11px] font-bold text-slate-700 hover:text-slate-900 rounded-lg gap-1 cursor-pointer"
                >
                  <Pencil className="size-3 text-emerald-600" />
                  <span>{isEditing ? "Cancel Edit" : "Edit Details"}</span>
                </Button>
              )}
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

              {/* Specific Metadata for Individual Animals */}
              {!isBatch && submission.sourceType === "INVENTORY" && (
                <div className="pt-2 border-t border-slate-200/50 space-y-2.5">
                  {isEditing ? (
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-emerald-200">
                      <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                        Edit Animal Identification
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-slate-600">Ear Tag #</Label>
                          <Input
                            value={editTagNumber}
                            onChange={(e) => setEditTagNumber(e.target.value)}
                            placeholder="e.g. SWN-01-05"
                            className="h-7 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-slate-600">Breed</Label>
                          <Input
                            value={editBreed}
                            onChange={(e) => setEditBreed(e.target.value)}
                            placeholder="e.g. Large White"
                            className="h-7 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-slate-600">Sex</Label>
                          <select
                            value={editSex}
                            onChange={(e) => setEditSex(e.target.value)}
                            className="h-7 w-full text-xs rounded-lg border border-slate-200 bg-white px-2 mt-0.5 font-medium"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                            <option value="Castrated">Castrated</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-slate-600">Body Weight (kg)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            placeholder="65.0"
                            className="h-7 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveEdits}
                        disabled={updateMutation.isPending}
                        className="w-full h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg mt-1 gap-1"
                      >
                        <Save className="size-3" />
                        {updateMutation.isPending ? "Saving..." : "Save Animal Updates"}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
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
                          <span className="text-[11px] font-semibold text-slate-400 block">Sex</span>
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
                </div>
              )}

              {/* Specific Metadata for Cohort Batches */}
              {isBatch && (
                <div className="pt-2 border-t border-slate-200/50 space-y-2.5">
                  {isEditing ? (
                    <div className="space-y-2 bg-white p-3 rounded-xl border border-emerald-200">
                      <p className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                        Edit Batch Housing & Target
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-slate-600">Housing / Pen</Label>
                          <Input
                            value={editHousingPen}
                            onChange={(e) => setEditHousingPen(e.target.value)}
                            placeholder="e.g. Pen 3 Fattening"
                            className="h-7 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-slate-600">Feed Ration</Label>
                          <Input
                            value={editFeedType}
                            onChange={(e) => setEditFeedType(e.target.value)}
                            placeholder="e.g. Commercial Grower"
                            className="h-7 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-slate-600">Target Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editTargetWeight}
                          onChange={(e) => setEditTargetWeight(e.target.value)}
                          placeholder="90"
                          className="h-7 text-xs rounded-lg mt-0.5"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveEdits}
                        disabled={updateMutation.isPending}
                        className="w-full h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg mt-1 gap-1"
                      >
                        <Save className="size-3" />
                        {updateMutation.isPending ? "Saving..." : "Save Batch Updates"}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">Batch Code</span>
                        <span className="font-bold text-emerald-800 flex items-center gap-1 pt-0.5">
                          <Layers className="size-3 text-emerald-600" />
                          {submission.tagNumber || submission.batchCode}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">Housing Pen</span>
                        <span className="font-bold text-slate-800 block pt-0.5">
                          {submission.housingPen || "Standard Pen"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">Feed Formulation</span>
                        <span className="font-bold text-slate-800 block pt-0.5">
                          {submission.feedType || "Farm Rations"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">Target Weight</span>
                        <span className="font-bold text-slate-800 block pt-0.5">
                          {submission.targetWeight ? `${submission.targetWeight} kg` : "N/A"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Child animals roster count */}
                  {submission.animals && submission.animals.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/50">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                        Animals Linked to this Cohort ({submission.animals.length} heads):
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {submission.animals.map((a: any) => (
                          <Badge
                            key={a.id}
                            variant="secondary"
                            className="text-[10px] font-mono font-bold bg-white border border-slate-200"
                          >
                            {a.tag_number || `#${a.id}`} • {a.weight ? `${a.weight}kg` : a.sex}
                          </Badge>
                        ))}
                      </div>
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
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 italic text-[11px] min-h-[40px]">
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
