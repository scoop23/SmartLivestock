"use client";

import { httpError } from "@/lib/http-error";
import { LivestockBreedField } from "@/components/livestock-breed-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  LivestockSilhouettePath,
  resolveSpeciesKey,
} from "@/app/(farmer)/livestock-inventory/components/livestock-silhouette-paths";
import { cowHead } from "@lucide/lab";
import {
  Baby,
  BarChart2,
  Beef,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Egg,
  FileText,
  Icon,
  Info,
  Layers,
  MapPin,
  MessageSquare,
  Milk,
  Pencil,
  RotateCcw,
  Save,
  Scissors,
  Send,
  ShoppingBag,
  Sparkles,
  Sprout,
  User,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  useReviewSubmission,
  useUpdateSubmissionData,
  type UnifiedSubmissionItem,
} from "../sibat-analytics";
import { MilkAnomalyAssessmentCard } from "./milk-anomaly-assessment-card";

interface SibatReviewDialogProps {
  submission: UnifiedSubmissionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewSuccess?: () => void;
  hideFooterClose?: boolean;
}

function getReviewErrorMessage(error: unknown): string | null {
  const responseData = (error as {
    response?: { data?: Record<string, unknown> };
  })?.response?.data;
  if (!responseData) return null;

  for (const field of ["remarks", "status", "error", "detail"]) {
    const value = responseData[field];
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return null;
}

function formatReviewDate(value: string | null | undefined): string {
  if (!value) return "N/A";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.slice(0, 10));
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, Number(day))).replace(",", "");
}

function AnimalPhoto({ submission }: { submission: UnifiedSubmissionItem }) {
  const [failed, setFailed] = useState(false);
  const emoji = submission.livestockTypeName?.toLowerCase().includes("cattle") ? "🐄" : "🐾";
  return (
    <div className="relative w-full max-h-48 aspect-[16/9] overflow-hidden rounded-xl border border-slate-200 bg-amber-50 flex items-center justify-center mb-3">
      {submission.photoUrl && !failed ? (
        <Image
          src={submission.photoUrl}
          alt={`${submission.livestockTypeName || "Livestock"}${submission.tagNumber ? `, ear tag ${submission.tagNumber}` : ""}`}
          onError={() => setFailed(true)}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 50vw"
          className="size-full object-cover"
        />
      ) : (
        <span className="text-4xl" aria-label="Livestock photo unavailable">{emoji}</span>
      )}
    </div>
  );
}

function getHeaderIconMeta(submission: UnifiedSubmissionItem) {
  const pType = (
    submission.productionType ||
    (submission.submissionTypeLabel?.toLowerCase().includes("milk") ? "milk" : "") ||
    (submission.submissionTypeLabel?.toLowerCase().includes("meat") ? "meat" : "") ||
    (submission.submissionTypeLabel?.toLowerCase().includes("carcass") ? "meat" : "") ||
    (submission.submissionTypeLabel?.toLowerCase().includes("slaughter") ? "meat" : "") ||
    (submission.submissionTypeLabel?.toLowerCase().includes("egg") ? "eggs" : "") ||
    (submission.submissionTypeLabel?.toLowerCase().includes("wool") ? "wool" : "") ||
    ""
  ).toLowerCase();

  if (submission.sourceType === "PRODUCTION" || pType) {
    if (pType.includes("milk")) {
      return {
        icon: Milk,
        containerClass: "bg-blue-50 text-blue-700 border border-blue-200/60",
      };
    }
    if (pType.includes("meat") || pType.includes("carcass") || pType.includes("slaughter")) {
      return {
        icon: Beef,
        containerClass: "bg-rose-50 text-rose-700 border border-rose-200/60",
      };
    }
    if (pType.includes("egg")) {
      return {
        icon: Egg,
        containerClass: "bg-amber-50 text-amber-700 border border-amber-200/60",
      };
    }
    if (pType.includes("wool")) {
      return {
        icon: Scissors,
        containerClass: "bg-sky-50 text-sky-700 border border-sky-200/60",
      };
    }
    return {
      icon: Sprout,
      containerClass: "bg-[#eaf5ed] text-[#2e7d4c]",
    };
  }

  if (submission.sourceType === "SALE") {
    return {
      icon: ShoppingBag,
      containerClass: "bg-emerald-50 text-emerald-800 border border-emerald-200/60",
    };
  }

  if (submission.sourceType === "CALVING") {
    return {
      icon: Baby,
      containerClass: "bg-pink-50 text-pink-700 border border-pink-200/60",
    };
  }

  if (submission.sourceType === "BATCH" || submission.entryType === "BATCH") {
    return {
      icon: Layers,
      containerClass: "bg-teal-50 text-teal-800 border border-teal-200/60",
    };
  }

  return {
    icon: Sprout,
    containerClass: "bg-[#eaf5ed] text-[#2e7d4c]",
  };
}

