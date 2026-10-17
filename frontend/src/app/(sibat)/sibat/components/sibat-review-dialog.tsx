"use client";

import { httpError } from "@/lib/http-error";
import { LivestockBreedField } from "@/components/livestock-breed-field";
import { Badge } from "@/components/ui/badge";
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
import { formatAgeClassification,formatCalendarDate,formatLivestockAge } from "@/lib/livestock-age";
import {
Baby,
Calendar,
CheckCircle2,
Clock,
Info,
Layers,
MapPin,
RotateCcw,
Save,
ShieldCheck,
Sparkles,
Tag,
User
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useState } from "react";
import { toast } from "sonner";
import {
useReviewSubmission,
useUpdateSubmissionData,
type UnifiedSubmissionItem,
} from "../sibat-analytics";
import SibatStatusBadge from "./sibat-status-badge";

interface SibatReviewDialogProps {
  submission: UnifiedSubmissionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewSuccess?: () => void;
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

function AnimalPhoto({ submission }: { submission: UnifiedSubmissionItem }) {
  const [failed, setFailed] = useState(false);
  const emoji = submission.livestockTypeName?.toLowerCase().includes("cattle") ? "🐄" : "🐾";
  return (
    <div className="relative w-full max-h-64 aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-amber-50 flex items-center justify-center">
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
        <span className="text-5xl" aria-label="Livestock photo unavailable">{emoji}</span>
      )}
    </div>
  );
}

export default function SibatReviewDialog(props: SibatReviewDialogProps) {
  return <SibatReviewDialogContent key={`${props.open}:${props.submission?.id}`} {...props} />;
}

