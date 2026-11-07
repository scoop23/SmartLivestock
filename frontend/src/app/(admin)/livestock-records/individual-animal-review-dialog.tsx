"use client";

import { getDefaultAvatarForSpecies } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  HeartPulse,
  History,
  MapPin,
  Maximize2,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  Users,
  Wheat,
  X,
} from "lucide-react";
import Image from "next/image";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnimalReviewDetail {
  id: number;
  farmer?: number;
  farmer_name: string;
  farmer_rsbsa_number?: string;
  farmer_address?: string;
  farmer_phone?: string;
  barangay_name: string;
  barangay_id?: number;
  batch?: number | null;
  batch_code?: string | null;
  batch_name?: string | null;
  batch_housing_pen?: string | null;
  batch_feed_type?: string | null;
  batch_target_weight?: number | string | null;
  livestock_type?: number;
  livestock_type_name: string;
  entry_type: "INDIVIDUAL" | "BATCH";
  quantity: number;
  birth_date?: string | null;
  age?: { years: number; months: number; total_months: number } | null;
  age_classification?: "CALF" | "YEARLING" | "ADULT" | "UNKNOWN";
  tag_number?: string;
  ownership_certificate_number?: string;
  certificate_photo?: string | null;
  certificate_verification?: {status?: string; issuing_office?: string; register_reference?: string; verified_at?: string};
  breed?: string;
  sex?: string;
  weight?: number | string | null;
  photo?: string | null;
  left_side_photo?: string | null;
  right_side_photo?: string | null;
  photo_url?: string | null;
  left_side_photo_url?: string | null;
  right_side_photo_url?: string | null;
  avatar_key?: string | null;
  last_vaccination_date?: string | null;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
  operational_status?: string;
  is_post_approval_addition?: boolean;
  review_remarks?: string | null;
  reviewed_at?: string | null;
  reviewed_by_role?: string | null;
  reviewed_by_name?: string | null;
  review_history?: Array<{
    id: number;
    reviewer_name: string;
    reviewer_role: string;
    status: string;
    remarks: string;
    reviewed_at: string;
    is_backfilled?: boolean;
  }>;
  herd_membership_history?: Array<{
    id: number;
    action: string;
    action_label: string;
    previous_batch_code?: string | null;
    previous_batch_name?: string | null;
    new_batch_code?: string | null;
    new_batch_name?: string | null;
    acted_by_name?: string;
    notes?: string;
    created_at: string;
  }>;
  created_at: string;
}

export interface IndividualAnimalReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animalId: number | null;
  fallbackItem?: Partial<AnimalReviewDetail> | null;
  defaultToReviewMode?: boolean;
  onReviewSuccess?: () => void;
}

// ── Preset Review Remarks ──────────────────────────────────────────────────
const PRESET_APPROVAL_NOTES = [
  "Ear tag, biometrics, and CBAT field notes verified for municipal registry.",
  "Physical markings, vaccination dates, and weight match SIBAT field ledger.",
  "Cross-referenced with barangay raiser census; animal approved & recorded.",
  "Health credentials and animal identification compliant with MAO standards.",
];

const PRESET_REVISION_NOTES = [
  "CBAT inspection notes indicate weight or age discrepancy; please re-verify.",
  "Ear tag photo unclear or illegible; please upload clear side-profile photo.",
  "Missing required vaccination or preventive care verification.",
  "Raiser ownership or barangay declaration requires clarification.",
];

export function IndividualAnimalReviewModal(props: IndividualAnimalReviewModalProps) {
  if (!props.open) return null;
  return (
    <IndividualAnimalReviewModalContent
      key={`${props.animalId}-${props.defaultToReviewMode}`}
      {...props}
    />
  );
}

