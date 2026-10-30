"use client";

import { PageHeader } from "@/app/components/page-header";
import { LivestockBreedField } from "@/components/livestock-breed-field";
import { QrCodePass } from "@/components/qr-code-pass";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
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
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import api from "@/lib/axios";
import { localCalendarDateToday } from "@/lib/livestock-age";
import { livestockBatchQrPayload } from "@/lib/livestock-identity";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
AlertTriangle,
ArrowLeft,
ArrowRight,
Camera,
Check,
CheckCircle2,
ChevronLeft,
ChevronRight,
ChevronsLeft,
ChevronsRight,
ClipboardList,
Clock,
Eye,
ImageIcon,
Layers,
LayoutGrid,
Plus,
QrCode,
RefreshCw,
Scale,
Search,
ShieldCheck,
Table as TableIcon,
Tag,
Trash2,
Users
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import React,{ useEffect,useMemo,useRef,useState } from "react";
import { toast } from "sonner";
import { ManageHerdDialog } from "../components/manage-herd-dialog";
import {
getDefaultAvatarForSpecies,
INVENTORY_QUERY_KEYS,
useLivestockBatches,
} from "../livestock-inventory";

// ── Types for Individual Animals inside a Batch ──────────────────────────────
export interface BatchIndividual {
  id: string;
  tagNumber: string | null;
  sex: string;
  weightKg: number | null;
  lastVaccinationDate: string | null;
  operationalStatus: string;
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "MIXED" | "NO_ANIMALS";
  isPostApprovalAddition?: boolean;
  photoUrl?: string | null;
}

export interface EnrichedBatch {
  id: string;
  batchCode: string;
  batchName: string;
  photoUrl?: string | null;
  photos: string[];
  species: string;
  breed: string | null;
  housingPen?: string;
  feedType?: string;
  activeCount: number;
  targetWeightKg: number | null;
  averageWeightKg: number | null;
  status: string;
  reviewStatus?: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION";
  reviewRemarks?: string;
  notes?: string;
  individuals: BatchIndividual[];
}

type BatchActionErrorResponse = {
  error?: string;
  detail?: string;
  livestock?: string[];
  animals?: string[];
  tag_number?: string[];
};