function SibatReviewDialogContent({
  submission,
  open,
  onOpenChange,
  onReviewSuccess,
}: SibatReviewDialogProps) {
  const [remarks, setRemarks] = useState(submission?.reviewRemarks || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSuccessAnimated, setIsSuccessAnimated] = useState(false);

  // Edit fields state
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

  const isPending = submission.status === "PENDING";
  const isVerified = submission.status === "VERIFIED";
  const isApproved = submission.status === "APPROVED";
  // Either reviewer can return a record. The farmer acts next; only resubmission
  // makes it PENDING and actionable by SIBAT again. Status alone cannot identify the reviewer.
  const isReturned = submission.status === "SUBJECT_TO_REVISION" || submission.status === "SUBJECT_FOR_REVISION";
  const returnedBySibat = isReturned && submission.reviewedByRole === "SIBAT";
  const returnedByMao = isReturned && submission.reviewedByRole === "MAO";
  const isRejected = submission.status === "REJECTED";
  const isBatch = submission.sourceType === "BATCH" || submission.entryType === "BATCH";

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
            toast.success("Submission returned to raiser for revision & clarification.");
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
      <DialogContent className="bg-white text-slate-900 border border-slate-200 shadow-2xl w-[calc(100vw-1rem)] sm:w-full sm:max-w-3xl max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
        {/* Validation Success Animation Overlay */}
        {isSuccessAnimated && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping-subtle opacity-75" />
              <div className="relative size-20 rounded-full bg-linear-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 animate-pop-bounce">
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

        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#1A365D]/10 text-[#1A365D] flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-slate-900">
                  {submission.sourceType === "SALE"
                ? "Review Live Animal Sale"
                : submission.sourceType === "CALVING"
                    ? "Verify Calving & Birthing Event"
                    : isBatch
                    ? "Review Herd"
                    : submission.sourceType === "PRODUCTION"
                    ? "Review Harvest & Yield Log"
                    : "Review Animal Submission"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  {submission.sourceType === "SALE"
                ? "Live Animal Sale"
                : submission.sourceType === "CALVING"
                    ? `Dam Tag #${submission.damTag || "N/A"} • Calf Tag #${submission.calfTag || "Unassigned"}`
                    : submission.sourceType === "PRODUCTION"
                    ? "Production Yield Log"
                    : isBatch
                    ? `Herd #${submission.rawId}`
                    : `Livestock Tag #${submission.tagNumber || submission.rawId}`}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(submission.batchCode || submission.batchId) && !isBatch && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 rounded-lg text-xs font-bold text-teal-900 bg-teal-50 border-teal-300 hover:bg-teal-100 hover:text-teal-950 cursor-pointer shadow-2xs gap-1.5"
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
                <span>{submission.sourceType === "CALVING" ? "Birthing & Pedigree Information" : isBatch ? "Herd Information" : "Animal Identification"}</span>
              </div>
            </div>

            {!isBatch && submission.sourceType === "INVENTORY" && (
              <AnimalPhoto key={`${submission.id}-${submission.photoUrl || "no-photo"}`} submission={submission} />
            )}

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

              {submission.slaughterDetails && <div className="rounded-xl bg-amber-50 p-3 text-xs space-y-1">
                <p className="font-semibold">Slaughter event: {submission.slaughterDetails.quantity} animals</p>
                <p>{submission.slaughterDetails.animals.map(animal => animal.tag_number || `Animal #${animal.id}`).join(", ")}</p>
                <p>Only these animals leave active inventory after MAO approval.</p>
              </div>}

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
                        <LivestockBreedField
                            id="sibat-review-breed"
                            species={submission.livestockTypeName}
                            label="Breed"
                            value={editBreed}
                            onChange={setEditBreed}
                            placeholder="Select breed"
                            controlClassName="h-7 rounded-lg text-xs"
                          />
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
                      {submission.sourceType === "INVENTORY" && (
                        <div>
                          <span className="text-[11px] font-semibold text-slate-400 block">Birth Date · Age / Class</span>
                          <span className="font-bold text-slate-800 block pt-0.5">
                            {formatCalendarDate(submission.birthDate)} · {formatLivestockAge(submission.age)} · {formatAgeClassification(submission.ageClassification)}
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

                      {(submission.batchCode || submission.batchId) && (
                        <div className="col-span-2 mt-2 p-2.5 rounded-xl bg-teal-50/90 border border-teal-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 block">
                              Enrolled in Herd Roster
                            </span>
                            <span className="font-bold text-xs text-teal-950 flex items-center gap-1.5 pt-0.5">
                              <Layers className="size-3.5 text-teal-700 shrink-0" />
                              {submission.batchName ? `${submission.batchName} (${submission.batchCode || `#${submission.batchId}`})` : submission.batchCode || `Herd #${submission.batchId}`}
                            </span>
                          </div>
                          <Button
                            asChild
                            size="sm"
                            className="h-7 px-3 rounded-lg text-xs font-bold bg-[#1A365D] text-white hover:bg-[#132742] shrink-0 gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Link
                              href={`/sibat/batches?batchId=${encodeURIComponent(submission.batchId || submission.batchCode || "")}&animalId=${submission.rawId}&tag=${encodeURIComponent(submission.tagNumber || "")}`}
                            >
                              <Layers className="size-3" />
                              Review Herd
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Specific Metadata for Calving & Birthing Events */}
              {submission.sourceType === "CALVING" && (
                <div className="pt-2 border-t border-slate-200/50 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Mother Cow / Dam Tag</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1 pt-0.5">
                        <Tag className="size-3 text-sky-600" />
                        {submission.damTag || "Registered Dam"}
                      </span>
                    </div>
                    {submission.damBreed && (
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 block">Dam Breed</span>
                        <span className="font-bold text-slate-800 block pt-0.5">
                          {submission.damBreed}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Calf Ear Tag</span>
                      <span className="font-bold text-emerald-800 flex items-center gap-1 pt-0.5">
                        <Baby className="size-3 text-emerald-600" />
                        {submission.calfTag || "Pending Tag"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Calf Sex</span>
                      <span className="font-bold text-slate-800 block pt-0.5">
                        {submission.calfSex || "Female"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Birth Weight</span>
                      <span className="font-bold text-slate-800 block pt-0.5">
                        {submission.birthWeight ? `${submission.birthWeight} kg` : "Not recorded"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block">Calving Ease</span>
                      <span className="font-bold text-slate-800 block pt-0.5">
                        {submission.calvingEase || "Normal / Unassisted"}
                      </span>
                    </div>
                    {submission.sireTag && (
                      <div className="col-span-2">
                        <span className="text-[11px] font-semibold text-slate-400 block">Sire / Father Reference</span>
                        <span className="font-bold text-slate-800 block pt-0.5">
                          {submission.sireTag}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {submission.sourceType === "SALE" && (
                <div className="space-y-2 border-t border-slate-200/50 pt-2 text-sm">
                  <p>Destination: {submission.saleDestination || "Not recorded"}</p>
                  <p>Purpose: {submission.salePurpose || "Not recorded"}</p>
                  <p>Recorded sale price: {submission.saleTotalPrice == null ? "Not recorded" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(submission.saleTotalPrice)}</p>
                </div>
              )}

              {/* Specific Metadata for Herds */}
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
                          {submission.feedType || "—"}
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
                        Animals Linked to this Herd ({submission.animals.length} heads):
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {submission.animals.map((a) => (
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
                  : isReturned
                  ? "Returned for revision: awaiting farmer corrections and resubmission. SIBAT will review it again once its status returns to Pending."
                  : "This submission is rejected. No review action is available."}
              </p>
            </div>

            {/* SIBAT Remarks Textarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>{isPending ? "SIBAT Field Verification Remarks" : "Reviewer Remarks"}</span>
                {isPending && <span className="text-[10px] text-slate-500 font-normal">Required to return · Optional to verify</span>}
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
            Current Verification Workflow
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            {/* Step 1: Farmer Submitted */}
            <div aria-current={isReturned ? "step" : undefined} className={`p-2.5 rounded-xl border ${isReturned
              ? "bg-amber-50 border-amber-300 text-amber-900"
              : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                {isReturned ? <RotateCcw className="size-3.5 text-amber-700" /> : <CheckCircle2 className="size-3.5 text-emerald-700" />}
                <span>{isReturned ? "1. Farmer Revision Required" : "1. Farmer Submitted"}</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {isReturned ? "Awaiting corrections & resubmission" : submission.recordDate}
              </span>
            </div>

            {/* Step 2: SIBAT Review */}
            <div aria-current={isPending ? "step" : undefined} className={`p-2.5 rounded-xl border ${
              isPending
                ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                : returnedBySibat
                ? "bg-rose-50 border-rose-300 text-rose-950"
                : isVerified || isApproved || returnedByMao
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                {isPending ? (
                  <Clock className="size-3.5 text-amber-700 animate-pulse" />
                ) : isVerified || isApproved ? (
                  <CheckCircle2 className="size-3.5 text-emerald-700" />
                ) : (
                  <div className="size-3 rounded-full border border-slate-300" />
                )}
                <span>2. SIBAT Field Check</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {isPending ? "Pending SIBAT Review" : returnedBySibat ? "Returned by SIBAT for revision" : returnedByMao ? "Verified before MAO review" : isReturned ? "Review after resubmission" : isRejected ? "Review closed" : "Completed"}
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
                {isVerified || isApproved || returnedByMao ? "Forwarded" : returnedBySibat ? "Not forwarded — SIBAT requested revision" : isReturned ? "Requires SIBAT re-verification" : isRejected ? "Review closed" : "Pending Verification"}
              </span>
            </div>

            {/* Step 4: MAO Final Decision */}
            <div aria-current={isVerified ? "step" : undefined} className={`p-2.5 rounded-xl border ${
              isApproved
                ? "bg-emerald-100 border-emerald-300 text-emerald-950 font-bold"
                : returnedByMao
                ? "bg-rose-50 border-rose-300 text-rose-950 font-bold"
                : isVerified
                ? "bg-sky-50 border-sky-300 text-sky-900 font-bold"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <div className="flex items-center justify-center gap-1 font-bold text-[11px]">
                {isApproved ? (
                  <CheckCircle2 className="size-3.5 text-emerald-700" />
                ) : isVerified ? (
                  <Clock className="size-3.5 text-sky-700" />
                ) : (
                  <div className="size-3 rounded-full border border-slate-300" />
                )}
                <span>4. MAO Decision</span>
              </div>
              <span className="text-[10px] opacity-80 block mt-0.5">
                {isApproved ? "Approved" : returnedByMao ? "Returned by MAO for revision" : returnedBySibat ? "Not reached — awaiting SIBAT verification" : isVerified ? "Awaiting MAO Decision" : isReturned ? "Awaiting resubmission & verification" : isRejected ? "Record rejected" : "Awaiting SIBAT Verification"}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Dialog Actions ═══ */}
        <DialogFooter className="border-t border-slate-100 pt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleReviewAction("SUBJECT_TO_REVISION")}
                disabled={reviewMutation.isPending || !remarks.trim()}
                className="border-rose-300 text-rose-900 hover:bg-rose-50 font-bold text-xs rounded-xl gap-1.5 flex-1 sm:flex-initial"
              >
                <RotateCcw className="size-3.5 text-rose-700" />
                Return for Revision
              </Button>

              <Button
                type="button"
                onClick={() => handleReviewAction("VERIFIED")}
                disabled={reviewMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm shadow-emerald-950/20 flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="size-3.5" />
                {reviewMutation.isPending
                  ? "Forwarding..."
                  : submission.sourceType === "SALE"
                ? "Verify Sale & Forward to MAO"
                : submission.sourceType === "CALVING"
                  ? "Verify Calving & Forward to MAO"
                  : "Verify & Forward to MAO"}
              </Button>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium italic">
              {isReturned
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