export default function SibatReviewDialog(props: SibatReviewDialogProps) {
  return <SibatReviewDialogContent key={`${props.open}:${props.submission?.id}`} {...props} />;
}

function SibatReviewDialogContent({
  submission,
  open,
  onOpenChange,
  onReviewSuccess,
  hideFooterClose = false,
}: SibatReviewDialogProps) {
  const [remarks, setRemarks] = useState(submission?.reviewRemarks || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSuccessAnimated, setIsSuccessAnimated] = useState(false);

  // Edit fields state for inventory / batch corrections
  const [editTagNumber, setEditTagNumber] = useState(submission?.tagNumber || "");
  const [editBreed, setEditBreed] = useState(submission?.breed || "");
  const [editSex, setEditSex] = useState(submission?.sex || "Female");
  const [editWeight, setEditWeight] = useState(submission?.weight != null ? String(submission.weight) : "");
  const [editHousingPen, setEditHousingPen] = useState(submission?.housingPen || "");
  const [editFeedType, setEditFeedType] = useState(submission?.feedType || "");
  const [editTargetWeight, setEditTargetWeight] = useState(submission?.targetWeight ? String(submission.targetWeight) : "");

  const reviewMutation = useReviewSubmission();
  const updateMutation = useUpdateSubmissionData();

  if (!submission) return null;

  const headerIconMeta = getHeaderIconMeta(submission);
  const HeaderIcon = headerIconMeta.icon;

  const isPending = submission.status === "PENDING";
  const isVerified = submission.status === "VERIFIED";
  const isApproved = submission.status === "APPROVED";
  const isReturned = submission.status === "SUBJECT_TO_REVISION" || submission.status === "SUBJECT_FOR_REVISION";
  const isRejected = submission.status === "REJECTED";
  const isBatch = submission.sourceType === "BATCH" || submission.entryType === "BATCH";
  const isCattleInventory = submission.sourceType === "INVENTORY" && resolveSpeciesKey(submission.livestockTypeName) === "cattle";

  // The source type determines whether this record changes inventory. A milk
  // quantity is production volume, never an animal count or disposition.
  let animalCount = 1;
  let animalTagLabel = submission.tagNumber || "";
  let animalNotice = "Recorded in farm inventory.";
  const isProductionObservation = submission.sourceType === "PRODUCTION" && !submission.slaughterDetails;
  const isFarmerProduction = submission.sourceType === "PRODUCTION";

  if (submission.sourceType === "PRODUCTION" && submission.slaughterDetails?.animals?.length) {
    animalCount = submission.slaughterDetails.quantity || submission.slaughterDetails.animals.length;
    animalTagLabel = submission.slaughterDetails.animals
      .map((a) => a.tag_number || `#${a.id}`)
      .join(", ");
    animalNotice = "Leaves active inventory after MAO approval.";
  } else if (isProductionObservation) {
    animalTagLabel = submission.tagNumber || (submission.batchCode ? `Batch ${submission.batchCode}` : submission.livestockTypeName);
    animalNotice = `${submission.productionType?.toLowerCase() === "milk" ? "Milk yield" : "Production"}: ${submission.quantityDisplay} on ${formatReviewDate(submission.recordDate)}.`;
  } else if (submission.tagNumber) {
    animalCount = 1;
    animalTagLabel = submission.tagNumber;
    animalNotice = submission.sourceType === "SALE"
      ? "Leaves active inventory after MAO approval."
      : "Recorded in verified farm inventory.";
  } else if (submission.calfTag) {
    animalCount = 1;
    animalTagLabel = submission.calfTag;
    animalNotice = `Mother Dam: ${submission.damTag || "Registered Dam"}`;
  } else if (submission.batchCode) {
    animalCount = submission.quantity || 1;
    animalTagLabel = `Batch ${submission.batchCode}`;
    animalNotice = "Enrolled in cooperative herd roster.";
  }

  // Farmer remarks resolution
  const farmerRemarks =
    submission.notes?.trim() ||
    (submission.salePurpose ? `Purpose: ${submission.salePurpose}` : null) ||
    "No additional remarks submitted by farmer.";

  const handleSaveEdits = async () => {
    try {
      const payload: Record<string, string | number> = {};
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
    } catch (err: unknown) {
      toast.error("Failed to update record details", {
        description: httpError(err)?.response?.data?.error || "Check your inputs.",
      });
    }
  };

  const handleReviewAction = async (newStatus: "VERIFIED" | "SUBJECT_TO_REVISION") => {
    if (newStatus === "SUBJECT_TO_REVISION" && !remarks.trim()) {
      toast.error("Revision remarks required", {
        description: "Please enter verification remarks explaining what the farmer needs to clarify or correct.",
      });
      return;
    }

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
            setIsSuccessAnimated(true);
            toast.success(
              submission.sourceType === "SALE"
                ? "Sale verified and forwarded to MAO!"
                : submission.sourceType === "CALVING"
                ? "Calving event verified and forwarded to MAO for municipal registration!"
                : isBatch
                ? "Herd verified and forwarded to MAO queue!"
                : submission.sourceType === "PRODUCTION"
                ? "Harvest yield verified and forwarded to MAO queue!"
                : "Animal verified and forwarded to MAO queue!"
            );
            setTimeout(() => {
              setIsSuccessAnimated(false);
              if (onReviewSuccess) onReviewSuccess();
              onOpenChange(false);
            }, 1200);
          } else {
            toast.success("Submission returned to farmer for revision & clarification.");
            if (onReviewSuccess) onReviewSuccess();
            onOpenChange(false);
          }
        },
        onError: (err) => {
          console.error("Failed to submit review action:", err);
          toast.error("Failed to update status.", {
            description: getReviewErrorMessage(err) || "Please check the review details and try again.",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-slate-900 border border-slate-200/90 shadow-2xl w-[calc(100vw-1rem)] sm:w-full sm:max-w-4xl max-h-[96dvh] sm:max-h-[92vh] overflow-y-auto p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl gap-3 sm:gap-3.5">
        {/* Validation Success Animation Overlay */}
        {isSuccessAnimated && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-subtle opacity-75" />
              <div className="relative size-20 rounded-full bg-linear-to-tr from-[#1b4332] to-emerald-600 text-white flex items-center justify-center shadow-xl shadow-emerald-900/30 animate-pop-bounce">
                <CheckCircle2 className="size-11 stroke-[2.5]" />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight animate-in zoom-in-95 duration-300">
              Validated Successfully!
            </h3>
            <p className="text-sm font-semibold text-emerald-800 mt-1 max-w-sm">
              Certified on-site and forwarded to Municipal Agriculture Office queue.
            </p>
            <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              <Sparkles className="size-3.5 text-emerald-600" />
              <span>Verified & Forwarded</span>
            </div>
          </div>
        )}

        {/* ═══ Header ═══ */}
        <DialogHeader className="pb-0 text-left">
          <div className="flex items-start justify-between gap-2.5 pr-8 sm:pr-6">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className={`size-9 sm:size-11 rounded-xl flex items-center justify-center shrink-0 ${headerIconMeta.containerClass}`}>
                {isCattleInventory ? <Icon iconNode={cowHead} className="size-5 sm:size-5.5" /> : <HeaderIcon className="size-5 sm:size-5.5" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-xl font-bold tracking-tight text-slate-900 leading-snug truncate">
                  {submission.sourceType === "SALE"
                    ? "Review Live Animal Sale"
                    : submission.sourceType === "CALVING"
                    ? "Verify Calving & Birthing Event"
                    : submission.sourceType === "PRODUCTION"
                    ? "Farmer-reported Production"
                    : isBatch
                    ? "Review Herd"
                    : "Review Animal Submission"}
                </DialogTitle>
                <DialogDescription className="text-[11px] sm:text-xs font-medium text-slate-500 mt-0.5 truncate">
                  {submission.sourceType === "SALE"
                    ? "Live Animal Sale"
                    : submission.sourceType === "CALVING"
                    ? "Calving & Birthing Event"
                    : submission.sourceType === "PRODUCTION"
                    ? "Production Yield Log"
                    : isBatch
                    ? `Herd #${submission.rawId}`
                    : `Livestock Tag #${submission.tagNumber || submission.rawId}`}
                </DialogDescription>
              </div>
            </div>

            {(submission.batchCode || submission.batchId) && !isBatch && (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex h-7 px-2.5 rounded-lg text-xs font-bold text-teal-900 bg-teal-50 border-teal-300 hover:bg-teal-100 hover:text-teal-950 cursor-pointer shadow-2xs gap-1 shrink-0"
                title="Review entire herd roster in batches drilldown"
              >
                <Link
                  href={`/sibat/batches?batchId=${encodeURIComponent(submission.batchId || submission.batchCode || "")}&animalId=${submission.rawId}&tag=${encodeURIComponent(submission.tagNumber || "")}`}
                >
                  <Layers className="size-3 text-teal-700" />
                  Review Herd
                </Link>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* ═══ Top Stepper / Progress Bar ═══ */}
        {!isFarmerProduction ? <div className="rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3.5">
          <div className="relative grid grid-cols-4 gap-1">
            {/* Connecting lines between centers of circles */}
            <div className="absolute top-3.5 left-[12.5%] right-[12.5%] h-[2px] -translate-y-1/2 flex pointer-events-none">
              {/* Line 1 -> 2: solid forest green */}
              <div className="h-full flex-1 bg-[#1b4332]" />
              {/* Line 2 -> 3: solid if verified/approved, else dashed gray */}
              <div
                className={`h-full flex-1 ${
                  isVerified || isApproved ? "bg-[#1b4332]" : "border-t-2 border-dashed border-slate-300"
                }`}
              />
              {/* Line 3 -> 4: solid if approved, else dashed gray */}
              <div
                className={`h-full flex-1 ${
                  isApproved ? "bg-[#1b4332]" : "border-t-2 border-dashed border-slate-300"
                }`}
              />
            </div>

            {/* Step 1: Farmer Submitted */}
            <div className="relative z-10 flex flex-col items-center text-center min-w-0">
              <div className="size-7 rounded-full bg-[#1b4332] text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                <Check className="size-3.5 stroke-[3]" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-900 mt-1 truncate max-w-full">
                <span className="hidden sm:inline">1. Farmer Submitted</span>
                <span className="sm:hidden">1. Submitted</span>
              </span>
              <span className="text-[9.5px] sm:text-[11px] text-slate-500 mt-0.5 truncate max-w-full">
                {formatReviewDate(submission.createdAt || submission.recordDate)}
              </span>
            </div>

            {/* Step 2: SIBAT / CBAT Field Check */}
            <div className="relative z-10 flex flex-col items-center text-center min-w-0">
              <div
                className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 ${
                  isVerified || isApproved
                    ? "bg-[#1b4332] text-white"
                    : isReturned
                    ? "bg-amber-600 text-white"
                    : isRejected
                    ? "bg-rose-600 text-white"
                    : "bg-[#1b4332] text-white"
                }`}
              >
                {isVerified || isApproved ? (
                  <Check className="size-3.5 stroke-[3]" />
                ) : isReturned ? (
                  <RotateCcw className="size-3" />
                ) : (
                  "2"
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-900 mt-1 truncate max-w-full">
                <span className="hidden sm:inline">
                  2. Field Reviewer Check
                </span>
                <span className="sm:hidden">2. Field Check</span>
              </span>
              {isPending ? (
                <span className="inline-block mt-0.5 px-1.5 sm:px-2 py-0.2 rounded-full bg-[#fef3c7] text-[#92400e] text-[9px] sm:text-[10px] font-semibold truncate max-w-full">
                  Pending review
                </span>
              ) : isReturned ? (
                <span className="inline-block mt-0.5 px-1.5 sm:px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[9px] sm:text-[10px] font-semibold truncate max-w-full">
                  Revision requested
                </span>
              ) : isVerified || isApproved ? (
                <span className="inline-block mt-0.5 px-1.5 sm:px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-semibold truncate max-w-full">
                  Completed
                </span>
              ) : isRejected ? (
                <span className="inline-block mt-0.5 px-1.5 sm:px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[9px] sm:text-[10px] font-semibold truncate max-w-full">
                  Rejected
                </span>
              ) : (
                <span className="text-[9.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate max-w-full">Upcoming</span>
              )}
            </div>

            {/* Step 3: Forwarded to MAO */}
            <div className="relative z-10 flex flex-col items-center text-center min-w-0">
              <div
                className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 ${
                  isVerified || isApproved ? "bg-[#1b4332] text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {isApproved ? <Check className="size-3.5 stroke-[3]" /> : "3"}
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-900 mt-1 truncate max-w-full">
                <span className="hidden sm:inline">3. Forwarded to MAO</span>
                <span className="sm:hidden">3. To MAO</span>
              </span>
              <span className="text-[9.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate max-w-full">
                {isVerified ? "In MAO Queue" : isApproved ? "Forwarded" : "Upcoming"}
              </span>
            </div>

            {/* Step 4: MAO Decision */}
            <div className="relative z-10 flex flex-col items-center text-center min-w-0">
              <div
                className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs shrink-0 ${
                  isApproved ? "bg-[#1b4332] text-white" : "bg-slate-200 text-slate-600"
                }`}
              >
                {isApproved ? <Check className="size-3.5 stroke-[3]" /> : "4"}
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-slate-900 mt-1 truncate max-w-full">
                <span className="hidden sm:inline">4. MAO Decision</span>
                <span className="sm:hidden">4. Decision</span>
              </span>
              <span className="text-[9.5px] sm:text-[11px] text-slate-400 mt-0.5 truncate max-w-full">
                {isApproved ? "Approved" : "Upcoming"}
              </span>
            </div>
          </div>
        </div> : (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs text-slate-700">
            Farmer-reported production remains separate from SIBAT/CBAT review. Any linked official slaughter report follows the municipal slaughter workflow.
          </div>
        )}

        {/* ═══ Main 2-Column Grid ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 items-start">
          {/* LEFT COLUMN: Record details */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-[#eaf5ed] text-[#2e7d4c] flex items-center justify-center shrink-0">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">Record details</h3>
                    <p className="text-[11px] text-slate-500 truncate">Information submitted by the farmer.</p>
                  </div>
                </div>

                {/* Edit toggle for individual animal or batch inventory */}
                {isPending && (!isBatch && submission.sourceType === "INVENTORY" || isBatch) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="h-6.5 text-[11px] text-slate-600 hover:text-slate-900 gap-1 px-2 rounded-md shrink-0"
                  >
                    <Pencil className="size-2.5" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                )}
              </div>

              {!isBatch && submission.sourceType === "INVENTORY" && !isEditing && (
                <div className="pt-2">
                  <AnimalPhoto key={`${submission.id}-${submission.photoUrl || "no-photo"}`} submission={submission} />
                </div>
              )}

              {/* Editable form mode (for inventory / batch records) */}
              {isEditing ? (
                <div className="pt-2.5 space-y-2.5">
                  {!isBatch ? (
                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-emerald-200">
                      <p className="text-[10.5px] font-bold uppercase text-emerald-800 tracking-wider">
                        Edit Animal Identification
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10.5px] font-bold text-slate-600">Ear Tag #</Label>
                          <Input
                            value={editTagNumber}
                            onChange={(e) => setEditTagNumber(e.target.value)}
                            placeholder="e.g. SWN-01-05"
                            className="h-7.5 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                        <LivestockBreedField
                          id="sibat-review-breed"
                          species={submission.livestockTypeName}
                          label="Breed"
                          value={editBreed}
                          onChange={setEditBreed}
                          placeholder="Select breed"
                          controlClassName="h-7.5 rounded-lg text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10.5px] font-bold text-slate-600">Sex</Label>
                          <select
                            value={editSex}
                            onChange={(e) => setEditSex(e.target.value)}
                            className="h-7.5 w-full text-xs rounded-lg border border-slate-200 bg-white px-2 mt-0.5 font-medium"
                          >
                            <option value="Female">Female</option>
                            <option value="Male">Male</option>
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10.5px] font-bold text-slate-600">Body Weight (kg)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            placeholder="65.0"
                            className="h-7.5 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveEdits}
                        disabled={updateMutation.isPending}
                        className="w-full h-7.5 text-xs bg-[#1b4332] hover:bg-[#143326] text-white font-bold rounded-lg mt-1 gap-1.5"
                      >
                        <Save className="size-3" />
                        {updateMutation.isPending ? "Saving..." : "Save Animal Updates"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-emerald-200">
                      <p className="text-[10.5px] font-bold uppercase text-emerald-800 tracking-wider">
                        Edit Herd Housing & Target
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10.5px] font-bold text-slate-600">Housing / Pen</Label>
                          <Input
                            value={editHousingPen}
                            onChange={(e) => setEditHousingPen(e.target.value)}
                            placeholder="e.g. Pen 3 Fattening"
                            className="h-7.5 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10.5px] font-bold text-slate-600">Feed Ration</Label>
                          <Input
                            value={editFeedType}
                            onChange={(e) => setEditFeedType(e.target.value)}
                            placeholder="e.g. Commercial Grower"
                            className="h-7.5 text-xs rounded-lg mt-0.5"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10.5px] font-bold text-slate-600">Target Weight (kg)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          value={editTargetWeight}
                          onChange={(e) => setEditTargetWeight(e.target.value)}
                          placeholder="90"
                          className="h-7.5 text-xs rounded-lg mt-0.5"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveEdits}
                        disabled={updateMutation.isPending}
                        className="w-full h-7.5 text-xs bg-[#1b4332] hover:bg-[#143326] text-white font-bold rounded-lg mt-1 gap-1.5"
                      >
                        <Save className="size-3" />
                        {updateMutation.isPending ? "Saving..." : "Save Herd Updates"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Standard Display List */
                <div className="divide-y divide-slate-100">
                  {/* Farmer */}
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <User className="size-3.5 text-slate-400" />
                      <span className="text-[11px] sm:text-xs font-medium">Farmer</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 text-right truncate max-w-[60%]">
                      {submission.farmerName}
                    </span>
                  </div>

                  {/* Barangay */}
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <MapPin className="size-3.5 text-slate-400" />
                      <span className="text-[11px] sm:text-xs font-medium">Barangay</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 text-right truncate max-w-[60%]">
                      {submission.barangayName}
                    </span>
                  </div>

                  {/* Enterprise */}
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <Icon iconNode={cowHead} className="size-3.5 text-slate-400" />
                      <span className="text-[11px] sm:text-xs font-medium">Enterprise</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 text-right truncate max-w-[60%]">
                      {submission.livestockTypeName || "Livestock"}
                    </span>
                  </div>

                  {/* Reported yield */}
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <BarChart2 className="size-3.5 text-slate-400" />
                      <span className="text-[11px] sm:text-xs font-medium">Reported yield</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 text-right truncate max-w-[60%]">
                      {submission.quantityDisplay}
                    </span>
                  </div>

                  {/* Record date */}
                  <div className="flex items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <Calendar className="size-3.5 text-slate-400" />
                      <span className="text-[11px] sm:text-xs font-medium">Record date</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 text-right truncate max-w-[60%]">
                      {formatReviewDate(submission.recordDate || submission.createdAt)}
                    </span>
                  </div>
                </div>
              )}

              {/* Highlighted Animal Box (Warm Amber Tint) */}
              {!isEditing && animalTagLabel && (
                <div className="rounded-xl bg-[#fff8ed] border border-[#fed7aa]/70 p-2 sm:p-2.5 flex items-center gap-2.5 sm:gap-3 my-1.5 min-w-0">
                  <div className="size-7 rounded-lg bg-[#fef3c7] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 600 420" className="size-5 text-[#b45309] fill-current">
                      <LivestockSilhouettePath species={resolveSpeciesKey(submission.livestockTypeName)} />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] sm:text-xs font-bold text-[#78350f] truncate">
                      {isProductionObservation ? "Production source" : `${animalCount} ${animalCount === 1 ? "animal" : "animals"}`} · {animalTagLabel}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-[#92400e]/80 truncate">
                      {animalNotice}
                    </p>
                  </div>
                </div>
              )}

              {/* Specific metadata for Calving / Birthing */}
              {!isEditing && submission.sourceType === "CALVING" && (
                <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-2 text-xs text-sky-950 space-y-0.5 my-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-sky-700">Calf Ear Tag:</span>
                    <span className="font-bold truncate">{submission.calfTag || "Pending"}</span>
                  </div>
                  {submission.calfSex && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-sky-700">Offspring Sex:</span>
                      <span className="font-bold truncate">{submission.calfSex}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px]">
                    <span className="text-sky-700">Dam (Mother):</span>
                    <span className="font-bold truncate">
                      {submission.damTag || "Registered Dam"}
                      {submission.damBreed ? ` (${submission.damBreed})` : ""}
                    </span>
                  </div>
                  {submission.sireTag && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-sky-700">Sire (Father):</span>
                      <span className="font-bold truncate">{submission.sireTag}</span>
                    </div>
                  )}
                  {submission.birthWeight && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-sky-700">Birth Weight:</span>
                      <span className="font-bold">{submission.birthWeight} kg</span>
                    </div>
                  )}
                  {submission.calvingEase && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-sky-700">Delivery Ease:</span>
                      <span className="font-bold capitalize">{submission.calvingEase.toLowerCase()}</span>
                    </div>
                  )}
                  {submission.calvingDate && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-sky-700">Calving Date:</span>
                      <span className="font-bold">{submission.calvingDate}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Specific metadata for Animal Sale */}
              {!isEditing && submission.sourceType === "SALE" && submission.saleTotalPrice != null && (
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-2 text-xs text-emerald-950 flex justify-between items-center my-1.5">
                  <span className="text-emerald-700 text-[11px]">Recorded Sale Price:</span>
                  <span className="font-bold text-xs sm:text-sm">
                    {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
                      submission.saleTotalPrice
                    )}
                  </span>
                </div>
              )}

              {/* Farmer remarks */}
              {!isEditing && (
                <div className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 shrink-0">
                    <MessageSquare className="size-3.5 text-slate-400" />
                    <span className="text-[11px] sm:text-xs font-medium">Farmer remarks</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 text-right max-w-[60%] break-words">
                    {farmerRemarks}
                  </span>
                </div>
              )}

            </div>
          </div>

          {/* RIGHT COLUMN: Field Verification */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-0.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg bg-[#eaf5ed] text-[#2e7d4c] flex items-center justify-center shrink-0">
                    <ClipboardCheck className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {isFarmerProduction ? "Municipal Visibility" : "Field Verification"}
                    </h3>
                    <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate sm:whitespace-normal">
                      {isFarmerProduction
                        ? "Farmer-reported production context. Official slaughter review is handled separately by MAO."
                        : "Validate the information through in-person assessment."}
                    </p>
                  </div>
                </div>
                <div className="self-start sm:self-auto shrink-0">
                  {isFarmerProduction ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-700">Farmer-reported · not verified</span>
                  ) : isPending ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] text-[10.5px] sm:text-[11px] font-semibold border border-amber-200/60 whitespace-nowrap">
                      Pending field review
                    </span>
                  ) : isVerified ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10.5px] sm:text-[11px] font-semibold border border-emerald-200 whitespace-nowrap">
                      Verified by {submission.reviewedByRole === "CBAT" ? "CBAT" : "SIBAT"}
                    </span>
                  ) : isApproved ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 text-[10.5px] sm:text-[11px] font-semibold border border-emerald-300 whitespace-nowrap">
                      Approved by MAO
                    </span>
                  ) : isReturned ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 text-[10.5px] sm:text-[11px] font-semibold border border-rose-200 whitespace-nowrap">
                      Revision Requested
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10.5px] sm:text-[11px] font-semibold border border-slate-200 whitespace-nowrap">
                      {submission.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Guidelines callout */}
              <div className="rounded-xl bg-[#f0f9f4] border border-[#cbe7d6] p-2.5 sm:p-3 flex items-start gap-2">
                <Info className="size-4 text-[#2d6a4f] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="text-[11px] sm:text-xs font-bold text-[#1b4332]">Guidelines</h4>
                  <p className="text-[10.5px] sm:text-[11px] text-[#2d6a4f] mt-0.5 leading-relaxed">
                    {isFarmerProduction
                      ? "This is a farmer-reported entry for municipal awareness. It does not need SIBAT/CBAT verification; official slaughter actions remain in the MAO workflow."
                      : "Confirm this submission against barangay logs before forwarding to MAO."}
                  </p>
                </div>
              </div>

              {/* Remarks Textarea */}
              {!isFarmerProduction && <div>
                <Label className="text-[11px] sm:text-xs font-semibold text-slate-700 block mb-1">
                  Verification Remarks (Optional)
                </Label>
                <Textarea
                  placeholder="Enter field observations or validation remarks..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={!isPending || reviewMutation.isPending}
                  className="min-h-[75px] sm:min-h-[85px] w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#1b4332] focus-visible:border-[#1b4332] resize-none shadow-2xs"
                />
                <p className="text-[10.5px] text-slate-500 mt-1 leading-relaxed">
                  Include observations on actual stock, weights, documents, or any discrepancies noted during the field check.
                </p>
              </div>}

              {/* Previous Review Info if Available */}
              {(submission.reviewedByName || submission.reviewedAt) && (
                <div className="text-[10.5px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200 space-y-0.5 mt-1.5">
                  <div className="truncate">
                    Reviewed By: <strong className="text-slate-700">{submission.reviewedByName}</strong> ({submission.reviewedByRole || "SIBAT"})
                  </div>
                  {submission.reviewedAt && (
                    <div>Timestamp: {new Date(submission.reviewedAt).toLocaleString()}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ Full-Width Milk Assessment & Visual Chart (Appears only when PENDING with detected anomaly) ═══ */}
        {!isEditing &&
          isPending &&
          submission.anomalyDetected &&
          submission.sourceType === "PRODUCTION" &&
          submission.productionType?.toLowerCase() === "milk" &&
          submission.anomalyAssessment && (
            <MilkAnomalyAssessmentCard submission={submission} />
          )}

        {/* ═══ Footer ═══ */}
        <DialogFooter className={`border-t border-slate-100 pt-2.5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 ${hideFooterClose ? "justify-end" : "justify-between"}`}>
          {!hideFooterClose && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={reviewMutation.isPending}
              className="h-8.5 px-3.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <X className="size-3.5" />
              Close
            </Button>
          )}

          {isPending && (submission.sourceType === "INVENTORY" || submission.sourceType === "CALVING") ? (
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleReviewAction("SUBJECT_TO_REVISION")}
                disabled={reviewMutation.isPending}
                className="h-8.5 px-3.5 rounded-xl border-rose-300 bg-rose-50/70 text-rose-700 hover:bg-rose-100 hover:border-rose-400 hover:text-rose-800 font-semibold text-xs flex items-center justify-center gap-1.5 w-full sm:w-auto transition-colors shadow-2xs"
              >
                <RotateCcw className="size-3 text-rose-600" />
                Return for Revision
              </Button>

              <Button
                type="button"
                onClick={() => handleReviewAction("VERIFIED")}
                disabled={reviewMutation.isPending}
                className="h-8.5 px-4.5 rounded-xl bg-[#1b4332] hover:bg-[#143326] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs w-full sm:w-auto"
              >
                <Send className="size-3" />
                {reviewMutation.isPending
                  ? "Forwarding..."
                  : "Verify & Forward to MAO"}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium italic text-center sm:text-right">
              {submission.sourceType === "SALE" || submission.sourceType === "PRODUCTION"
                ? "Sales and production records are reviewed by MAO. Field reviewers verify livestock inventory and birth records."
                : isReturned
                ? "Awaiting farmer resubmission. SIBAT review becomes available when Pending."
                : isVerified
                ? "Awaiting MAO decision. SIBAT verification is complete."
                : isApproved
                ? "MAO approved this record. Review complete."
                : "Record rejected. No SIBAT review action available."}
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