// Regulatory Review Badge (English, balanced size)
function getReviewStatusBadge(status?: string) {
  if (status === "MIXED") {
    return (
      <Badge
        variant="outline"
        className="min-h-8 border border-slate-300 bg-slate-100 px-2.5 text-xs font-semibold text-slate-800"
      >
        Mixed Status
      </Badge>
    );
  }
  if (status === "NO_ANIMALS") {
    return (
      <Badge
        variant="outline"
        className="min-h-8 border border-slate-300 bg-slate-100 px-2.5 text-xs font-semibold text-slate-700"
      >
        No animals yet
      </Badge>
    );
  }
  if (status === "APPROVED") {
    return (
      <Badge
        variant="outline"
        className="min-h-8 gap-1.5 border border-emerald-400 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-950"
      >
        <ShieldCheck className="size-3.5 text-emerald-700" />
        Approved
      </Badge>
    );
  }
  if (status === "VERIFIED") {
    return (
      <Badge
        variant="outline"
        className="min-h-8 gap-1.5 border border-sky-400 bg-sky-50 px-2.5 text-xs font-bold text-sky-950"
      >
        <CheckCircle2 className="size-3.5 text-sky-700" />
        Field Checked
      </Badge>
    );
  }
  if (status === "SUBJECT_TO_REVISION") {
    return (
      <Badge
        variant="outline"
        className="min-h-8 gap-1.5 border border-amber-400 bg-amber-50 px-2.5 text-xs font-bold text-amber-950"
      >
        <AlertTriangle className="size-3.5 text-amber-700" />
        Revision Needed
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge
        variant="outline"
        className="min-h-8 gap-1.5 border border-rose-400 bg-rose-50 px-2.5 text-xs font-bold text-rose-950"
      >
        <AlertTriangle className="size-3.5 text-rose-700" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="min-h-8 gap-1.5 border border-amber-300 bg-amber-50 px-2.5 text-xs font-bold text-amber-950"
    >
      <Clock className="size-3.5 text-amber-700" />
      Under Review
    </Badge>
  );
}

// ── SPLIT CARD WITH HERO IMAGE COMPONENT (Tastefully Sized) ─────────────────
function HerdSplitCard({
  batch,
  isSelected,
  onSelect,
}: {
  batch: EnrichedBatch;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const avatar = getDefaultAvatarForSpecies(batch.species);
  const photos = batch.photos;
  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[photoIndex % photos.length] : null;

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const readiness =
    batch.averageWeightKg !== null && batch.targetWeightKg
      ? Math.min(
          Math.round((batch.averageWeightKg / batch.targetWeightKg) * 100),
          100
        )
      : null;

  return (
    <Card
      onClick={onSelect}
      className={`group cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 flex flex-col sm:flex-row justify-between ${
        isSelected
          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/30 shadow-md"
          : "border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md"
      }`}
    >
      {/* ── LEFT HERO IMAGE SECTION (Wider, landscape horizontal hero) ── */}
      <div className="relative aspect-[21/9] sm:aspect-auto sm:w-52 md:w-56 lg:w-64 sm:self-stretch min-h-[150px] sm:min-h-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={batch.batchName || "Herd photo"}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-3 text-white">
            <span className="text-4xl drop-shadow-md">{avatar.emoji}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              {batch.species}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom/sides */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        {/* Top Badges */}
        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between gap-1.5 z-10">
          <Badge className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {batch.species}
          </Badge>

          {isSelected && (
            <Badge className="bg-emerald-700 text-white font-bold text-[10px] gap-1 px-1.5 py-0.5 shadow-xs">
              <Check className="size-2.5 stroke-[3]" /> Selected
            </Badge>
          )}
        </div>

        {/* Multiple Pictures Controls (compact chevron buttons) */}
        {photos.length > 1 && (
          <div className="absolute inset-y-0 left-1.5 right-1.5 flex items-center justify-between z-20 pointer-events-none">
            <button
              type="button"
              aria-label="Previous herd picture"
              onClick={handlePrevPhoto}
              className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs"
            >
              <ChevronLeft className="size-3.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              aria-label="Next herd picture"
              onClick={handleNextPhoto}
              className="pointer-events-auto flex size-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs"
            >
              <ChevronRight className="size-3.5 stroke-[2.5]" />
            </button>
          </div>
        )}

        {/* Bottom Hero Overlay: Photo Counter & mobile herd code */}
        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white z-10">
          {photos.length > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md">
              <Camera className="size-3 text-emerald-400" />
              <span>
                {(photoIndex % photos.length) + 1} of {photos.length}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
              <ImageIcon className="size-3" />
              <span>Preset avatar</span>
            </div>
          )}

          <span className="sm:hidden rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-900 shadow-2xs">
            {batch.batchCode}
          </span>
        </div>
      </div>

      {/* ── RIGHT CONTENT SECTION (Horizontal split on sm+) ── */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5 space-y-2 min-w-0">
        <div className="space-y-2">
          {/* Header Row: Title, Herd Code & Regulatory Status Badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-950 group-hover:text-emerald-800 transition-colors line-clamp-1">
                  {batch.batchName || "Unnamed Herd"}
                </h3>
                <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200 shrink-0">
                  {batch.batchCode}
                </span>
              </div>
            </div>

            <div className="shrink-0">{getReviewStatusBadge(batch.reviewStatus)}</div>
          </div>

          {/* Breed & Housing Pen (Dedicated Full-Width Row) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
            <span className="font-medium text-slate-700">{batch.breed || "Breed not recorded"}</span>
            {batch.housingPen && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">
                  {batch.housingPen.toLowerCase().startsWith("pen")
                    ? batch.housingPen
                    : `Pen ${batch.housingPen}`}
                </span>
              </>
            )}
          </div>

          {/* Target Weight Progress (if set) */}
          {readiness !== null ? (
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-950">
                <span>Target Weight Progress</span>
                <span className="font-bold">{readiness}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-emerald-200/60">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] font-medium text-emerald-800">
                <span>Avg: {batch.averageWeightKg || 0} kg</span>
                <span>Target: {batch.targetWeightKg} kg</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-[11px] text-slate-500 font-medium">
              <Scale className="size-3.5 text-slate-400 shrink-0" />
              <span>Target weight not configured</span>
            </div>
          )}

          {/* Quick Metrics Chips */}
          <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold text-slate-700">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[10px] uppercase">Animals in Herd</span>
              <span className="text-slate-950 font-bold text-xs">
                {batch.activeCount} {batch.activeCount === 1 ? "Head" : "Heads"}
              </span>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[10px] uppercase">Avg Weight</span>
              <span className="text-slate-950 font-bold text-xs">
                {batch.averageWeightKg ? `${batch.averageWeightKg} kg` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Picture Counter & Open Details Button */}
        <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {batch.photos.length > 1
              ? `${batch.photos.length} photos`
              : batch.photos.length === 1
                ? "1 photo"
                : "Default avatar"}
          </span>

          <Button
            type="button"
            className={`h-8 px-3 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all ${
              isSelected
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-slate-900 text-white hover:bg-emerald-700"
            }`}
          >
            <span>View Herd Details</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function BatchOverviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const livestockTypeReturn = searchParams?.get("livestockType");
  const livestockReturnUrl = livestockTypeReturn
    ? `/livestock-inventory?livestockType=${encodeURIComponent(livestockTypeReturn)}`
    : "/livestock-inventory";
  const animalIdParam = searchParams?.get("animalId") || "";
  const tagParam = searchParams?.get("tag") || "";

  const {
    data: backendBatches = [],
    error: batchesError,
    isLoading: isBatchesLoading,
    isError: isBatchesError,
    refetch: refetchBatches,
  } = useLivestockBatches();

  const herdLoadStatus =
    typeof batchesError === "object" && batchesError !== null && "response" in batchesError
      ? (batchesError as { response?: { status?: number } }).response?.status
      : undefined;

  const herdLoadMessage =
    herdLoadStatus === 401
      ? "Your session has expired. Sign in again to view your herds."
      : herdLoadStatus === 403
        ? "You do not have permission to view herd records."
        : "Unable to load herd records. Please try again.";

  // Local state for interactive enhancements
  const initialBatchId = searchParams?.get("batch") || "";
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId);
  const [isHerdDetailsOpen, setIsHerdDetailsOpen] = useState(Boolean(initialBatchId));
  const [highlightedAnimalId, setHighlightedAnimalId] = useState<string | null>(null);
  const scrolledAnimalIdRef = useRef<string | null>(null);
  const [modalHeroPhotoIndex, setModalHeroPhotoIndex] = useState(0);

  const [rosterView, setRosterView] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [herdSearchQuery, setHerdSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");

  // Dialog States
  const [isAddIndividualOpen, setIsAddIndividualOpen] = useState(false);
  const [isHerdQrOpen, setIsHerdQrOpen] = useState(false);
  const [isGalleryManagerOpen, setIsGalleryManagerOpen] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [weighTarget, setWeighTarget] = useState<BatchIndividual | null>(null);
  const [newWeightInput, setNewWeightInput] = useState<string>("");
  const [manageHerdTarget, setManageHerdTarget] = useState<BatchIndividual | null>(null);

  // Gallery photo management handlers
  const handleReplacePhoto = async (batchId: string, replaceIndex: number, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file is too large. Maximum size is 5 MB.");
      return;
    }
    const formData = new FormData();
    formData.append("action", "replace_photo");
    formData.append("replace_index", String(replaceIndex));
    formData.append("photo", file);

    const toastId = toast.loading("Updating picture...");
    setIsPhotoUploading(true);
    try {
      await api.patch(`livestock/batches/${batchId}/`, formData);
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
      toast.success(`Photo #${replaceIndex + 1} updated successfully!`, { id: toastId });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data?.error || "Failed to update picture." : "Failed to update picture.";
      toast.error(msg, { id: toastId });
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const handleAddPhoto = async (batchId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file is too large. Maximum size is 5 MB.");
      return;
    }
    const formData = new FormData();
    formData.append("action", "add_photo");
    formData.append("photo", file);

    const toastId = toast.loading("Adding picture to gallery...");
    setIsPhotoUploading(true);
    try {
      const res = await api.patch(`livestock/batches/${batchId}/`, formData);
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
      const newCount = res.data?.photos?.length || 1;
      setModalHeroPhotoIndex(newCount - 1);
      toast.success("Picture added to herd gallery!", { id: toastId });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data?.error || "Failed to add picture." : "Failed to add picture.";
      toast.error(msg, { id: toastId });
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (batchId: string, deleteIndex: number) => {
    const formData = new FormData();
    formData.append("action", "delete_photo");
    formData.append("delete_index", String(deleteIndex));

    const toastId = toast.loading("Removing picture...");
    setIsPhotoUploading(true);
    try {
      await api.patch(`livestock/batches/${batchId}/`, formData);
      await queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEYS.batches });
      setModalHeroPhotoIndex((prev) => Math.max(0, prev - 1));
      toast.success("Picture removed from gallery.", { id: toastId });
    } catch (err: unknown) {
      const msg = isAxiosError(err) ? err.response?.data?.error || "Failed to remove picture." : "Failed to remove picture.";
      toast.error(msg, { id: toastId });
    } finally {
      setIsPhotoUploading(false);
    }
  };

  // Form for adding individual to batch
  const [isSavingAnimal, setIsSavingAnimal] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [newAnimalData, setNewAnimalData] = useState({
    tagNumber: "",
    breed: "",
    sex: "FEMALE",
    weight: "",
    birthDate: "",
    lastVaccinationDate: "",
  });

  // Mapped Persisted Herds with Multi-Photo Aggregation
  const batches: EnrichedBatch[] = useMemo(() => {
    return backendBatches.map((b) => {
      const batchPhoto = b.photoUrl || null;
      const backendPhotos = (Array.isArray(b.photos) && b.photos.length > 0)
        ? b.photos
        : (batchPhoto ? [batchPhoto] : []);

      // Cleanly deduplicate by URL pathname
      const seen = new Set<string>();
      const photos: string[] = [];
      for (const rawUrl of backendPhotos) {
        if (!rawUrl) continue;
        let norm = rawUrl.trim();
        try {
          norm = new URL(norm, "http://localhost").pathname;
        } catch {
          // use rawUrl
        }
        if (!seen.has(norm)) {
          seen.add(norm);
          photos.push(rawUrl);
        }
      }

      return {
        id: String(b.id),
        batchCode: b.batchCode,
        batchName: b.batchName,
        photoUrl: photos[0] || batchPhoto || null,
        photos,
        species: b.livestockTypeName,
        breed: b.animals?.find((animal) => animal.breed)?.breed || null,
        housingPen: b.housingPen,
        feedType: b.feedType,
        activeCount: b.totalAnimals,
        targetWeightKg: b.targetWeight,
        averageWeightKg: b.averageWeight,
        status: b.status,
        reviewStatus: b.reviewStatus,
        reviewRemarks: b.reviewRemarks,
        notes: b.notes,
        individuals: (b.animals || []).map((animal) => ({
          id: String(animal.id),
          tagNumber: animal.tagNumber || null,
          sex: animal.sex || "Not recorded",
          weightKg: animal.weight == null ? null : Number(animal.weight),
          lastVaccinationDate: animal.lastVaccinationDate,
          operationalStatus: animal.operationalStatus,
          reviewStatus: animal.status,
          isPostApprovalAddition: animal.isPostApprovalAddition,
          photoUrl: animal.photoUrl || null,
        })),
      };
    });
  }, [backendBatches]);

  // Overall Statistics for Telemetry Ribbon
  const totalHerdsCount = batches.length;
  const totalAnimalsInHerds = useMemo(
    () => batches.reduce((sum, b) => sum + b.activeCount, 0),
    [batches]
  );
  const approvedHerdsCount = useMemo(
    () => batches.filter((b) => b.reviewStatus === "APPROVED").length,
    [batches]
  );
  const totalWeighedInHerds = useMemo(
    () =>
      batches.reduce(
        (sum, b) =>
          sum +
          b.individuals.filter(
            (i) => i.operationalStatus === "ACTIVE" && i.weightKg !== null
          ).length,
        0
      ),
    [batches]
  );

  // Filtered Herds
  const filteredBatches = useMemo(() => {
    if (!herdSearchQuery.trim()) return batches;
    const query = herdSearchQuery.toLowerCase();
    return batches.filter(
      (b) =>
        b.batchName.toLowerCase().includes(query) ||
        b.batchCode.toLowerCase().includes(query) ||
        b.species.toLowerCase().includes(query) ||
        (b.breed && b.breed.toLowerCase().includes(query))
    );
  }, [batches, herdSearchQuery]);

  // ── Pagination State for Herd Directory ──
  const HERDS_PER_PAGE = 6;
  const [herdCurrentPage, setHerdCurrentPage] = useState(1);
  const totalHerdPages = Math.max(1, Math.ceil(filteredBatches.length / HERDS_PER_PAGE));
  const safeHerdPage = Math.min(herdCurrentPage, totalHerdPages);

  const paginatedBatches = useMemo(() => {
    const startIndex = (safeHerdPage - 1) * HERDS_PER_PAGE;
    return filteredBatches.slice(startIndex, startIndex + HERDS_PER_PAGE);
  }, [filteredBatches, safeHerdPage]);

  // Active selected batch
  const currentBatch = useMemo(() => {
    if (!batches || batches.length === 0) return null;
    const found = batches.find((b) => b.id === selectedBatchId);
    return found || batches[0];
  }, [batches, selectedBatchId]);

  const handleBatchSelect = (batchId: string) => {
    setSelectedBatchId(batchId);
    setHighlightedAnimalId(null);
    scrolledAnimalIdRef.current = null;
    setModalHeroPhotoIndex(0);
    setAnimalCurrentPage(1);
    setIsHerdDetailsOpen(true);
  };

  const canAddAnimalsToCurrentBatch = currentBatch?.status === "ACTIVE";

  const individualReviewSummary = currentBatch?.individuals.reduce(
    (summary, animal) => {
      const status = (animal.reviewStatus || "PENDING").toUpperCase();
      if (status === "APPROVED") summary.approved += 1;
      else if (status === "VERIFIED") summary.awaitingMao += 1;
      else if (
        status === "SUBJECT_TO_REVISION" ||
        status === "SUBJECT_FOR_REVISION"
      )
        summary.returned += 1;
      else if (status === "REJECTED") summary.rejected += 1;
      else summary.awaitingSibat += 1;
      return summary;
    },
    { approved: 0, awaitingMao: 0, awaitingSibat: 0, returned: 0, rejected: 0 }
  );

  // Filter individuals inside current batch
  const filteredIndividuals = useMemo(() => {
    if (!currentBatch) return [];
    return currentBatch.individuals.filter((animal) => {
      const isRequestedAnimal = currentBatch.id === initialBatchId && (
        (animalIdParam && animal.id === animalIdParam) ||
        (tagParam && animal.tagNumber?.trim().toLowerCase() === tagParam.trim().toLowerCase())
      );
      if (animal.operationalStatus !== "ACTIVE" && !isRequestedAnimal) return false;
      const matchSearch =
        (animal.tagNumber || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        animal.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchGender =
        genderFilter === "ALL" ||
        animal.sex.toUpperCase() === genderFilter.toUpperCase();
      return isRequestedAnimal || (matchSearch && matchGender);
    });
  }, [currentBatch, initialBatchId, searchQuery, genderFilter, animalIdParam, tagParam]);

  // ── Pagination State for Animal Roster inside Modal ──
  const ANIMALS_PER_PAGE = 8;
  const [animalCurrentPage, setAnimalCurrentPage] = useState(1);
  const totalAnimalPages = Math.max(1, Math.ceil(filteredIndividuals.length / ANIMALS_PER_PAGE));
  const safeAnimalPage = Math.min(animalCurrentPage, totalAnimalPages);

  const paginatedIndividuals = useMemo(() => {
    const startIndex = (safeAnimalPage - 1) * ANIMALS_PER_PAGE;
    return filteredIndividuals.slice(startIndex, startIndex + ANIMALS_PER_PAGE);
  }, [filteredIndividuals, safeAnimalPage]);

  // Deep links from an animal profile open its herd and select that animal in the roster.
  // The router's query parameters select an external record, so reflect them in the visible roster.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (
      !isHerdDetailsOpen ||
      !currentBatch ||
      currentBatch.id !== initialBatchId ||
      (!animalIdParam && !tagParam)
    ) {
      return;
    }

    const targetIndex = filteredIndividuals.findIndex((animal) => {
      if (animalIdParam && animal.id === animalIdParam) return true;
      return Boolean(
        tagParam &&
          animal.tagNumber?.trim().toLowerCase() === tagParam.trim().toLowerCase()
      );
    });
    if (targetIndex < 0) return;

    const target = filteredIndividuals[targetIndex];
    scrolledAnimalIdRef.current = null;
    setHighlightedAnimalId(target.id);
    setAnimalCurrentPage(Math.floor(targetIndex / ANIMALS_PER_PAGE) + 1);
  }, [
    isHerdDetailsOpen,
    currentBatch,
    initialBatchId,
    animalIdParam,
    tagParam,
    filteredIndividuals,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!highlightedAnimalId || scrolledAnimalIdRef.current === highlightedAnimalId) return;
    const timeout = window.setTimeout(() => {
      const target =
        document.getElementById(`animal-card-${highlightedAnimalId}`) ||
        document.getElementById(`animal-row-${highlightedAnimalId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      scrolledAnimalIdRef.current = highlightedAnimalId;
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [highlightedAnimalId, animalCurrentPage, paginatedIndividuals]);

  // Calculations for Batch Yield
  const yieldMetrics = useMemo(() => {
    if (!currentBatch)
      return { totalBiomass: null, readinessPct: null, weighedAnimalCount: 0 };
    const weighedActiveAnimals = currentBatch.individuals.filter(
      (animal) =>
        animal.operationalStatus === "ACTIVE" && animal.weightKg !== null
    );
    const totalBiomass =
      weighedActiveAnimals.length > 0
        ? Math.round(
            weighedActiveAnimals.reduce(
              (acc, animal) => acc + (animal.weightKg || 0),
              0
            ) * 10
          ) / 10
        : null;

    const readinessPct =
      currentBatch.averageWeightKg !== null && currentBatch.targetWeightKg
        ? Math.min(
            Math.round(
              (currentBatch.averageWeightKg / currentBatch.targetWeightKg) * 100
            ),
            100
          )
        : null;

    return {
      totalBiomass,
      readinessPct,
      weighedAnimalCount: weighedActiveAnimals.length,
    };
  }, [currentBatch]);

  // Handlers
  const handleOpenWeighModal = (animal: BatchIndividual) => {
    setWeighTarget(animal);
    setNewWeightInput(animal.weightKg === null ? "" : String(animal.weightKg));
    setIsWeighModalOpen(true);
  };

  const handleSaveWeight = async () => {
    if (!weighTarget || !currentBatch) return;
    const weightNum = parseFloat(newWeightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      toast.error("Please enter a valid weight in kilograms (e.g. 65.5).");
      return;
    }

    setIsSavingWeight(true);
    try {
      await api.post("production/weights/", {
        livestock: Number(weighTarget.id),
        weight: weightNum,
        weighing_date: new Date().toISOString().split("T")[0],
      });
      await queryClient.invalidateQueries({ queryKey: ["weight_records"] });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.inventory,
      });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.batches,
      });
      toast.success(
        `Weight recorded for ${weighTarget.tagNumber || "animal"}: ${weightNum} kg`
      );
      setIsWeighModalOpen(false);
    } catch (error: unknown) {
      const response = isAxiosError<BatchActionErrorResponse>(error)
        ? error.response?.data
        : undefined;
      toast.error(
        response?.livestock?.[0] ||
          response?.detail ||
          "Could not record weight. Please try again."
      );
    } finally {
      setIsSavingWeight(false);
    }
  };

  const handleAddIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBatch) return;

    if (!newAnimalData.tagNumber.trim()) {
      toast.error("Ear Tag Number is required.");
      return;
    }
    if (!newAnimalData.breed.trim()) {
      toast.error("Breed is required.");
      return;
    }

    setIsSavingAnimal(true);
    try {
      await api.post(`livestock/batches/${currentBatch.id}/animals/`, {
        animals: [
          {
            tag_number: newAnimalData.tagNumber.trim().toUpperCase(),
            breed: newAnimalData.breed.trim(),
            sex: newAnimalData.sex,
            weight: newAnimalData.weight || null,
            birth_date: newAnimalData.birthDate || null,
            last_vaccination_date: newAnimalData.lastVaccinationDate || null,
          },
        ],
      });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.batches,
      });
      await queryClient.invalidateQueries({
        queryKey: INVENTORY_QUERY_KEYS.inventory,
      });
      toast.success(
        `Animal (${newAnimalData.tagNumber.trim().toUpperCase()}) added to herd ${currentBatch.batchName || currentBatch.batchCode}.`
      );
      setIsAddIndividualOpen(false);
      setNewAnimalData({
        tagNumber: "",
        breed: "",
        sex: "FEMALE",
        weight: "",
        birthDate: "",
        lastVaccinationDate: "",
      });
    } catch (error: unknown) {
      const response = isAxiosError<BatchActionErrorResponse>(error)
        ? error.response?.data
        : undefined;
      toast.error(
        response?.error ||
          response?.detail ||
          response?.animals?.[0] ||
          response?.tag_number?.[0] ||
          "Could not add animal to this herd."
      );
    } finally {
      setIsSavingAnimal(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My Herds & Batches"
        subtitle="Monitor herd growth, weight gains, and individual animal records in each cohort."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="w-full px-3.5 pt-4 sm:px-6">
        <Link href={livestockReturnUrl} className="inline-flex">
          <Button
            variant="outline"
            className="h-9 gap-1.5 rounded-lg border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5" />
            Back to Inventory
          </Button>
        </Link>
      </div>

      <div className="mx-auto w-full space-y-4 sm:space-y-5 p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out motion-reduce:animate-none">
        {/* ── 1. COMPACT HERO BANNER ───────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-3.5 sm:p-4.5 text-white shadow-md">
          <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-teal-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
                  <Layers className="mr-1 size-3 text-emerald-400" />
                  Herd Management
                </Badge>
                <span className="text-xs font-semibold text-emerald-200">
                  • {totalHerdsCount} {totalHerdsCount === 1 ? "herd" : "herds"} recorded
                </span>
              </div>

              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Herd & Cohort Directory
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm font-medium leading-relaxed text-emerald-100/90">
                  Easily track group growth, target weight progress, and view individual animal pictures and records.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ── 2. COMPACT TELEMETRY RIBBON ──────────────────────────────────── */}
        <section
          aria-label="Herd telemetry summary"
          className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
        >
          {/* Card 1: Total Herds */}
          <Card className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Herds
              </span>
              <div className="flex size-7 sm:size-7.5 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <Layers className="size-3.5" />
              </div>
            </div>
            <p className="mt-1 text-lg sm:text-xl font-black text-slate-950">
              {totalHerdsCount}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
              {totalHerdsCount === 1 ? "Active group" : "Active groups"}
            </p>
          </Card>

          {/* Card 2: Total Animals in Herds */}
          <Card className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Animals
              </span>
              <div className="flex size-7 sm:size-7.5 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                <Users className="size-3.5" />
              </div>
            </div>
            <p className="mt-1 text-lg sm:text-xl font-black text-emerald-900">
              {totalAnimalsInHerds}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
              Active animals in herds
            </p>
          </Card>

          {/* Card 3: Approved Herds */}
          <Card className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Approved by MAO
              </span>
              <div className="flex size-7 sm:size-7.5 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                <ShieldCheck className="size-3.5" />
              </div>
            </div>
            <p className="mt-1 text-lg sm:text-xl font-black text-sky-950">
              {approvedHerdsCount}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
              Officially certified
            </p>
          </Card>

          {/* Card 4: Weighed Animals */}
          <Card className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Weighed Animals
              </span>
              <div className="flex size-7 sm:size-7.5 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                <Scale className="size-3.5" />
              </div>
            </div>
            <p className="mt-1 text-lg sm:text-xl font-black text-amber-950">
              {totalWeighedInHerds}
            </p>
            <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500">
              With recorded weight
            </p>
          </Card>
        </section>

        {/* ── 3. HERD LISTING SECTION (SPLIT CARD WITH HERO IMAGE LAYOUT) ──── */}
        <section aria-labelledby="herd-list-title" className="space-y-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="herd-list-title"
                className="text-base sm:text-lg font-bold tracking-tight text-slate-950"
              >
                Select a Herd
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">
                Browse herd photo galleries, target weights, and click any card to inspect its full animal roster.
              </p>
            </div>

            {/* Quick Search for Herds */}
            {batches.length > 2 && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search herds by name or code..."
                  value={herdSearchQuery}
                  onChange={(e) => {
                    setHerdSearchQuery(e.target.value);
                    setHerdCurrentPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-300 pl-8 text-xs font-medium"
                />
              </div>
            )}
          </div>

          {/* Loading / Error States */}
          {isBatchesLoading && (
            <Card className="rounded-xl border border-slate-200 p-5 text-center">
              <RefreshCw className="mx-auto size-5 animate-spin text-emerald-700" />
              <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-700">
                Loading your livestock herds...
              </p>
            </Card>
          )}

          {!isBatchesLoading && isBatchesError && (
            <Card className="rounded-xl border border-rose-300 bg-rose-50/70 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 shrink-0 text-rose-600" />
                <div>
                  <h3 className="text-sm font-bold text-rose-950">Unable to load herd records</h3>
                  <p className="mt-0.5 text-xs text-rose-900">{herdLoadMessage}</p>
                  {herdLoadStatus === 401 ? (
                    <Button
                      type="button"
                      onClick={() => router.push("/login")}
                      className="mt-2.5 h-9 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800"
                    >
                      Sign In Again
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refetchBatches()}
                      className="mt-2.5 h-9 rounded-lg border border-rose-400 px-4 text-xs font-bold text-rose-900 hover:bg-rose-100"
                    >
                      <RefreshCw className="mr-1.5 size-3.5" /> Try Again
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {!isBatchesLoading && !isBatchesError && batches.length === 0 && (
            <Card className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 sm:p-8 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
                🐄
              </div>
              <h3 className="mt-2.5 text-base font-bold text-slate-900">
                No Herds Recorded Yet
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-600">
                Once herds or batches are registered in your Livestock Inventory, they will appear here along with their individual animal records.
              </p>
              <div className="mt-3.5">
                <Link href="/livestock-inventory">
                  <Button className="h-9 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800">
                    Go to Livestock Inventory
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* ── SPLIT CARDS WITH HERO IMAGE GRID (Wider 2-col landscape cards) ── */}
          <div className="grid min-w-0 grid-cols-1 gap-3.5 md:grid-cols-2">
            {paginatedBatches.map((batch) => (
              <HerdSplitCard
                key={batch.id}
                batch={batch}
                isSelected={currentBatch?.id === batch.id}
                onSelect={() => handleBatchSelect(batch.id)}
              />
            ))}
          </div>

          {/* ── HERD DIRECTORY PAGINATION BAR ── */}
          {filteredBatches.length > HERDS_PER_PAGE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-600 font-medium">
                Showing <strong className="text-slate-950 font-bold">{(safeHerdPage - 1) * HERDS_PER_PAGE + 1}</strong> to{" "}
                <strong className="text-slate-950 font-bold">
                  {Math.min(safeHerdPage * HERDS_PER_PAGE, filteredBatches.length)}
                </strong> of <strong className="text-slate-950 font-bold">{filteredBatches.length}</strong> herds
              </p>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHerdCurrentPage(1)}
                  disabled={safeHerdPage === 1}
                  className="h-8 px-2 rounded-lg border-slate-200 text-xs font-bold disabled:opacity-30"
                  title="First page"
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHerdCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeHerdPage === 1}
                  className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Prev</span>
                </Button>

                {/* Page number buttons */}
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalHerdPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalHerdPages || Math.abs(p - safeHerdPage) <= 1)
                    .map((p, idx, arr) => {
                      const prev = arr[idx - 1];
                      const showEllipsis = prev && p - prev > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="text-xs text-slate-400 px-0.5">...</span>}
                          <button
                            type="button"
                            onClick={() => setHerdCurrentPage(p)}
                            className={`size-8 rounded-lg text-xs font-bold transition-all ${
                              p === safeHerdPage
                                ? "bg-emerald-700 text-white shadow-2xs"
                                : "text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHerdCurrentPage((p) => Math.min(totalHerdPages, p + 1))}
                  disabled={safeHerdPage === totalHerdPages}
                  className="h-8 px-2.5 rounded-lg border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
                >
                  <span>Next</span>
                  <ChevronRight className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHerdCurrentPage(totalHerdPages)}
                  disabled={safeHerdPage === totalHerdPages}
                  className="h-8 px-2 rounded-lg border-slate-200 text-xs font-bold disabled:opacity-30"
                  title="Last page"
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* ── 4. HERD DETAILS MODAL (WITH HERO GALLERY) ────────────────────── */}
        <Dialog open={isHerdDetailsOpen} onOpenChange={setIsHerdDetailsOpen}>
          {currentBatch && (
            <DialogContent className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-slate-200 bg-slate-50 p-0 shadow-2xl sm:h-[90dvh] sm:max-h-[90dvh] sm:w-[95vw] sm:max-w-5xl lg:max-w-6xl sm:rounded-2xl">
              {/* Sticky Header with high contrast */}
              <DialogHeader className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 pr-12 text-left sm:px-6 sm:py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-bold text-[10px] uppercase">
                    Herd Record
                  </Badge>
                  <span className="font-mono text-[11px] font-semibold text-slate-500">
                    ID: {currentBatch.batchCode}
                  </span>
                </div>
                <DialogTitle className="mt-0.5 text-base sm:text-xl font-bold text-slate-950 truncate">
                  {currentBatch.batchName || "Herd Details"}
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm font-medium text-slate-600">
                  {currentBatch.species} · {currentBatch.breed || "Breed not recorded"} · {currentBatch.activeCount} active animals
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable Modal Body */}
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-4">
                {/* ── HERO IMAGE GALLERY BANNER IN MODAL ── */}
                <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                  {/* Hero Picture */}
                  <div className="relative h-40 sm:h-52 w-full overflow-hidden bg-slate-900 group">
                    {currentBatch.photos.length > 0 ? (
                      <Image
                        src={currentBatch.photos[modalHeroPhotoIndex % currentBatch.photos.length]}
                        alt={currentBatch.batchName || "Herd banner"}
                        fill
                        unoptimized
                        className="object-cover transition-transform duration-300 group-hover:scale-102"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white">
                        <span className="text-4xl">
                          {getDefaultAvatarForSpecies(currentBatch.species).emoji}
                        </span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Cycle arrows directly on hero image if multiple pictures */}
                    {currentBatch.photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="Previous photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalHeroPhotoIndex((prev) => (prev === 0 ? currentBatch.photos.length - 1 : prev - 1));
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center shadow-md backdrop-blur-xs transition-colors"
                        >
                          <ChevronLeft className="size-4.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Next photo"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalHeroPhotoIndex((prev) => (prev + 1) % currentBatch.photos.length);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center shadow-md backdrop-blur-xs transition-colors"
                        >
                          <ChevronRight className="size-4.5" />
                        </button>
                      </>
                    )}

                    {/* Top Right Quick Actions: Change this specific picture or delete */}
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                      {currentBatch.photos.length > 0 ? (
                        <>
                          <label
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-black/65 hover:bg-black/85 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-md cursor-pointer transition-all"
                            title={`Change photo #${(modalHeroPhotoIndex % currentBatch.photos.length) + 1}`}
                          >
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={isPhotoUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleReplacePhoto(
                                    currentBatch.id,
                                    modalHeroPhotoIndex % currentBatch.photos.length,
                                    file
                                  );
                                  e.target.value = "";
                                }
                              }}
                            />
                            <Camera className="size-3.5 text-emerald-400" />
                            <span>Change this photo</span>
                          </label>

                          {currentBatch.photos.length > 1 && (
                            <button
                              type="button"
                              disabled={isPhotoUploading}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Remove this photo from the herd gallery?")) {
                                  void handleDeletePhoto(
                                    currentBatch.id,
                                    modalHeroPhotoIndex % currentBatch.photos.length
                                  );
                                }
                              }}
                              className="inline-flex items-center justify-center size-8 rounded-lg bg-black/65 hover:bg-rose-600/90 text-white backdrop-blur-md border border-white/20 shadow-md transition-all"
                              title="Delete this photo"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <label
                          className="inline-flex items-center justify-center size-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition-all"
                          title="Upload a photo for this herd"
                          aria-label="Upload a photo for this herd"
                        >
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={isPhotoUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void handleAddPhoto(currentBatch.id, file);
                                e.target.value = "";
                              }
                            }}
                          />
                          <Camera className="size-4" />
                        </label>
                      )}
                    </div>

                    <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between text-white pointer-events-none">
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold drop-shadow-md">
                          {currentBatch.batchName || "Unnamed Herd"}
                        </h2>
                        <p className="text-xs font-semibold text-emerald-200 drop-shadow-sm">
                          {currentBatch.species} · {currentBatch.breed || "Breed not recorded"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {currentBatch.photos.length > 1 && (
                          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-md">
                            📷 {(modalHeroPhotoIndex % currentBatch.photos.length) + 1} of{" "}
                            {currentBatch.photos.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail Row with Per-Picture Change & Add Button */}
                  <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase text-slate-500 mr-1 shrink-0">
                      Gallery ({currentBatch.photos.length}):
                    </span>
                    {currentBatch.photos.map((photo, idx) => {
                      const isSelected = idx === (modalHeroPhotoIndex % currentBatch.photos.length);
                      return (
                        <div key={photo + idx} className="relative group shrink-0">
                          <button
                            type="button"
                            onClick={() => setModalHeroPhotoIndex(idx)}
                            className={`relative size-12 overflow-hidden rounded-lg border-2 transition-all block ${
                              isSelected
                                ? "border-emerald-600 ring-2 ring-emerald-500/40 scale-105 shadow-xs"
                                : "border-slate-200 opacity-75 hover:opacity-100"
                            }`}
                            title={`View photo ${idx + 1}`}
                          >
                            <Image src={photo} alt="" fill unoptimized className="object-cover" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[9px] font-bold text-center leading-tight">
                              #{idx + 1}
                            </span>
                          </button>

                          <label
                            className="absolute -top-1 -right-1 size-5 bg-white border border-slate-300 rounded-full shadow-xs flex items-center justify-center cursor-pointer hover:bg-emerald-50 hover:border-emerald-500 transition-colors opacity-0 group-hover:opacity-100 z-10"
                            title={`Change photo #${idx + 1}`}
                          >
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              disabled={isPhotoUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleReplacePhoto(currentBatch.id, idx, file);
                                  e.target.value = "";
                                }
                              }}
                            />
                            <Camera className="size-2.5 text-slate-700" />
                          </label>
                        </div>
                      );
                    })}

                    {/* Add Photo Button */}
                    <label
                      className="relative size-12 shrink-0 rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/60 flex flex-col items-center justify-center cursor-pointer transition-all text-slate-400 hover:text-emerald-700 group"
                      title="Upload another picture to this herd's gallery"
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isPhotoUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleAddPhoto(currentBatch.id, file);
                            e.target.value = "";
                          }
                        }}
                      />
                      <Plus className="size-4 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] font-bold mt-0.5">Add</span>
                    </label>
                  </div>

                  {/* Action Bar */}
                  <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="min-h-7 px-2 text-[11px] font-semibold">
                        {currentBatch.status === "ACTIVE"
                          ? "Active Herd"
                          : currentBatch.status || "Status not recorded"}
                      </Badge>
                      {getReviewStatusBadge(currentBatch.reviewStatus)}
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsHerdQrOpen(true)}
                        className="h-9 sm:h-8.5 gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 w-full sm:w-auto"
                      >
                        <QrCode className="size-3.5 text-emerald-700" /> QR Code
                      </Button>

                      {backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsGalleryManagerOpen(true)}
                          className="h-9 sm:h-8.5 gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-900 shadow-2xs w-full sm:w-auto"
                        >
                          <ImageIcon className="size-3.5 text-emerald-700" /> Photo Gallery ({currentBatch.photos.length})
                        </Button>
                      )}

                      {backendBatches.some((batch) => String(batch.id) === currentBatch.id) && (
                        <Button
                          type="button"
                          onClick={() => setIsAddIndividualOpen(true)}
                          disabled={!canAddAnimalsToCurrentBatch}
                          className="col-span-2 sm:col-span-1 h-9 sm:h-8.5 gap-1.5 rounded-lg bg-emerald-700 px-3.5 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs disabled:bg-slate-300 w-full sm:w-auto"
                        >
                          <Plus className="size-3.5 stroke-[3]" /> Add Animal
                        </Button>
                      )}
                    </div>
                  </div>

                  {currentBatch.reviewRemarks && (
                    <div className="mx-3 mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                      <p className="text-xs font-bold text-amber-950">
                        Official Review Remarks:
                      </p>
                      <p className="mt-0.5 text-xs font-medium leading-relaxed text-amber-900">
                        {currentBatch.reviewRemarks}
                      </p>
                    </div>
                  )}
                </Card>

                {/* ── 4 METRIC TILES ── */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Card className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Active Animals
                    </span>
                    <p className="mt-0.5 text-lg sm:text-xl font-black text-slate-950">
                      {currentBatch.activeCount}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      In this herd
                    </p>
                  </Card>

                  <Card className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Average Weight
                    </span>
                    <p className="mt-0.5 text-lg sm:text-xl font-black text-slate-950">
                      {currentBatch.averageWeightKg === null ? (
                        <span className="text-slate-400 text-sm font-semibold">Not recorded</span>
                      ) : (
                        <>
                          {currentBatch.averageWeightKg} <span className="text-xs font-semibold text-slate-500">kg</span>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Target: {currentBatch.targetWeightKg == null ? "Not recorded" : `${currentBatch.targetWeightKg} kg`}
                    </p>
                  </Card>

                  <Card className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total Biomass
                    </span>
                    <p className="mt-0.5 text-lg sm:text-xl font-black text-emerald-900">
                      {yieldMetrics.totalBiomass === null ? (
                        <span className="text-slate-400 text-sm font-semibold">Not recorded</span>
                      ) : (
                        <>
                          {yieldMetrics.totalBiomass} <span className="text-xs font-semibold text-slate-500">kg</span>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      From {yieldMetrics.weighedAnimalCount} weighed
                    </p>
                  </Card>

                  <Card className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Target Readiness
                    </span>
                    <p className="mt-0.5 text-lg sm:text-xl font-black text-slate-950">
                      {yieldMetrics.readinessPct === null ? (
                        <span className="text-slate-400 text-sm font-semibold">—</span>
                      ) : (
                        `${yieldMetrics.readinessPct}%`
                      )}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{ width: `${yieldMetrics.readinessPct ?? 0}%` }}
                      />
                    </div>
                  </Card>
                </div>

                {/* Animal Review Progress Breakdown */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5">
                  <div className="mb-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-950">
                      Validation Status Breakdown
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-500">
                      Review progress of individual animals inside this herd.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      {
                        label: "Approved",
                        count: individualReviewSummary?.approved ?? 0,
                        color: "bg-emerald-600",
                        text: "text-emerald-950",
                        border: "border-emerald-300",
                      },
                      {
                        label: "Field Checked",
                        count: individualReviewSummary?.awaitingSibat ?? 0,
                        color: "bg-sky-600",
                        text: "text-sky-950",
                        border: "border-sky-300",
                      },
                      {
                        label: "MAO Review",
                        count: individualReviewSummary?.awaitingMao ?? 0,
                        color: "bg-amber-600",
                        text: "text-amber-950",
                        border: "border-amber-300",
                      },
                      {
                        label: "Revision",
                        count: individualReviewSummary?.returned ?? 0,
                        color: "bg-orange-600",
                        text: "text-orange-950",
                        border: "border-orange-300",
                      },
                      {
                        label: "Rejected",
                        count: individualReviewSummary?.rejected ?? 0,
                        color: "bg-rose-600",
                        text: "text-rose-950",
                        border: "border-rose-300",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex min-h-13 items-start gap-1.5 rounded-lg border ${item.border} bg-white p-2 shadow-2xs`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-1 size-2 shrink-0 rounded-full ${item.color}`}
                        />
                        <div className="min-w-0">
                          <p className={`text-base sm:text-lg font-bold tabular-nums leading-none ${item.text}`}>
                            {item.count}
                          </p>
                          <p className="mt-0.5 text-[10px] font-semibold leading-tight text-slate-600">
                            {item.label}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Notes */}
                {currentBatch.notes && (
                  <Card className="rounded-lg border border-slate-200 bg-white shadow-2xs">
                    <CardHeader className="p-2.5 pb-1">
                      <CardTitle className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                        <ClipboardList className="size-3.5 text-emerald-700" />
                        Herd Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2.5 pt-0">
                      <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-700">
                        {currentBatch.notes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* ── INDIVIDUAL ROSTER CARD ───────────────────────────────── */}
                <Card className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                  <CardHeader className="flex flex-col gap-2.5 border-b border-slate-100 p-3 sm:p-3.5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm sm:text-base font-bold text-slate-950">
                          Animals in this Herd
                        </CardTitle>
                        <Badge className="bg-emerald-100 text-emerald-950 border-emerald-300 font-semibold text-[11px] px-2 py-0.5">
                          {filteredIndividuals.length} animals
                        </Badge>
                      </div>
                      <CardDescription className="mt-0.5 text-[11px] text-slate-500">
                        Search by Ear Tag number or filter by sex.
                      </CardDescription>
                    </div>

                    {/* View Controls & Filters */}
                    <div className="flex flex-col gap-2 w-full lg:w-auto sm:flex-row sm:items-center">
                      <div
                        role="group"
                        aria-label="Roster view switcher"
                        className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5"
                      >
                        <Button
                          type="button"
                          variant={rosterView === "cards" ? "default" : "ghost"}
                          onClick={() => setRosterView("cards")}
                          className={`h-8 gap-1.5 rounded-md text-xs font-semibold ${
                            rosterView === "cards"
                              ? "bg-white text-emerald-950 shadow-2xs border border-slate-200"
                              : "text-slate-700 hover:text-slate-950"
                          }`}
                        >
                          <LayoutGrid className="size-3 text-emerald-700" /> Cards
                        </Button>
                        <Button
                          type="button"
                          variant={rosterView === "table" ? "default" : "ghost"}
                          onClick={() => setRosterView("table")}
                          className={`h-8 gap-1.5 rounded-md text-xs font-semibold ${
                            rosterView === "table"
                              ? "bg-white text-emerald-950 shadow-2xs border border-slate-200"
                              : "text-slate-700 hover:text-slate-950"
                          }`}
                        >
                          <TableIcon className="size-3 text-teal-700" /> Table
                        </Button>
                      </div>

                      <div className="relative flex-1 sm:w-52">
                        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                        <Input
                          placeholder="Search tag or ID..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setAnimalCurrentPage(1);
                          }}
                          className="h-8 rounded-lg border border-slate-300 pl-8 text-xs font-medium"
                        />
                      </div>

                      <div className="w-full sm:w-32">
                        <Select
                          value={genderFilter}
                          onValueChange={(val) => {
                            setGenderFilter(val);
                            setAnimalCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-8 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900">
                            <SelectValue placeholder="All Sexes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Sexes</SelectItem>
                            <SelectItem value="FEMALE">Female</SelectItem>
                            <SelectItem value="MALE">Male</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    {/* ── CARDS VIEW ── */}
                    {rosterView === "cards" && (
                      <div className="p-3 sm:p-3.5 space-y-2.5">
                        {filteredIndividuals.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-xs font-medium text-slate-500">
                            No animals match your search filters.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                            {paginatedIndividuals.map((animal) => {
                              const hasInventoryRecord = /^\d+$/.test(animal.id);
                              const isTargetAnimal = highlightedAnimalId === animal.id;
                              const reviewColor =
                                animal.reviewStatus === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                                  : animal.reviewStatus === "VERIFIED"
                                    ? "bg-sky-100 text-sky-950 border-sky-300"
                                    : animal.reviewStatus === "REJECTED"
                                      ? "bg-rose-100 text-rose-950 border-rose-300"
                                      : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                        ? "bg-amber-100 text-amber-950 border-amber-300"
                                        : "bg-slate-100 text-slate-800 border-slate-300";

                              const reviewLabel =
                                animal.reviewStatus === "APPROVED"
                                  ? "Approved"
                                  : animal.reviewStatus === "VERIFIED"
                                    ? "Field Checked"
                                    : animal.reviewStatus === "REJECTED"
                                      ? "Rejected"
                                      : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                        ? "Revision Needed"
                                        : "Pending";

                              return (
                                <div
                                  key={animal.id}
                                  id={`animal-card-${animal.id}`}
                                  aria-current={isTargetAnimal ? "true" : undefined}
                                  className={`rounded-xl border bg-white p-3 shadow-2xs transition-all hover:border-emerald-300 ${
                                    isTargetAnimal
                                      ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500 shadow-md"
                                      : "border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      {hasInventoryRecord ? (
                                        <Link
                                          href={`/livestock-inventory/${animal.id}`}
                                          className="flex items-center gap-1.5 text-sm font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                                        >
                                          <Tag className="size-3.5 text-emerald-600 shrink-0" />
                                          <span className="break-all">{animal.tagNumber || "No Tag #"}</span>
                                        </Link>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                                          <Tag className="size-3.5 text-slate-400 shrink-0" />
                                          <span className="break-all">{animal.tagNumber || "No Tag #"}</span>
                                        </div>
                                      )}
                                      {animal.isPostApprovalAddition && (
                                        <span className="mt-0.5 inline-block text-[10px] font-semibold text-indigo-700">
                                          New Animal · Reviewed Separately
                                        </span>
                                      )}
                                    </div>

                                    <Badge
                                      variant="secondary"
                                      className={`min-h-6 shrink-0 px-2 text-[10px] font-bold uppercase ${
                                        animal.sex.toUpperCase() === "FEMALE"
                                          ? "bg-rose-100 text-rose-900 border-rose-300"
                                          : animal.sex.toUpperCase() === "MALE"
                                            ? "bg-blue-100 text-blue-900 border-blue-300"
                                            : "bg-slate-100 text-slate-800 border-slate-300"
                                      }`}
                                    >
                                      {animal.sex}
                                    </Badge>
                                  </div>
                                  {isTargetAnimal && (
                                    <Badge className="mt-2 border-emerald-300 bg-emerald-100 text-[10px] font-bold text-emerald-950">
                                      Selected animal
                                    </Badge>
                                  )}

                                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-xs">
                                    <div>
                                      <span className="block text-[10px] font-semibold text-slate-500 uppercase">
                                        Weight
                                      </span>
                                      <span className="text-xs font-bold text-slate-950">
                                        {animal.weightKg === null ? (
                                          <span className="text-rose-700">Not recorded</span>
                                        ) : (
                                          `${animal.weightKg} kg`
                                        )}
                                      </span>
                                    </div>

                                    <div>
                                      <span className="block text-[10px] font-semibold text-slate-500 uppercase">
                                        Last Vaccination
                                      </span>
                                      <span className="text-[11px] font-medium text-slate-900">
                                        {animal.lastVaccinationDate || (
                                          <span className="text-slate-400">None recorded</span>
                                        )}
                                      </span>
                                    </div>

                                    <div className="col-span-2 mt-0.5 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                                        Review:
                                      </span>
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold border ${reviewColor}`}
                                      >
                                        <span className="size-1.5 rounded-full bg-current" />
                                        {reviewLabel}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-2.5 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                                    {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && (
                                      <Button
                                        onClick={() => handleOpenWeighModal(animal)}
                                        variant="outline"
                                        className="h-8 flex-1 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-950 hover:bg-emerald-100"
                                      >
                                        <Scale className="mr-1.5 size-3.5 text-emerald-700" />
                                        Record Weight
                                      </Button>
                                    )}

                                    {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && (
                                      <Button
                                        onClick={() => setManageHerdTarget(animal)}
                                        variant="outline"
                                        className="h-8 flex-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 hover:bg-slate-50"
                                        title="Move to another herd or remove from this herd"
                                      >
                                        <Layers className="mr-1.5 size-3.5 text-emerald-700" />
                                        Move / Remove
                                      </Button>
                                    )}

                                    {hasInventoryRecord ? (
                                      <Link href={`/livestock-inventory/${animal.id}`} className="flex-1">
                                        <Button
                                          variant="ghost"
                                          className="h-8 w-full rounded-lg bg-slate-100 text-xs font-bold text-slate-900 hover:bg-slate-200"
                                        >
                                          <Eye className="mr-1.5 size-3.5 text-slate-600" />
                                          View Profile
                                        </Button>
                                      </Link>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        disabled
                                        className="h-8 flex-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-500"
                                      >
                                        No Profile
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TABLE VIEW ── */}
                    {rosterView === "table" && (
                      <div className="overflow-x-auto">
                        <Table className="min-w-[760px]">
                          <TableHeader className="bg-slate-50 border-b border-slate-200">
                            <TableRow>
                              <TableHead className="py-2 text-xs font-bold text-slate-800">
                                Ear Tag / ID
                              </TableHead>
                              <TableHead className="py-2 text-xs font-bold text-slate-800">
                                Sex
                              </TableHead>
                              <TableHead className="py-2 text-xs font-bold text-slate-800">
                                Weight
                              </TableHead>
                              <TableHead className="py-2 text-xs font-bold text-slate-800">
                                Last Vaccination
                              </TableHead>
                              <TableHead className="py-2 text-xs font-bold text-slate-800">
                                Review Status
                              </TableHead>
                              <TableHead className="py-2 pr-3.5 text-right text-xs font-bold text-slate-800">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredIndividuals.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="py-6 text-center text-xs font-medium text-slate-500"
                                >
                                  No animals match the current filters.
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginatedIndividuals.map((animal) => {
                                const hasInventoryRecord = /^\d+$/.test(animal.id);
                                const isTargetAnimal = highlightedAnimalId === animal.id;
                                return (
                                  <TableRow
                                    key={animal.id}
                                    id={`animal-row-${animal.id}`}
                                    aria-current={isTargetAnimal ? "true" : undefined}
                                    onClick={(event) => {
                                      const target = event.target as HTMLElement;
                                      if (hasInventoryRecord && !target.closest("a, button")) {
                                        router.push(`/livestock-inventory/${animal.id}`);
                                      }
                                    }}
                                    className={`transition-colors hover:bg-emerald-50/40 ${
                                      hasInventoryRecord ? "cursor-pointer" : ""
                                    } ${
                                      isTargetAnimal ? "bg-emerald-100 ring-2 ring-inset ring-emerald-500" : ""
                                    }`}
                                  >
                                    <TableCell className="py-2 text-xs font-bold text-slate-950">
                                      {hasInventoryRecord ? (
                                        <Link
                                          href={`/livestock-inventory/${animal.id}`}
                                          className="flex items-center gap-1.5 text-emerald-800 hover:text-emerald-950 hover:underline"
                                        >
                                          <Tag className="size-3 text-emerald-600" />
                                          <span>{animal.tagNumber || "No Tag #"}</span>
                                          {isTargetAnimal && (
                                            <Badge className="ml-1 border-emerald-300 bg-emerald-100 px-1.5 py-0 text-[9px] text-emerald-950">
                                              Selected
                                            </Badge>
                                          )}
                                        </Link>
                                      ) : (
                                        <span className="flex items-center gap-1.5 text-slate-500">
                                          <Tag className="size-3 text-slate-400" />
                                          <span>{animal.tagNumber || "No Tag #"}</span>
                                        </span>
                                      )}
                                    </TableCell>

                                    <TableCell className="py-2">
                                      <Badge
                                        variant="secondary"
                                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                          animal.sex.toUpperCase() === "FEMALE"
                                            ? "bg-rose-100 text-rose-900 border-rose-300"
                                            : animal.sex.toUpperCase() === "MALE"
                                              ? "bg-blue-100 text-blue-900 border-blue-300"
                                              : "bg-slate-100 text-slate-800 border-slate-300"
                                        }`}
                                      >
                                        {animal.sex}
                                      </Badge>
                                    </TableCell>

                                    <TableCell className="py-2 text-xs font-bold text-slate-950">
                                      {animal.weightKg === null ? (
                                        <span className="text-rose-700 text-[11px]">Not recorded</span>
                                      ) : (
                                        `${animal.weightKg} kg`
                                      )}
                                    </TableCell>

                                    <TableCell className="py-2 text-xs font-medium text-slate-700">
                                      {animal.lastVaccinationDate || (
                                        <span className="text-slate-400">Not recorded</span>
                                      )}
                                    </TableCell>

                                    <TableCell className="py-2">
                                      <span
                                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold border ${
                                          animal.reviewStatus === "APPROVED"
                                            ? "bg-emerald-100 text-emerald-950 border-emerald-300"
                                            : animal.reviewStatus === "VERIFIED"
                                              ? "bg-sky-100 text-sky-950 border-sky-300"
                                              : animal.reviewStatus === "REJECTED"
                                                ? "bg-rose-100 text-rose-950 border-rose-300"
                                                : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                                  ? "bg-amber-100 text-amber-950 border-amber-300"
                                                  : "bg-slate-100 text-slate-800 border-slate-300"
                                        }`}
                                      >
                                        <span className="size-1.5 rounded-full bg-current" />
                                        {animal.reviewStatus === "APPROVED"
                                          ? "Approved"
                                          : animal.reviewStatus === "VERIFIED"
                                            ? "Field Checked"
                                            : animal.reviewStatus === "REJECTED"
                                              ? "Rejected"
                                              : animal.reviewStatus === "SUBJECT_TO_REVISION"
                                                ? "Revision Needed"
                                                : "Pending"}
                                      </span>
                                    </TableCell>

                                    <TableCell className="py-2 text-right pr-3.5">
                                      <div className="inline-flex items-center gap-1">
                                        {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && (
                                          <Button
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              handleOpenWeighModal(animal);
                                            }}
                                            variant="outline"
                                            className="h-7 px-2 text-xs rounded-md font-bold border border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                                          >
                                            <Scale className="size-3 mr-1 text-emerald-700" />
                                            Record Weight
                                          </Button>
                                        )}

                                        {animal.operationalStatus === "ACTIVE" && hasInventoryRecord && (
                                          <Button
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setManageHerdTarget(animal);
                                            }}
                                            variant="outline"
                                            className="h-7 px-2 text-xs rounded-md font-bold border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                                            title="Move to another herd or remove from this herd"
                                          >
                                            <Layers className="size-3 mr-1 text-emerald-700" />
                                            Move / Remove
                                          </Button>
                                        )}

                                        {hasInventoryRecord && (
                                          <Link
                                            href={`/livestock-inventory/${animal.id}`}
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <Button
                                              variant="ghost"
                                              className="h-7 px-2 text-xs rounded-md font-semibold text-slate-800 hover:bg-slate-100"
                                            >
                                              <Eye className="size-3 mr-1 text-slate-600" />
                                              View
                                            </Button>
                                          </Link>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* ── ANIMAL ROSTER PAGINATION BAR ── */}
                    {filteredIndividuals.length > ANIMALS_PER_PAGE && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-slate-200 bg-slate-50/70 p-2.5 sm:px-3.5">
                        <p className="text-[11px] text-slate-600 font-medium">
                          Showing <strong className="text-slate-950 font-bold">{(safeAnimalPage - 1) * ANIMALS_PER_PAGE + 1}</strong> to{" "}
                          <strong className="text-slate-950 font-bold">
                            {Math.min(safeAnimalPage * ANIMALS_PER_PAGE, filteredIndividuals.length)}
                          </strong> of <strong className="text-slate-950 font-bold">{filteredIndividuals.length}</strong> animals
                        </p>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAnimalCurrentPage(1)}
                            disabled={safeAnimalPage === 1}
                            className="h-7 px-1.5 rounded-md border-slate-200 text-xs font-bold disabled:opacity-30"
                            title="First page"
                          >
                            <ChevronsLeft className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAnimalCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={safeAnimalPage === 1}
                            className="h-7 px-2 rounded-md border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
                          >
                            <ChevronLeft className="size-3" />
                            <span>Prev</span>
                          </Button>

                          {/* Page numbers */}
                          <div className="flex items-center gap-1 px-0.5">
                            {Array.from({ length: totalAnimalPages }, (_, i) => i + 1)
                              .filter((p) => p === 1 || p === totalAnimalPages || Math.abs(p - safeAnimalPage) <= 1)
                              .map((p, idx, arr) => {
                                const prev = arr[idx - 1];
                                const showEllipsis = prev && p - prev > 1;
                                return (
                                  <React.Fragment key={p}>
                                    {showEllipsis && <span className="text-xs text-slate-400 px-0.5">...</span>}
                                    <button
                                      type="button"
                                      onClick={() => setAnimalCurrentPage(p)}
                                      className={`size-7 rounded-md text-xs font-bold transition-all ${
                                        p === safeAnimalPage
                                          ? "bg-emerald-700 text-white shadow-2xs"
                                          : "text-slate-700 hover:bg-slate-100 border border-slate-200"
                                      }`}
                                    >
                                      {p}
                                    </button>
                                  </React.Fragment>
                                );
                              })}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAnimalCurrentPage((p) => Math.min(totalAnimalPages, p + 1))}
                            disabled={safeAnimalPage === totalAnimalPages}
                            className="h-7 px-2 rounded-md border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
                          >
                            <span>Next</span>
                            <ChevronRight className="size-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAnimalCurrentPage(totalAnimalPages)}
                            disabled={safeAnimalPage === totalAnimalPages}
                            className="h-7 px-1.5 rounded-md border-slate-200 text-xs font-bold disabled:opacity-30"
                            title="Last page"
                          >
                            <ChevronsRight className="size-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>

      {/* ── DIALOG: HERD QR CODE ──────────────────────────────────────────── */}
      <Dialog open={isHerdQrOpen} onOpenChange={setIsHerdQrOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl bg-white p-3.5 sm:p-4.5 shadow-xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-slate-950">
              <QrCode className="size-4.5 text-emerald-700" />
              <span>Official Herd QR Code</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium leading-relaxed text-slate-600">
              Scan this QR code to quickly look up the official record for {currentBatch?.batchName || "this herd"}.
            </DialogDescription>
          </DialogHeader>
          {currentBatch && (
            <div className="py-1.5">
              <QrCodePass
                code={currentBatch.batchCode || currentBatch.id}
                qrPayload={livestockBatchQrPayload(currentBatch.id)}
                title={currentBatch.batchName || "Livestock herd"}
                subtitle="Canonical herd identity"
                specie={currentBatch.species}
                headCount={currentBatch.activeCount}
                status={currentBatch.status}
                compact
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: RECORD WEIGHT ─────────────────────────────────────────── */}
      <Dialog open={isWeighModalOpen} onOpenChange={setIsWeighModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4.5 shadow-xl sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-slate-950">
              <Scale className="size-4.5 text-emerald-700" />
              <span>Record Animal Weight</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-medium leading-relaxed text-slate-600">
              Enter the new weight in kilograms (kg) for animal tag{" "}
              <strong className="font-bold text-slate-950">{weighTarget?.tagNumber || "this animal"}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-1.5">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
              <span className="font-semibold text-slate-600">Previous Weight:</span>
              <span
                className={`font-bold ${
                  weighTarget?.weightKg == null ? "text-rose-700" : "text-slate-950"
                }`}
              >
                {weighTarget?.weightKg == null ? "Not recorded" : `${weighTarget.weightKg} kg`}
              </span>
            </div>

            <div className="space-y-1">
              <Label
                htmlFor="new-herd-animal-weight"
                className="text-xs font-bold text-slate-800"
              >
                New Weight (in kilograms / kg)
              </Label>
              <Input
                id="new-herd-animal-weight"
                type="number"
                step="0.1"
                min="0.1"
                value={newWeightInput}
                onChange={(e) => setNewWeightInput(e.target.value)}
                placeholder="e.g. 72.5"
                className="h-9 rounded-lg border border-slate-300 text-sm font-bold text-slate-950 focus:border-emerald-600"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsWeighModalOpen(false)}
              className="h-8.5 flex-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveWeight}
              disabled={isSavingWeight}
              className="h-8.5 flex-1 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs"
            >
              {isSavingWeight ? "Saving..." : "Save Weight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: ADD ANIMAL TO BATCH ───────────────────────────────────── */}
      <Dialog open={isAddIndividualOpen} onOpenChange={setIsAddIndividualOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl bg-white p-3.5 sm:p-4.5 shadow-xl sm:max-h-[90dvh] sm:max-w-sm">
          <form onSubmit={handleAddIndividual} className="space-y-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-slate-950">
                <Plus className="size-4.5 text-emerald-700" />
                <span>Add Animal to Herd</span>
              </DialogTitle>
              <DialogDescription className="text-xs font-medium leading-relaxed text-slate-600">
                Add an individual animal to herd{" "}
                <strong className="text-slate-950">{currentBatch?.batchName || "this herd"}</strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2.5 py-1 text-xs sm:grid-cols-2">
              {/* Tag Number */}
              <div className="space-y-1 sm:col-span-2">
                <Label
                  htmlFor="new-herd-animal-tag"
                  className="text-xs font-bold text-slate-800"
                >
                  Ear Tag Number <span className="text-rose-600">*</span>
                </Label>
                <Input
                  id="new-herd-animal-tag"
                  value={newAnimalData.tagNumber}
                  onChange={(e) =>
                    setNewAnimalData({ ...newAnimalData, tagNumber: e.target.value })
                  }
                  placeholder="e.g. TAG-001"
                  className="h-8.5 rounded-lg border border-slate-300 text-xs font-bold uppercase"
                  required
                />
              </div>

              {/* Sex */}
              <div className="space-y-1">
                <Label
                  htmlFor="new-herd-animal-sex"
                  className="text-xs font-bold text-slate-800"
                >
                  Sex <span className="text-rose-600">*</span>
                </Label>
                <Select
                  value={newAnimalData.sex}
                  onValueChange={(sex) => setNewAnimalData({ ...newAnimalData, sex })}
                >
                  <SelectTrigger
                    id="new-herd-animal-sex"
                    className="h-8.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Breed */}
              <LivestockBreedField
                id="batch-animal-breed"
                species={currentBatch?.species}
                value={newAnimalData.breed}
                onChange={(breed) => setNewAnimalData({ ...newAnimalData, breed })}
                required
                className="text-xs font-semibold"
              />

              {/* Weight */}
              <div className="space-y-1">
                <Label
                  htmlFor="new-herd-animal-weight-optional"
                  className="text-xs font-semibold text-slate-700"
                >
                  Weight in kg (optional)
                </Label>
                <Input
                  id="new-herd-animal-weight-optional"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={newAnimalData.weight}
                  onChange={(e) =>
                    setNewAnimalData({ ...newAnimalData, weight: e.target.value })
                  }
                  placeholder="e.g. 65"
                  className="h-8.5 rounded-lg border border-slate-300 text-xs font-medium"
                />
              </div>

              {/* Birth Date */}
              <div className="space-y-1">
                <Label
                  htmlFor="new-herd-animal-birth-date"
                  className="text-xs font-semibold text-slate-700"
                >
                  Birth Date (optional)
                </Label>
                <Input
                  id="new-herd-animal-birth-date"
                  type="date"
                  max={localCalendarDateToday()}
                  value={newAnimalData.birthDate}
                  onChange={(e) =>
                    setNewAnimalData({ ...newAnimalData, birthDate: e.target.value })
                  }
                  className="h-8.5 w-full rounded-lg border border-slate-300 text-xs font-medium"
                />
              </div>

              {/* Vaccination Date */}
              <div className="space-y-1 sm:col-span-2">
                <Label
                  htmlFor="new-herd-animal-vaccination-date"
                  className="text-xs font-semibold text-slate-700"
                >
                  Last Vaccination Date (optional)
                </Label>
                <Input
                  id="new-herd-animal-vaccination-date"
                  type="date"
                  max={localCalendarDateToday()}
                  value={newAnimalData.lastVaccinationDate}
                  onChange={(e) =>
                    setNewAnimalData({
                      ...newAnimalData,
                      lastVaccinationDate: e.target.value,
                    })
                  }
                  className="h-8.5 w-full rounded-lg border border-slate-300 text-xs font-medium"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddIndividualOpen(false)}
                className="h-8.5 flex-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingAnimal}
                className="h-8.5 flex-1 rounded-lg bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 shadow-2xs"
              >
                {isSavingAnimal ? "Saving..." : "Save Animal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── PHOTO GALLERY MANAGER MODAL ── */}
      {currentBatch && (
        <Dialog open={isGalleryManagerOpen} onOpenChange={setIsGalleryManagerOpen}>
          <DialogContent className="max-w-2xl rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ImageIcon className="size-5 text-emerald-700" />
                Herd Photo Gallery
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Manage all pictures for <strong>{currentBatch.batchName}</strong> ({currentBatch.batchCode}). You can change individual pictures, remove unwanted shots, or upload new views of the herd and pen.
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {currentBatch.photos.map((photo, idx) => (
                  <div key={photo + idx} className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shadow-xs flex flex-col">
                    <div className="relative aspect-[16/10] w-full overflow-hidden">
                      <Image src={photo} alt="" fill unoptimized className="object-cover" />
                      <div className="absolute top-2 left-2">
                        <Badge className={`text-[10px] font-bold ${idx === 0 ? "bg-emerald-600 text-white" : "bg-black/70 text-white backdrop-blur-xs"}`}>
                          {idx === 0 ? "Cover Photo" : `Photo #${idx + 1}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2 bg-white flex items-center justify-between gap-1.5 border-t border-slate-100">
                      <label className="flex-1 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={isPhotoUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleReplacePhoto(currentBatch.id, idx, file);
                              e.target.value = "";
                            }
                          }}
                        />
                        <Camera className="size-3 text-emerald-700" />
                        <span>Change</span>
                      </label>

                      {currentBatch.photos.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPhotoUploading}
                          onClick={() => {
                            if (confirm(`Remove Photo #${idx + 1} from this herd?`)) {
                              void handleDeletePhoto(currentBatch.id, idx);
                            }
                          }}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove photo"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Upload New Card */}
                <label className="relative aspect-[16/10] rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/50 flex flex-col items-center justify-center cursor-pointer p-4 text-center transition-all group">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={isPhotoUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleAddPhoto(currentBatch.id, file);
                        e.target.value = "";
                      }
                    }}
                  />
                  <div className="size-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-110 transition-transform mb-1.5">
                    <Plus className="size-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-800">Add Picture</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP up to 5MB</span>
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGalleryManagerOpen(false)} className="rounded-xl">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ManageHerdDialog
        open={Boolean(manageHerdTarget)}
        onOpenChange={(open) => {
          if (!open) setManageHerdTarget(null);
        }}
        item={
          manageHerdTarget && currentBatch
            ? {
                id: Number(manageHerdTarget.id),
                tagNumber: manageHerdTarget.tagNumber || undefined,
                livestockTypeName: currentBatch.species,
                breed: currentBatch.breed || undefined,
                sex: manageHerdTarget.sex,
                operationalStatus: manageHerdTarget.operationalStatus,
                batchId: Number(currentBatch.id),
                batchCode: currentBatch.batchCode,
                batchName: currentBatch.batchName,
              }
            : null
        }
      />
    </>
  );
}