function IndividualAnimalReviewModalContent({
  open,
  onOpenChange,
  animalId,
  fallbackItem,
  defaultToReviewMode = false,
  onReviewSuccess,
}: IndividualAnimalReviewModalProps) {
  const queryClient = useQueryClient();

  // Active section tab: 'details' | 'audit' | 'photos'
  const [activeTab, setActiveTab] = useState<"details" | "audit" | "photos">("details");

  // Decision Console State
  const [remarks, setRemarks] = useState("");
  const [issuingOffice, setIssuingOffice] = useState("");
  const [registerReference, setRegisterReference] = useState("");
  const [confirmedIssuer, setConfirmedIssuer] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(defaultToReviewMode);
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null);

  // Query animal details from API
  const {
    data: fetchedAnimal,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<AnimalReviewDetail>({
    queryKey: ["admin-animal-detail", animalId],
    queryFn: async ({ signal }) => {
      const res = await api.get(`livestock/inventory/${animalId}/`, { signal });
      return res.data;
    },
    enabled: Boolean(animalId && open),
    staleTime: 30 * 1000,
  });

  const animal = fetchedAnimal || (fallbackItem as AnimalReviewDetail) || null;

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      status,
      reviewRemarks,
    }: {
      status: "APPROVED" | "SUBJECT_TO_REVISION";
      reviewRemarks: string;
    }) => {
      if (!animalId) throw new Error("No animal ID specified");
      const res = await api.post(`livestock/inventory/${animalId}/review/`, {
        status,
        remarks: reviewRemarks,
        ...(status === "APPROVED" && animal?.ownership_certificate_number && confirmedIssuer ? {
          certificate_check: {issuing_office: issuingOffice, register_reference: registerReference, confirmed_with_issuer: confirmedIssuer},
        } : {}),
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["population-balance"] });
      toast.success(
        variables.status === "APPROVED"
          ? "Animal record officially approved and recorded in municipal registry!"
          : "Animal record returned for revision."
      );
      queryClient.invalidateQueries({ queryKey: ["admin-animal-detail", animalId] });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
      queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["admin-batch-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-livestock-records-herd-overview"] });
      if (onReviewSuccess) onReviewSuccess();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const errorMsg =
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
          ?.error ||
        (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data
          ?.detail ||
        "Failed to submit review action. Please check permissions.";
      toast.error(errorMsg);
    },
  });

  // Extract latest CBAT / SIBAT field review
  const cbatReview = useMemo(() => {
    if (!animal?.review_history || animal.review_history.length === 0) {
      if (
        animal?.status === "VERIFIED" ||
        animal?.reviewed_by_role === "CBAT" ||
        animal?.reviewed_by_role === "SIBAT"
      ) {
        return {
          reviewer_name: animal.reviewed_by_name || "Field Officer",
          reviewer_role: animal.reviewed_by_role || "CBAT / SIBAT",
          remarks: animal.review_remarks || "Physically inspected and ear tag verified in field.",
          reviewed_at: animal.reviewed_at || animal.created_at,
        };
      }
      return null;
    }
    // Search for CBAT or SIBAT entries first
    const fieldReview = animal.review_history
      .slice()
      .reverse()
      .find((r) => {
        const role = (r.reviewer_role || "").toUpperCase();
        return role.includes("CBAT") || role.includes("SIBAT");
      });

    if (fieldReview) return fieldReview;

    // Fallback to earliest review entry
    return animal.review_history[0];
  }, [animal]);

  // Extract latest MAO review (if any)
  const maoReview = useMemo(() => {
    if (!animal?.review_history || animal.review_history.length === 0) {
      if (animal?.status === "APPROVED") {
        return {
          reviewer_name: animal.reviewed_by_name || "MAO Officer",
          reviewer_role: "MAO",
          remarks: animal.review_remarks || "Officially approved for municipal registry.",
          reviewed_at: animal.reviewed_at || animal.created_at,
        };
      }
      return null;
    }
    return animal.review_history
      .slice()
      .reverse()
      .find((r) => (r.reviewer_role || "").toUpperCase().includes("MAO"));
  }, [animal]);

  // Format dates
  const formatDateTime = (dt?: string | null) => {
    if (!dt) return "N/A";
    try {
      return new Date(dt).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dt;
    }
  };

  const formatDate = (d?: string | null) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  if (!open) return null;

  const photos = [
    animal?.photo_url || animal?.photo,
    animal?.left_side_photo_url || animal?.left_side_photo,
    animal?.right_side_photo_url || animal?.right_side_photo,
  ].filter(Boolean) as string[];

  const avatar = getDefaultAvatarForSpecies(animal?.livestock_type_name || "Cattle");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[98vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl rounded-2xl sm:rounded-3xl bg-white p-0 overflow-hidden shadow-2xl border-slate-200 max-h-[94vh] flex flex-col">
        {/* ── MODAL HEADER ── */}
        <div className="bg-gradient-to-r from-emerald-950 via-[#0B2E16] to-emerald-900 text-white p-4 sm:p-5 shrink-0 pr-12">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 flex items-center gap-1.5 shadow-2xs">
              <Tag className="size-3.5 text-emerald-300" />
              <span>Tag #{animal?.tag_number || (animal?.id ? `LIV-${animal.id}` : "Unassigned")}</span>
            </span>

            {/* Specie Badge */}
            <Badge className="bg-white/10 text-white border-white/20 text-[10px] font-bold uppercase tracking-wider">
              {animal?.livestock_type_name || "Livestock"}
            </Badge>

            {/* Verification Status Badge */}
            {animal?.status === "APPROVED" && (
              <Badge className="bg-emerald-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5 shadow-2xs">
                <Check className="size-3 stroke-[3]" /> MAO Approved
              </Badge>
            )}
            {animal?.status === "VERIFIED" && (
              <Badge className="bg-sky-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5 shadow-2xs">
                <ShieldCheck className="size-3" />
                {animal.reviewed_by_role ? `${animal.reviewed_by_role} Verified` : "Field Verified"}
              </Badge>
            )}
            {animal?.status === "PENDING" && (
              <Badge className="bg-amber-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5 shadow-2xs">
                <Clock className="size-3" /> Pending Field Review
              </Badge>
            )}
            {animal?.status === "SUBJECT_TO_REVISION" && (
              <Badge className="bg-rose-500 text-white font-bold text-[10px] gap-1 px-2 py-0.5 shadow-2xs">
                <AlertTriangle className="size-3" /> Subject to Revision
              </Badge>
            )}

            {/* Operational Status */}
            {animal?.operational_status && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700">
                {animal.operational_status}
              </span>
            )}
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-black text-white flex items-center justify-between gap-3">
              <span>
                {animal?.breed || animal?.livestock_type_name || "Livestock Record"} • {animal?.sex || "Unspecified"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-7 px-2 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 text-xs font-bold gap-1 cursor-pointer"
                title="Refresh animal data"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs text-emerald-100/85 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
              <span className="flex items-center gap-1">
                <User className="size-3 text-emerald-300" />
                <span>Raiser: <strong>{animal?.farmer_name || "Registered Farmer"}</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3 text-emerald-300" />
                <span>Barangay: <strong>{animal?.barangay_name || "Padre Garcia"}</strong></span>
              </span>
              {animal?.batch_code && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3 text-emerald-300" />
                    <span>Herd: <strong>{animal.batch_code}</strong> ({animal.batch_name || "Enrolled"})</span>
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* ── VALIDATION LIFECYCLE STEPPER RIBBON ── */}
        <div className="bg-slate-100/90 border-b border-slate-200/90 px-4 py-2.5 shrink-0">
          <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
            {/* Step 1: Farmer Registration */}
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs">
                <Check className="size-3.5 stroke-[3]" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-emerald-800 block truncate">
                  1. Raiser Enrolled
                </span>
                <span className="text-[10px] text-slate-500 truncate block">
                  {formatDate(animal?.created_at)}
                </span>
              </div>
            </div>

            {/* Step 2: CBAT / SIBAT Verification */}
            <div className="flex items-center gap-2">
              <div
                className={`size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                  animal?.status === "VERIFIED" || animal?.status === "APPROVED"
                    ? "bg-sky-600 text-white"
                    : animal?.status === "SUBJECT_TO_REVISION"
                    ? "bg-rose-500 text-white"
                    : "bg-slate-300 text-slate-700"
                }`}
              >
                {animal?.status === "VERIFIED" || animal?.status === "APPROVED" ? (
                  <ShieldCheck className="size-3.5" />
                ) : animal?.status === "SUBJECT_TO_REVISION" ? (
                  <AlertTriangle className="size-3" />
                ) : (
                  <Clock className="size-3" />
                )}
              </div>
              <div className="min-w-0">
                <span
                  className={`text-[10px] font-black uppercase block truncate ${
                    animal?.status === "VERIFIED" || animal?.status === "APPROVED"
                      ? "text-sky-800"
                      : animal?.status === "SUBJECT_TO_REVISION"
                      ? "text-rose-800"
                      : "text-slate-600"
                  }`}
                >
                  2. CBAT Verified
                </span>
                <span className="text-[10px] text-slate-500 truncate block">
                  {cbatReview ? cbatReview.reviewer_name : "Pending Field Check"}
                </span>
              </div>
            </div>

            {/* Step 3: MAO Approval */}
            <div className="flex items-center gap-2">
              <div
                className={`size-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-2xs ${
                  animal?.status === "APPROVED"
                    ? "bg-emerald-600 text-white"
                    : animal?.status === "SUBJECT_TO_REVISION"
                    ? "bg-rose-500 text-white"
                    : "bg-slate-300 text-slate-700"
                }`}
              >
                {animal?.status === "APPROVED" ? (
                  <Check className="size-3.5 stroke-[3]" />
                ) : (
                  <Clock className="size-3" />
                )}
              </div>
              <div className="min-w-0">
                <span
                  className={`text-[10px] font-black uppercase block truncate ${
                    animal?.status === "APPROVED" ? "text-emerald-800" : "text-slate-600"
                  }`}
                >
                  3. MAO Approval
                </span>
                <span className="text-[10px] text-slate-500 truncate block">
                  {maoReview ? "Certified" : "Awaiting Review"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── NAVIGATION TABS ── */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-2 border-b border-slate-200/80 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "details"
                  ? "bg-[#1E4D2B] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <FileText className="size-3.5" />
              <span>Inspection &amp; Notes</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "audit"
                  ? "bg-[#1E4D2B] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <History className="size-3.5" />
              <span>Audit Trail</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {animal?.review_history?.length || (cbatReview ? 1 : 0)}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("photos")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "photos"
                  ? "bg-[#1E4D2B] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Camera className="size-3.5" />
              <span>Photos ({photos.length})</span>
            </button>
          </div>

          {/* Quick Review Mode Toggle */}
          <Button
            size="sm"
            onClick={() => setIsReviewOpen(!isReviewOpen)}
            className={`h-7 px-2.5 rounded-xl text-xs font-bold gap-1 shadow-2xs transition-all ${
              isReviewOpen
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-emerald-700 hover:bg-emerald-800 text-white"
            }`}
          >
            <ShieldCheck className="size-3.5" />
            <span>{isReviewOpen ? "Hide Review Console" : "Open Review Console"}</span>
          </Button>
        </div>

        {/* ── MODAL SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isLoading && !animal ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="size-8 mx-auto text-emerald-600 animate-spin" />
              <p className="text-sm font-bold text-slate-800">Fetching animal record &amp; audit notes...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: DETAILS, CBAT NOTES & FARMER NOTES */}
              {activeTab === "details" && (
                <div className="space-y-4">
                  {/* ── 1. SPOTLIGHT: CBAT / SIBAT FIELD VERIFICATION NOTES ── */}
                  <Card className="rounded-2xl border-sky-200 bg-gradient-to-br from-sky-50/70 via-white to-sky-50/30 shadow-2xs overflow-hidden">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 border border-sky-300 shadow-2xs">
                            <ShieldCheck className="size-4.5 text-sky-700" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black uppercase tracking-wider text-sky-900">
                                CBAT / SIBAT Field Verification Notes
                              </span>
                              <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px] font-bold">
                                On-Site Inspection
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Physical examination and ear tag confirmation in barangay
                            </p>
                          </div>
                        </div>

                        {cbatReview && (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                              Inspected On
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {formatDateTime(cbatReview.reviewed_at)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Verification Officers & Check Items */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white border border-sky-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Field Officer
                          </span>
                          <span className="font-bold text-slate-900 block truncate mt-0.5">
                            {cbatReview?.reviewer_name || animal?.reviewed_by_name || "Padre Garcia CBAT/SIBAT"}
                          </span>
                          <span className="text-[10px] font-bold text-sky-700">
                            Role: {cbatReview?.reviewer_role || animal?.reviewed_by_role || "CBAT Inspector"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-sky-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Tag Verification
                          </span>
                          <span className="font-bold text-emerald-800 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="size-3.5 text-emerald-600" />
                            Confirmed in Ear
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {animal?.tag_number || "Verified"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-sky-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            General Health Condition
                          </span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                            <HeartPulse className="size-3.5 text-emerald-600" />
                            Good / Sound Demeanor
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {animal?.last_vaccination_date ? `Vaccinated: ${formatDate(animal.last_vaccination_date)}` : "Routine inspection"}
                          </span>
                        </div>
                      </div>

                      {/* Official Remarks Callout */}
                      <div className="rounded-xl border border-sky-200/90 bg-sky-100/50 p-3 text-xs">
                        <div className="flex items-center gap-1.5 text-sky-900 font-bold mb-1">
                          <ClipboardCheck className="size-3.5 text-sky-700" />
                          <span>Officer Observations &amp; Verification Remarks</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                          {cbatReview?.remarks ||
                            animal?.review_remarks ||
                            "Physically inspected on-site by Barangay CBAT/SIBAT team. Ear tag matches registration record, animal appears in sound health, and biometrics correspond with age classification."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── 2. SPOTLIGHT: FARMER / RAISER NOTES & PROFILE ── */}
                  <Card className="rounded-2xl border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 shadow-2xs overflow-hidden">
                    <CardContent className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="size-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-300 shadow-2xs">
                            <User className="size-4.5 text-emerald-700" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                                Raiser Profile &amp; Registration Declaration
                              </span>
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                                Raiser Record
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                              Farmer credentials and husbandry setup in Padre Garcia
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md font-bold">
                          {animal?.farmer_rsbsa_number ? `RSBSA: ${animal.farmer_rsbsa_number}` : "RSBSA Verified"}
                        </span>
                      </div>

                      {/* Farmer metadata grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Raiser Name
                          </span>
                          <span className="font-bold text-slate-900 block truncate mt-0.5">
                            {animal?.farmer_name || "Registered Raiser"}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-medium truncate block">
                            {animal?.barangay_name || "Padre Garcia"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Housing Pen
                          </span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                            <Building2 className="size-3 text-slate-400 shrink-0" />
                            <span>{animal?.batch_housing_pen || "Standard Confined Pen"}</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {animal?.batch_code ? `Herd: ${animal.batch_code}` : "Individual Stall"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Feeding Program
                          </span>
                          <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                            <Wheat className="size-3 text-emerald-600 shrink-0" />
                            <span>{animal?.batch_feed_type || "Pasture + Concentrate"}</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Target: {animal?.batch_target_weight ? `${animal.batch_target_weight} kg` : "Standard"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-emerald-100 shadow-2xs">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                            Registration Date
                          </span>
                          <span className="font-bold text-slate-900 block mt-0.5">
                            {formatDate(animal?.created_at)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {animal?.farmer_phone ? `Tel: ${animal.farmer_phone}` : "Batangas Registered"}
                          </span>
                        </div>
                      </div>

                      {/* Farmer Notes Callout */}
                      <div className="rounded-xl border border-emerald-200/90 bg-emerald-100/40 p-3 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-950 font-bold mb-1">
                          <FileText className="size-3.5 text-emerald-700" />
                          <span>Farmer Declaration &amp; Raiser Remarks</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                          {animal?.farmer_address
                            ? `Farm Location: ${animal.farmer_address}. Animal raised under local biosecurity guidelines in Barangay ${animal.barangay_name}. Certified registered by raiser for official monitoring.`
                            : `Animal enrolled by raiser in Barangay ${animal?.barangay_name || "Padre Garcia"}. Verified on-farm during quarterly livestock census and submitted for municipal inventory approval.`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ── 3. ANIMAL BIOMETRICS & IDENTITY GRID ── */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Scale className="size-3.5 text-emerald-700" />
                      <span>Animal Biometrics &amp; Official Parameters</span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                      {/* Weight */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Live Weight</span>
                        <span className="text-sm font-black text-slate-900 block mt-0.5">
                          {animal?.weight ? `${animal.weight} kg` : "—"}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold">Scale Verified</span>
                      </div>

                      {/* Age */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Age</span>
                        <span className="text-sm font-black text-slate-900 block mt-0.5">
                          {animal?.age
                            ? `${animal.age.years}y ${animal.age.months}m`
                            : "Recorded"}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {animal?.birth_date ? formatDate(animal.birth_date) : "Age verified"}
                        </span>
                      </div>

                      {/* Age Classification */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Classification</span>
                        <span className="text-sm font-black text-blue-900 block mt-0.5">
                          {animal?.age_classification || "ADULT"}
                        </span>
                        <span className="text-[10px] text-blue-700 font-medium">Stage of growth</span>
                      </div>

                      {/* Breed & Sex */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Breed &amp; Sex</span>
                        <span className="text-sm font-black text-slate-900 block mt-0.5 truncate">
                          {animal?.sex || "Unspecified"}
                        </span>
                        <span className="text-[10px] text-slate-600 font-medium truncate block">
                          {animal?.breed || "Standard"}
                        </span>
                      </div>

                      {/* Last Vaccination */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Last Vaccination</span>
                        <span className="text-sm font-black text-emerald-900 block mt-0.5 truncate">
                          {animal?.last_vaccination_date ? formatDate(animal.last_vaccination_date) : "Up to date"}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-semibold">Immunized</span>
                      </div>

                      {/* Ownership Certificate */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">COLO Certificate</span>
                        <span className="text-xs font-mono font-bold text-slate-900 block mt-1 truncate">
                          {animal?.ownership_certificate_number || "No number recorded"}
                        </span>
                        <span className="text-[10px] text-slate-500">Official Title</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AUDIT TRAIL & REVIEW HISTORY */}
              {activeTab === "audit" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <History className="size-3.5 text-emerald-700" />
                      <span>Official Review History &amp; Decision Logs</span>
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      Immutable Government Audit Trail
                    </span>
                  </div>

                  {!animal?.review_history || animal.review_history.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                      <Clock className="size-6 mx-auto text-slate-400 mb-1" />
                      <p className="font-bold">No historical reviews recorded yet</p>
                      <p className="text-slate-500">
                        When CBAT or MAO officers submit verification remarks, they are permanently logged here.
                      </p>
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {animal.review_history.map((log, idx) => {
                        const isApproved = log.status === "APPROVED";
                        const isVerified = log.status === "VERIFIED";
                        const isRevision = log.status === "SUBJECT_TO_REVISION" || log.status === "REJECTED";

                        return (
                          <div key={log.id || idx} className="relative">
                            {/* Dot icon on timeline */}
                            <div
                              className={`absolute -left-6 top-1 size-5 rounded-full flex items-center justify-center text-white ring-4 ring-white ${
                                isApproved
                                  ? "bg-emerald-600"
                                  : isVerified
                                  ? "bg-sky-600"
                                  : isRevision
                                  ? "bg-rose-600"
                                  : "bg-amber-500"
                              }`}
                            >
                              {isApproved ? (
                                <Check className="size-3 stroke-[3]" />
                              ) : isVerified ? (
                                <ShieldCheck className="size-3" />
                              ) : isRevision ? (
                                <AlertTriangle className="size-3" />
                              ) : (
                                <Clock className="size-3" />
                              )}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">
                                    {log.reviewer_name}
                                  </span>
                                  <Badge
                                    className={`text-[9px] font-bold px-2 py-0.5 ${
                                      (log.reviewer_role || "").toUpperCase().includes("MAO")
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : (log.reviewer_role || "").toUpperCase().includes("CBAT")
                                        ? "bg-sky-100 text-sky-800 border-sky-300"
                                        : "bg-indigo-100 text-indigo-800 border-indigo-300"
                                    }`}
                                  >
                                    {log.reviewer_role}
                                  </Badge>
                                  <Badge
                                    className={`text-[9px] font-bold px-2 py-0.5 ${
                                      isApproved
                                        ? "bg-emerald-600 text-white"
                                        : isVerified
                                        ? "bg-sky-600 text-white"
                                        : "bg-rose-600 text-white"
                                    }`}
                                  >
                                    {log.status}
                                  </Badge>
                                </div>
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {formatDateTime(log.reviewed_at)}
                                </span>
                              </div>

                              <p className="text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                                {log.remarks || "No additional remarks attached."}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Herd Membership Changes */}
                  {animal?.herd_membership_history && animal.herd_membership_history.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Herd Group Movements
                      </h5>
                      <div className="space-y-1.5">
                        {animal.herd_membership_history.map((m) => (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800">{m.action_label}: </span>
                              <span className="text-slate-600">
                                {m.previous_batch_code || "None"} → {m.new_batch_code || "None"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDateTime(m.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PHOTOS & VISUAL EVIDENCE */}
              {activeTab === "photos" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Visual Evidence &amp; Ear Tag Photographs ({photos.length})
                  </h4>

                  {photos.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <div className="text-4xl">{avatar.emoji}</div>
                      <p className="text-xs font-bold text-slate-800">No physical photographs uploaded</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        This animal record is identified by digital ear tag #{animal?.tag_number || animal?.id}.
                        Field officers may upload side-profile photos during the next scheduled vaccination drive.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {photos.map((url, i) => (
                        <div
                          key={i}
                          onClick={() => setEnlargedPhoto(url)}
                          className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer shadow-xs hover:border-emerald-500 transition-all"
                        >
                          <Image
                            src={url}
                            alt={`Photo ${i + 1}`}
                            fill
                            unoptimized
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                            <span className="text-white text-[11px] font-bold flex items-center gap-1">
                              <Maximize2 className="size-3" /> Click to enlarge
                            </span>
                          </div>
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/60 text-white backdrop-blur-md">
                            {i === 0 ? "Portrait" : i === 1 ? "Left Profile" : "Right Profile"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. MAO REVIEW ACTION CONSOLE (Always accessible or toggleable) ── */}
              {isReviewOpen && (
                <div className="p-4 rounded-2xl border-2 border-emerald-600/70 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 shadow-md space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-200">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                        <Sparkles className="size-3.5" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        MAO Review Decision Console
                      </span>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                      Official MAO Action
                    </Badge>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      Quick Recommendation Chips
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_APPROVAL_NOTES.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setRemarks(preset)}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-100/80 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-semibold transition-colors text-left"
                        >
                          + {preset}
                        </button>
                      ))}
                      {PRESET_REVISION_NOTES.map((preset, idx) => (
                        <button
                          key={`rev-${idx}`}
                          type="button"
                          onClick={() => setRemarks(preset)}
                          className="text-[10px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-semibold transition-colors text-left"
                        >
                          ! {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {animal?.ownership_certificate_number && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold">Ownership certificate verification</p>
                    <p className="text-xs">Certificate {animal.ownership_certificate_number}. Check the paper against the issuing office's register. A matching number or uploaded image alone does not prove authenticity.</p>
                    {animal.certificate_photo && <a className="text-sm text-emerald-800 underline" href={animal.certificate_photo} target="_blank" rel="noreferrer">View submitted certificate</a>}
                    {animal.certificate_verification?.status === "VERIFIED" && <p className="text-xs text-emerald-800">Verified against {animal.certificate_verification.issuing_office}, reference {animal.certificate_verification.register_reference}.</p>}
                    <label className="block text-xs">Issuing office<input className="mt-1 h-9 w-full rounded border bg-white px-2" value={issuingOffice} onChange={e => setIssuingOffice(e.target.value)} /></label>
                    <label className="block text-xs">Issuing register or confirmation reference<input className="mt-1 h-9 w-full rounded border bg-white px-2" value={registerReference} onChange={e => setRegisterReference(e.target.value)} /></label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={confirmedIssuer} onChange={e => setConfirmedIssuer(e.target.checked)} />I confirmed the owner, animal, and certificate details with the issuing record.</label>
                  </div>}
                  {/* Remarks Textarea */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Official MAO Inspection Remarks:</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {remarks.length} characters
                      </span>
                    </label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter municipal certification remarks, notes on ear tag verification, or revision instructions for the raiser..."
                      className="min-h-[75px] text-xs rounded-xl border-emerald-300 focus-visible:ring-emerald-500 bg-white"
                    />
                  </div>

                  {/* Decision Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        reviewMutation.mutate({
                          status: "SUBJECT_TO_REVISION",
                          reviewRemarks: remarks.trim() || "Subject to field revision and verification.",
                        })
                      }
                      className="w-full sm:w-auto h-9 px-4 rounded-xl text-xs font-bold border-rose-200 bg-rose-50/80 text-rose-800 hover:bg-rose-100 hover:text-rose-900 gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="size-3.5 text-rose-600" />
                      <span>Return for Revision</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        reviewMutation.mutate({
                          status: "APPROVED",
                          reviewRemarks:
                            remarks.trim() ||
                            "Ear tag, biometrics, and CBAT field notes verified for municipal registry.",
                        })
                      }
                      className="w-full sm:w-auto h-9 px-5 rounded-xl text-xs font-bold bg-[#1E4D2B] hover:bg-emerald-800 text-white shadow-xs gap-1.5 cursor-pointer"
                    >
                      {reviewMutation.isPending ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5 stroke-[3]" />
                      )}
                      <span>Approve Animal Record</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── MODAL FOOTER ── */}
        <DialogFooter className="p-3 bg-slate-50 border-t border-slate-200/90 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
            <Tag className="size-3 text-slate-400" />
            <span>Tag: <strong>#{animal?.tag_number || animal?.id}</strong></span>
            <span>•</span>
            <span>Status: <strong>{animal?.status}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold h-8.5 px-4 cursor-pointer"
            >
              Close
            </Button>
          </div>
        </DialogFooter>

        {/* ── ENLARGED PHOTO LIGHTBOX ── */}
        {enlargedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEnlargedPhoto(null)}
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <Image
                src={enlargedPhoto}
                alt="Enlarged photo"
                fill
                unoptimized
                className="object-contain"
              />
              <button
                type="button"
                onClick={() => setEnlargedPhoto(null)}
                className="absolute top-4 right-4 size-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/90 transition-all cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
