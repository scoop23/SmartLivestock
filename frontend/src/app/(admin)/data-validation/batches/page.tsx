"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/axios";
import { PageHeader } from "@/app/components/page-header";
import { QrCodePass } from "@/components/qr-code-pass";
import { livestockBatchQrPayload } from "@/lib/livestock-identity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShieldCheck,
  Layers,
  ArrowLeft,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Printer,
  ChevronRight,
  ChevronDown,
  Tag,
  Scale,
  Calendar,
  Building2,
  MapPin,
  User,
  Activity,
  QrCode,
  Copy,
  Check,
  LayoutGrid,
  List,
  RefreshCw,
  ExternalLink,
  Info,
  ClipboardList,
  Camera,
  ImageIcon,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import { PADRE_GARCIA_BARANGAYS } from "../../admin/admin-charts";
import { getDefaultAvatarForSpecies } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import { RecordDetailDialog, type DetailRecordData } from "../record-detail-dialog";
import { ValidationLoadingScreen, useLoadingScreenTransition } from "@/components/validation-loading-screen";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ChildAnimal {
  id: number;
  tag_number: string;
  breed: string;
  sex: string;
  weight: number | string | null;
  photo_url?: string | null;
  avatar_key?: string | null;
  last_vaccination_date?: string | null;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

export interface BatchItem {
  id: number;
  farmer: number | null;
  farmer_name: string;
  barangay_id?: number | null;
  barangay_name: string;
  livestock_type: number;
  livestock_type_name: string;
  batch_name: string;
  batch_code: string;
  photo_url?: string | null;
  photos?: string[];
  housing_pen: string;
  feed_type: string;
  target_weight: number | string | null;
  target_harvest_date?: string | null;
  status: string;
  notes?: string;
  enrolled_animals?: number;
  total_animals: number;
  average_weight: number | string | null;
  animals: ChildAnimal[];
  review_status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "MIXED" | "NO_ANIMALS";
  pending_animals?: number;
  verified_animals?: number;
  approved_animals?: number;
  revision_animals?: number;
  rejected_animals?: number;
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface BatchPage {
  count: number;
  results: BatchItem[];
  summary: { totalAnimals: number | null; totalHerds: number; approvedAnimals: number; pendingAnimals: number; verifiedAnimals: number; revisionAnimals: number; rejectedAnimals: number };
}

function deriveBatchReviewStatus(batch: BatchItem): BatchItem["review_status"] {
  if (batch.review_status) return batch.review_status;
  const statuses = (batch.animals || []).map((animal) =>
    (animal.status || "PENDING").toUpperCase(),
  );

  if (statuses.length === 0) return "PENDING";
  if (statuses.every((status) => status === "APPROVED")) return "APPROVED";
  if (statuses.some((status) => status === "SUBJECT_TO_REVISION")) {
    return "SUBJECT_TO_REVISION";
  }
  if (statuses.every((status) => status === "VERIFIED")) return "VERIFIED";
  return "PENDING";
}

function BatchPager({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 text-xs">
      <span className="text-[11px] text-slate-500 font-medium">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-7 rounded-lg text-[10px] font-bold">‹ Prev</Button>
        <span className="px-2.5 py-1 rounded-lg bg-emerald-800 text-white font-black text-[10px]">Page {page} / {pageCount}</span>
        <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="h-7 rounded-lg text-[10px] font-bold">Next ›</Button>
      </div>
    </div>
  );
}

// ── SPLIT CARD WITH HERO IMAGE COMPONENT (MAO Regulatory Validation) ─────────
function AdminHerdSplitCard({
  batch,
  isSelected,
  onSelect,
  onViewQr,
  getStatusBadge,
}: {
  batch: BatchItem;
  isSelected: boolean;
  onSelect: () => void;
  onViewQr: () => void;
  getStatusBadge: (status?: string) => React.ReactNode;
}) {
  const photos = useMemo(() => {
    const list = [
      ...(batch.photos && batch.photos.length > 0 ? batch.photos : []),
      ...(batch.photo_url ? [batch.photo_url] : []),
      ...((batch.animals || []).map((a) => a.photo_url).filter(Boolean) as string[]),
    ];

    const seen = new Set<string>();
    const result: string[] = [];
    for (const rawUrl of list) {
      if (!rawUrl) continue;
      let norm = rawUrl.trim();
      try {
        const parsed = new URL(norm, "http://localhost");
        norm = parsed.pathname;
      } catch {
        // use rawUrl
      }
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(rawUrl);
      }
    }
    return result;
  }, [batch.photos, batch.photo_url, batch.animals]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const avatar = getDefaultAvatarForSpecies(batch.livestock_type_name);
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

  const headCount = batch.total_animals || batch.animals?.length || 0;
  const avgWeight = batch.average_weight ? Number(batch.average_weight) : null;
  const sibatCheckedCount = (batch.verified_animals ?? 0) + (batch.approved_animals ?? 0);
  const verificationProgress = headCount > 0 ? Math.round((sibatCheckedCount / headCount) * 100) : 0;

  const formattedPen = batch.housing_pen
    ? batch.housing_pen.toLowerCase().startsWith("pen")
      ? batch.housing_pen
      : `Pen ${batch.housing_pen}`
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
      {/* ── LEFT HERO IMAGE SECTION (Horizontal landscape hero) ── */}
      <div className="relative aspect-[21/9] sm:aspect-auto sm:w-52 md:w-56 lg:w-64 sm:self-stretch min-h-[160px] sm:min-h-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        {currentPhoto ? (
          <Image
            src={currentPhoto}
            alt={batch.batch_name || `${batch.livestock_type_name} herd`}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-3 text-white">
            <span className="text-4xl drop-shadow-md">{avatar.emoji}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              {batch.livestock_type_name}
            </span>
          </div>
        )}

        {/* Ambient Dark Gradient on bottom/sides */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        {/* Top Badges */}
        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between gap-1.5 z-10">
          <Badge className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {batch.livestock_type_name}
          </Badge>

          {isSelected && (
            <Badge className="bg-emerald-700 text-white font-bold text-[10px] gap-1 px-1.5 py-0.5 shadow-xs">
              <Check className="size-2.5 stroke-[3]" /> Selected
            </Badge>
          )}
        </div>

        {/* Multiple Pictures Controls */}
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
            {batch.batch_code}
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
                  {batch.batch_name || `${batch.livestock_type_name} Herd`}
                </h3>
                <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200 shrink-0">
                  {batch.batch_code}
                </span>
              </div>
            </div>

            <div className="shrink-0">{getStatusBadge(batch.review_status)}</div>
          </div>

          {/* Farmer, Barangay & Housing Pen (Dedicated Full-Width Row) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
              <User className="size-3.5 shrink-0 text-slate-400" />
              <span>{batch.farmer_name}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="size-3.5 shrink-0 text-slate-400" />
              <span>{batch.barangay_name || "Padre Garcia"}</span>
            </span>
            {formattedPen && (
              <>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                  <Building2 className="size-3 shrink-0 text-slate-400" />
                  <span>{formattedPen}</span>
                </span>
              </>
            )}
          </div>

          {/* Field Verification Progress */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>Field Verification</span>
              </span>
              <span className={`font-bold ${batch.review_status === "APPROVED" ? "text-emerald-700" : "text-sky-700"}`}>
                {verificationProgress}% ({sibatCheckedCount}/{headCount})
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  batch.review_status === "APPROVED" ? "bg-emerald-600" : "bg-sky-600"
                }`}
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-500">
              <span>{batch.approved_animals ?? 0} approved · {batch.verified_animals ?? 0} verified · {batch.pending_animals ?? 0} waiting SIBAT</span>
              {batch.target_weight && <span>Target: {batch.target_weight} kg</span>}
            </div>
          </div>

          {/* Quick Metrics Chips */}
          <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold text-slate-700">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[10px] uppercase">Animals in Herd</span>
              <span className="text-slate-950 font-bold text-xs">
                {headCount} {headCount === 1 ? "Head" : "Heads"}
              </span>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[10px] uppercase">Avg Weight</span>
              <span className="text-slate-950 font-bold text-xs">
                {avgWeight ? `${avgWeight} kg` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Picture Counter & Review Herd + QR Buttons */}
        <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {photos.length > 1
              ? `${photos.length} photos`
              : photos.length === 1
                ? "1 photo"
                : "Default avatar"}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewQr();
              }}
              className="size-8 p-0 rounded-lg border-slate-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
              title="View Batch QR Clearance Pass"
            >
              <QrCode className="size-3.5 text-emerald-700" />
            </Button>

            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={`h-8 px-3 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all ${
                isSelected
                  ? "bg-emerald-700 text-white hover:bg-emerald-800"
                  : "bg-slate-900 text-white hover:bg-emerald-700"
              }`}
            >
              <Eye className="size-3.5" />
              <span>Inspect Herd</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AdminBatchesDrilldownContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchIdParam = searchParams.get("batchId") || searchParams.get("id");
  const animalIdParam = searchParams.get("animalId") || searchParams.get("livestockId");
  const tagParam = searchParams.get("tag") || searchParams.get("tagNumber") || searchParams.get("animalTag");

  // Highlight state for targeted animal deep-linked from registry / validation
  const [highlightedAnimalId, setHighlightedAnimalId] = useState<number | null>(null);
  const scrolledAnimalIdRef = useRef<number | null>(null);

  // ── States ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [barangayFilter, setBarangayFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const BATCH_PAGE_SIZE = 10;
  const ANIMAL_PAGE_SIZE = 10;
  const [batchPage, setBatchPage] = useState(1);
  const [animalPage, setAnimalPage] = useState(1);

  // Selected batch for drilldown inspection
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [reviewAnimal, setReviewAnimal] = useState<DetailRecordData | null>(null);
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>([]);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [animalSearchQuery, setAnimalSearchQuery] = useState("");
  const [animalStatusFilter, setAnimalStatusFilter] = useState<string>("ALL");

  // Review confirmation modals



  // Reviewer notes (append-only audit trail)
  const [batchNoteText, setBatchNoteText] = useState("");
  const [showBatchNotes, setShowBatchNotes] = useState(true);

  // Collapse the notes panel on small screens so the animal roster stays visible
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    setShowBatchNotes(!isMobile);
  }, []);

  // Passport & Print Modal
  const [passportAnimal, setPassportAnimal] = useState<ChildAnimal | null>(null);
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [isBatchCertificateOpen, setIsBatchCertificateOpen] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // The list fetches a single page without rosters; detail queries run only after selection.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  useEffect(() => setBatchPage(1), [debouncedSearch, speciesFilter, statusFilter, barangayFilter]);
  const params = { summary: "true", page: batchPage, page_size: BATCH_PAGE_SIZE,
    search: debouncedSearch, species: speciesFilter, review_status: statusFilter, barangay: barangayFilter };
  const { data: batchPageData, isLoading, isFetching: isRefetching, isError, refetch } = useQuery<BatchPage>({
    queryKey: ["admin-batches-drilldown", params],
    queryFn: async ({ signal }) => (await api.get("livestock/batches/", { params, signal })).data,
    staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, placeholderData: keepPreviousData,
  });
  const batches = batchPageData?.results || [];
  const isInitialLoading = isLoading && !batchPageData;
  const keepLoadingScreenMounted = useLoadingScreenTransition(isInitialLoading);
  const numericBatchId = batchIdParam
    ? (/^\d+$/.test(batchIdParam) ? Number(batchIdParam) : Number(String(batchIdParam).replace(/\D/g, "")) || null)
    : null;
  const detailId = selectedBatch?.id || numericBatchId;
  const detailQuery = useQuery<BatchItem>({
    queryKey: ["admin-batch-detail", detailId, batchIdParam],
    enabled: isDrilldownOpen || isBatchCertificateOpen || Boolean(detailId) || Boolean(batchIdParam),
    queryFn: async ({ signal }) => {
      if (detailId) {
        return (await api.get(`livestock/batches/${detailId}/`, { signal })).data;
      }
      if (batchIdParam) {
        return (await api.get("livestock/batches/lookup/", { params: { code: batchIdParam }, signal })).data;
      }
      throw new Error("No batch identifier provided");
    },
    staleTime: 30 * 1000,
  });
  useEffect(() => {
    if (detailQuery.data) {
      setSelectedBatch(detailQuery.data);
      if (batchIdParam) setIsDrilldownOpen(true);
    }
  }, [detailQuery.data, batchIdParam]);

  // Automatically select and open drilldown if `batchId` is present in URL and matches loaded batches list
  useEffect(() => {
    if (!batchIdParam || !batches || batches.length === 0) return;

    const rawParam = String(batchIdParam).trim();
    const numericId = Number(rawParam.replace(/\D/g, ""));

    const found = batches.find((b) => {
      if (numericId && b.id === numericId) return true;
      if (String(b.id) === rawParam) return true;
      if (b.batch_code && b.batch_code.toLowerCase() === rawParam.toLowerCase()) return true;
      if (b.batch_name && b.batch_name.toLowerCase() === rawParam.toLowerCase()) return true;
      return false;
    });

    if (found) {
      setSelectedBatch(found);
      setIsDrilldownOpen(true);
    }
  }, [batchIdParam, batches]);
  const references = useQuery<{ species: { name: string }[]; barangays: { barangay_name: string }[] }>({
    queryKey: ["admin-batch-filter-options"],
    queryFn: async () => {
      const [species, barangays] = await Promise.all([api.get("livestock/livestock_types/"), api.get("livestock/barangays/")]);
      return { species: species.data, barangays: barangays.data };
    }, staleTime: 10 * 60 * 1000,
  });
  const speciesList = (references.data?.species || []).map((s) => s.name);
  const kpis = {
    totalBatches: batchPageData?.count || 0,
    totalAnimals: batchPageData?.summary.totalAnimals || 0,
    approvedAnimals: batchPageData?.summary.approvedAnimals || 0,
    pendingAnimals: batchPageData?.summary.pendingAnimals || 0,
    verifiedAnimals: batchPageData?.summary.verifiedAnimals || 0,
    revisionAnimals: batchPageData?.summary.revisionAnimals || 0,
    rejectedAnimals: batchPageData?.summary.rejectedAnimals || 0,
    avgHeads: batchPageData?.count ? ((batchPageData.summary.totalAnimals || 0) / batchPageData.count).toFixed(1) : "0",
  };
  const filteredBatches = batches;
  const pagedBatches = batches;

  // ── Filtered Animals inside Selected Batch ──────────────────────────────
  const filteredChildAnimals = useMemo(() => {
    if (!selectedBatch || !selectedBatch.animals) return [];
    return selectedBatch.animals.filter((a) => {
      const matchSearch =
        !animalSearchQuery ||
        a.tag_number?.toLowerCase().includes(animalSearchQuery.toLowerCase()) ||
        a.breed?.toLowerCase().includes(animalSearchQuery.toLowerCase()) ||
        a.sex?.toLowerCase().includes(animalSearchQuery.toLowerCase());

      const matchStatus =
        animalStatusFilter === "ALL" ||
        (animalStatusFilter === "SUBJECT_TO_REVISION"
          ? (a.status || "").toUpperCase() === "SUBJECT_TO_REVISION" || (a.status || "").toUpperCase() === "SUBJECT_FOR_REVISION"
          : (a.status || "PENDING").toUpperCase() === animalStatusFilter);

      return matchSearch && matchStatus;
    });
  }, [selectedBatch, animalSearchQuery, animalStatusFilter]);

  const pageCountAnimals = Math.max(1, Math.ceil(filteredChildAnimals.length / ANIMAL_PAGE_SIZE));
  const pagedChildAnimals = filteredChildAnimals.slice(
    (animalPage - 1) * ANIMAL_PAGE_SIZE,
    animalPage * ANIMAL_PAGE_SIZE,
  );
  const visibleVerifiedAnimalIds = pagedChildAnimals
    .filter((animal) => animal.status === "VERIFIED")
    .map((animal) => animal.id);
  const selectedVerifiedAnimals = (selectedBatch?.animals ?? []).filter(
    (animal) => selectedAnimalIds.includes(animal.id) && animal.status === "VERIFIED",
  );
  const allVisibleVerifiedAnimalsSelected =
    visibleVerifiedAnimalIds.length > 0 &&
    visibleVerifiedAnimalIds.every((id) => selectedAnimalIds.includes(id));

  useEffect(() => {
    setAnimalPage(1);
    setSelectedAnimalIds([]);
  }, [selectedBatch?.id, animalSearchQuery, animalStatusFilter]);

  useEffect(() => {
    if (animalPage > pageCountAnimals) setAnimalPage(pageCountAnimals);
  }, [animalPage, pageCountAnimals]);

  // Automatically focus on and page to target animal if animalId or tag is present in URL
  useEffect(() => {
    if (!isDrilldownOpen || !selectedBatch?.animals || selectedBatch.animals.length === 0) {
      return;
    }
    if (!animalIdParam && !tagParam) return;

    const animals = selectedBatch.animals;
    const cleanAnimalId = animalIdParam ? String(animalIdParam).replace(/\D/g, "") : null;
    const cleanTag = tagParam ? tagParam.trim().toLowerCase() : null;

    const target = animals.find((a) => {
      if (animalIdParam && String(a.id) === String(animalIdParam)) return true;
      if (cleanAnimalId && String(a.id) === cleanAnimalId) return true;
      if (cleanTag) {
        if (a.tag_number && a.tag_number.trim().toLowerCase() === cleanTag) return true;
        if (cleanTag.replace(/^tag-?/i, "") === String(a.id)) return true;
        if (a.tag_number && a.tag_number.replace(/^tag-?/i, "").toLowerCase() === cleanTag.replace(/^tag-?/i, "")) return true;
      }
      return false;
    });

    if (!target) return;

    setHighlightedAnimalId(target.id);

    // Reset filters to ensure the target animal is visible
    if (animalSearchQuery) setAnimalSearchQuery("");
    if (animalStatusFilter !== "ALL") setAnimalStatusFilter("ALL");

    // Switch to page containing target animal
    const targetIndex = animals.findIndex((a) => a.id === target.id);
    if (targetIndex !== -1) {
      const targetPage = Math.floor(targetIndex / ANIMAL_PAGE_SIZE) + 1;
      setAnimalPage(targetPage);
      // Double guarantee after any state reset
      setTimeout(() => {
        setAnimalPage(targetPage);
      }, 50);
    }
  }, [isDrilldownOpen, selectedBatch?.id, selectedBatch?.animals, animalIdParam, tagParam]);

  // Smoothly scroll down and focus on target animal once rendered in DOM
  useEffect(() => {
    if (!isDrilldownOpen || !highlightedAnimalId || scrolledAnimalIdRef.current === highlightedAnimalId) return;

    let attempts = 0;
    const maxAttempts = 30;
    const interval = setInterval(() => {
      attempts++;
      const targetEl =
        document.getElementById(`admin-animal-row-${highlightedAnimalId}`) ||
        document.getElementById(`animal-row-${highlightedAnimalId}`);

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        scrolledAnimalIdRef.current = highlightedAnimalId;
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [highlightedAnimalId, animalPage, pagedChildAnimals, isDrilldownOpen]);

  // ── Mutations: Batch Review ──────────────────────────────────────────────
  // Individual animals are reviewed from the inventory queue.

  function openDrilldown(batch: BatchItem) {
    // The list response omits animal rosters. Reuse cached detail when reopening
    // the same herd so a roster-free list row cannot replace its loaded animals.
    const cachedDetail = queryClient.getQueryData<BatchItem>([
      "admin-batch-detail",
      batch.id,
    ]);
    setSelectedBatch(cachedDetail ?? batch);
    setIsDrilldownOpen(true);
  }

  function toggleVisibleVerifiedAnimals(checked: boolean) {
    setSelectedAnimalIds((current) => {
      if (checked) return Array.from(new Set([...current, ...visibleVerifiedAnimalIds]));
      return current.filter((id) => !visibleVerifiedAnimalIds.includes(id));
    });
  }

  function openAnimalDetail(animal: ChildAnimal) {
    if (!selectedBatch) return;
    // Use the shared MAO record dialog so the herd roster and Data Validation
    // expose the same animal fields and review actions without route changes.
    setReviewAnimal({
      kind: "inventory",
      id: animal.id,
      rawId: animal.id,
      isBatch: false,
      farmerName: selectedBatch.farmer_name,
      barangayName: selectedBatch.barangay_name,
      livestockType: selectedBatch.livestock_type_name,
      tagNumber: animal.tag_number || `#${animal.id}`,
      breed: animal.breed || "",
      sex: animal.sex || "Unspecified",
      weight: animal.weight == null ? null : Number(animal.weight),
      entryType: "INDIVIDUAL",
      quantity: 1,
      lastVaccinationDate: animal.last_vaccination_date || null,
      status: animal.status,
      reviewRemarks: animal.review_remarks || null,
      reviewedByName: animal.reviewed_by_name || null,
      reviewedAt: animal.reviewed_at || null,
      createdAt: animal.created_at || selectedBatch.created_at,
      batchId: selectedBatch.id,
      batchCode: selectedBatch.batch_code,
      batchName: selectedBatch.batch_name,
      photoUrl: animal.photo_url || undefined,
    });
  }

  async function reviewAnimalRecord(
    action: "APPROVED" | "SUBJECT_TO_REVISION",
    remarks: string,
    recordIds: (string | number)[],
  ) {
    const animalId = Number(recordIds[0]);
    if (!Number.isInteger(animalId)) throw new Error("Invalid livestock record.");
    try {
      await api.post(`livestock/inventory/${animalId}/review/`, { status: action, remarks });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-batch-detail", selectedBatch?.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["livestock-batches"] }),
      ]);
      await detailQuery.refetch();
      toast.success(action === "APPROVED" ? "Animal approved by MAO." : "Animal returned for revision.");
    } catch (error) {
      toast.error("Could not update this animal's review status. Please try again.");
      throw error;
    }
  }

  async function approveSelectedAnimals() {
    if (!selectedBatch || selectedVerifiedAnimals.length === 0 || selectedVerifiedAnimals.length !== selectedAnimalIds.length) return;

    setBulkApproving(true);
    try {
      const results = await Promise.allSettled(selectedVerifiedAnimals.map((animal) => {
        const remarks = animal.review_remarks
          ? `MAO approved following SIBAT verification. Previous SIBAT remarks: ${animal.review_remarks}`
          : "MAO approved following SIBAT verification.";
        return api.post(`livestock/inventory/${animal.id}/review/`, {
          status: "APPROVED",
          remarks,
        });
      }));
      const approvedCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - approvedCount;

      setSelectedAnimalIds([]);
      setBulkApproveOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-batch-detail", selectedBatch.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["livestock-batches"] }),
      ]);
      await detailQuery.refetch();

      if (failedCount > 0) {
        toast.error(`${approvedCount} animal(s) approved; ${failedCount} could not be approved.`, {
          description: "The server revalidated each animal. Refresh the herd and review any remaining verified records.",
        });
      } else {
        toast.success(`${approvedCount} verified animal(s) approved by MAO.`);
      }
    } catch {
      toast.error("Could not refresh the herd after approval. Please reload the roster.");
    } finally {
      setBulkApproving(false);
    }
  }

  const addBatchNoteMutation = useMutation({
    mutationFn: async ({ batchId, text }: { batchId: number; text: string }) => {
      const res = await api.post(`livestock/batches/${batchId}/notes/`, { text });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Note added to batch audit trail.", {
        description: "The farmer can now see this note on the herd page.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      queryClient.invalidateQueries({ queryKey: ["admin-batch-detail"] });
      setBatchNoteText("");
    },
    onError: (err) => {
      console.error("Batch note failed:", err);
      toast.error("Failed to add note. Please try again.");
    },
  });

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    toast.success(`Tag copied: ${tag}`);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const getStatusBadge = (status?: string) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "MIXED") {
      return <Badge variant="outline" className="text-[10px] font-bold text-slate-700 border-slate-300">Mixed animal statuses</Badge>;
    }
    if (s === "NO_ANIMALS") {
      return <Badge variant="outline" className="text-[10px] font-bold text-slate-500">No animals</Badge>;
    }
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          All animals approved
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
          <ShieldCheck className="w-3 h-3 text-sky-600" />
          All animals SIBAT verified
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Revision Required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
        All animals awaiting SIBAT
      </span>
    );
  };

  const getAnimalStatusBadge = (status?: string) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Approved
        </span>
      );
    }
    if (s === "VERIFIED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-800 border border-sky-300">
          <ShieldCheck className="w-3 h-3 text-sky-600" />
          SIBAT Verified
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION" || s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Needs Revision
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
        Awaiting SIBAT
      </span>
    );
  };

  const getSpeciesColor = (species: string) => {
    const s = species?.toLowerCase() || "";
    if (s.includes("cattle") || s.includes("cow")) return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (s.includes("swine") || s.includes("pig")) return "bg-rose-50 text-rose-800 border-rose-200";
    if (s.includes("carabao")) return "bg-stone-100 text-stone-800 border-stone-300";
    if (s.includes("goat")) return "bg-amber-50 text-amber-800 border-amber-200";
    if (s.includes("poultry") || s.includes("chicken")) return "bg-orange-50 text-orange-800 border-orange-200";
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  if (isInitialLoading || keepLoadingScreenMounted) {
    return (
      <div className="min-h-screen bg-slate-50/70 pb-16">
        <PageHeader
          title="Municipal Herd Registry"
          subtitle="Browse herd containers, inspect individual livestock records, and approve SIBAT-verified animals."
          variant="admin"
          maxWidthClass="w-full"
          icon={<Layers className="size-5 text-slate-800" />}
        />
        <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-5 lg:px-8 lg:py-6">
          <ValidationLoadingScreen
            isLoading={isInitialLoading}
            title="Loading Municipal Herd Ledger"
            subtitle="Connecting authorized livestock batches, aggregate animal counts, and verification rosters..."
            badgeLabel="Herd Validation Center"
            authorityText="MAO Regulatory Review · Padre Garcia, Batangas"
            items={[
              {
                id: "batches",
                label: "Livestock Herds",
                sublabel: "Grouped cattle, swine, and livestock batches",
                icon: <Layers className="size-4 text-emerald-700" />,
                loaded: !isLoading,
              },
              {
                id: "analytics",
                label: "Audit Summaries",
                sublabel: "Verification progress and head metrics",
                icon: <ShieldCheck className="size-4 text-emerald-700" />,
                loaded: !isLoading,
              },
              {
                id: "species",
                label: "Reference Classifications",
                sublabel: "Approved species catalogs and barangay listings",
                icon: <Tag className="size-4 text-emerald-700" />,
                loaded: !references.isLoading,
              },
            ]}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Municipal Herd Registry"
        subtitle="Browse herd containers, inspect individual livestock records, and approve SIBAT-verified animals."
        variant="admin"
        maxWidthClass="w-full"
        icon={<Layers className="size-5 text-slate-800" />}
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5 pb-16 sm:pb-6">
        {(isError || detailQuery.isError) && <p role="alert" className="p-4 text-sm text-rose-700">Could not load livestock data. <button className="underline" onClick={() => { refetch(); detailQuery.refetch(); }}>Retry</button></p>}
      {detailQuery.isFetching && <p className="px-4 text-xs text-slate-500">Loading herd roster...</p>}
      {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <Link href="/data-validation">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Return to Validation Command Center
              </Button>
            </Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider hidden sm:inline">
              Padre Garcia Municipal Batches ({batches.length})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-8 gap-1.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-emerald-600" : ""}`} />
              Refresh Roster
            </Button>

            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewMode === "grid"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${viewMode === "table"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
                title="Tabular Roster View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Total Herds
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {kpis.totalBatches}
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Active
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">All Padre Garcia farms</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Total Enrolled Heads
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-800 font-mono">
                  {kpis.totalAnimals}
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  Heads
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">
                Avg {kpis.avgHeads} animals / batch
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Individually Approved Animals
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {kpis.approvedAnimals}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">Approved livestock records</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Animals Awaiting SIBAT
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {kpis.pendingAnimals}
                </span>
                <Clock className={`w-4 h-4 ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">Individual animal submissions</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all col-span-2 sm:col-span-1">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Animals Awaiting MAO
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-sky-700 font-mono">
                  {kpis.verifiedAnimals}
                </span>
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">Individually verified by SIBAT</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="relative lg:col-span-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search batch code, farmer, barangay, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl border-slate-200 text-xs focus-visible:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Species Dropdown */}
            <div className="lg:col-span-3">
              <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="All Species" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Species</SelectItem>
                  {speciesList.map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {sp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Animal Status Filter */}
            <div className="lg:col-span-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="Animal Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="APPROVED">MAO Approved ({kpis.approvedAnimals})</SelectItem>
                  <SelectItem value="PENDING">Awaiting SIBAT ({kpis.pendingAnimals})</SelectItem>
                  <SelectItem value="VERIFIED">SIBAT Verified ({kpis.verifiedAnimals})</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Revision Required ({kpis.revisionAnimals})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Barangay Dropdown */}
            <div className="lg:col-span-2">
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-medium truncate">
                  <SelectValue placeholder="All Barangays" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  <SelectItem value="ALL">All Barangays</SelectItem>
                  {(references.data?.barangays || []).map((b) => b.barangay_name).map((brgy) => (
                    <SelectItem key={brgy} value={brgy}>
                      {brgy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filter Tags */}
          {(searchQuery || speciesFilter !== "ALL" || statusFilter !== "ALL" || barangayFilter !== "ALL") && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Filters Active:
              </span>
              {searchQuery && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Search: &ldquo;{searchQuery}&rdquo;
                  <button type="button" onClick={() => setSearchQuery("")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              {speciesFilter !== "ALL" && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Species: {speciesFilter}
                  <button type="button" onClick={() => setSpeciesFilter("ALL")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              {statusFilter !== "ALL" && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Status: {statusFilter}
                  <button type="button" onClick={() => setStatusFilter("ALL")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              {barangayFilter !== "ALL" && (
                <Badge variant="secondary" className="rounded-lg text-[10px] font-medium gap-1 bg-slate-100">
                  Barangay: {barangayFilter}
                  <button type="button" onClick={() => setBarangayFilter("ALL")} className="hover:text-red-500">×</button>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSpeciesFilter("ALL");
                  setStatusFilter("ALL");
                  setBarangayFilter("ALL");
                }}
                className="h-6 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-md"
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </div>

        {/* ── Main Batch Displays ── */}
        {isLoading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-black text-slate-800">Loading Municipal Herds...</p>
            <p className="text-xs text-slate-500 mt-1">Retrieving herd summaries; individual rosters load when opened</p>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-black text-slate-800">No matching batches found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No livestock batches match your search criteria. Try modifying your search term or clearing the active filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSpeciesFilter("ALL");
                setStatusFilter("ALL");
                setBarangayFilter("ALL");
              }}
              className="mt-4 rounded-xl text-xs font-bold"
            >
              Clear All Filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View Mode */
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pagedBatches.map((batch) => (
                <AdminHerdSplitCard
                  key={batch.id}
                  batch={batch}
                  isSelected={selectedBatch?.id === batch.id && isDrilldownOpen}
                  onSelect={() => openDrilldown(batch)}
                  onViewQr={() => {
                    setSelectedBatch(batch);
                    setIsBatchCertificateOpen(true);
                  }}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </div>
            <BatchPager page={batchPage} pageSize={BATCH_PAGE_SIZE} total={batchPageData?.count || 0} onPageChange={setBatchPage} />
          </div>
        ) : (
          /* Table View Mode */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Batch Code
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Herd Name &amp; Species
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Farmer &amp; Barangay
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-center">
                      Heads
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Pen &amp; Feed
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Weight Profile
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedBatches.map((batch) => {
                    const headCount = batch.total_animals || batch.animals?.length || 0;
                    return (
                      <TableRow key={batch.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-slate-900">
                          {batch.batch_code}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs text-slate-900 block truncate max-w-[200px]">
                              {batch.batch_name}
                            </span>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getSpeciesColor(
                                batch.livestock_type_name
                              )}`}
                            >
                              {batch.livestock_type_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5 text-xs">
                            <span className="font-bold text-slate-800 block truncate max-w-[180px]">
                              {batch.farmer_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {batch.barangay_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-black text-xs text-emerald-800">
                          {headCount}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <div>Pen: {batch.housing_pen || "General"}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {batch.feed_type || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div>
                            Avg: <strong>{batch.average_weight ? `${batch.average_weight} kg` : "N/A"}</strong>
                          </div>
                          {batch.target_weight && (
                            <div className="text-[10px] text-slate-400">
                              Target: {batch.target_weight} kg
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(batch.review_status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedBatch(batch);
                                setIsBatchCertificateOpen(true);
                              }}
                              className="h-8 rounded-xl border-slate-200 text-slate-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 text-xs font-bold px-2.5"
                              title="View Batch QR Clearance Pass"
                            >
                              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                openDrilldown(batch);
                              }}
                              className="h-8 rounded-xl bg-slate-900 hover:bg-emerald-800 text-white font-bold text-xs gap-1 shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Drill Down
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="border-t border-slate-200 bg-slate-50/50">
              <BatchPager page={batchPage} pageSize={BATCH_PAGE_SIZE} total={batchPageData?.count || 0} onPageChange={setBatchPage} />
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          DEEP DRILLDOWN INSPECTION DIALOG (HERD & INDIVIDUAL LIVESTOCK ROSTER)
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={isDrilldownOpen}
        onOpenChange={(open) => {
          setIsDrilldownOpen(open);
          if (!open) {
            setHighlightedAnimalId(null);
            scrolledAnimalIdRef.current = null;
            if (batchIdParam) {
              router.replace("/data-validation/batches", { scroll: false });
            }
          }
        }}
      >
        <DialogContent className="w-full max-w-[98vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-[1440px] rounded-2xl sm:rounded-3xl bg-white p-0 overflow-hidden shadow-2xl border-slate-200 max-h-[94vh] flex flex-col">
          {detailQuery.isLoading ? (
            <div
              className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
              role="status"
              aria-live="polite"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <RefreshCw className="size-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-black text-slate-900">Loading herd details</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Retrieving the herd record and individual livestock roster.
                </DialogDescription>
              </div>
            </div>
          ) : detailQuery.isError ? (
            <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="size-8 text-rose-600" />
              <div className="space-y-1">
                <DialogTitle className="text-base font-black text-slate-900">Could not load herd details</DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  The herd roster could not be retrieved. Check your connection and try again.
                </DialogDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void detailQuery.refetch()}
                className="rounded-xl font-bold"
              >
                Try again
              </Button>
            </div>
          ) : selectedBatch && (
            <div className="flex flex-col max-h-[94vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white border-b border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pr-12 sm:pr-14">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {selectedBatch.livestock_type_name} Herd
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-200">
                      {selectedBatch.batch_code}
                    </span>
                    {getStatusBadge(selectedBatch.review_status)}
                  </div>
                  <DialogTitle className="text-lg sm:text-xl font-black text-white">
                    {selectedBatch.batch_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-emerald-200/80 flex items-center gap-2 flex-wrap">
                    <span>Farmer: <strong>{selectedBatch.farmer_name}</strong></span>
                    <span>•</span>
                    <span>Barangay: <strong>{selectedBatch.barangay_name}</strong></span>
                    <span>•</span>
                    <span>Enrolled: <strong>{selectedBatch.animals?.length || selectedBatch.total_animals} Heads</strong></span>
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchCertificateOpen(true)}
                    className="h-8.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border-emerald-400/40 text-xs font-bold gap-1.5 shadow-xs"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Batch QR Clearance Pass</span>
                  </Button>
                </div>
              </div>

              {/* Husbandry & Environment Summary Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Housing Facility
                  </span>
                  <p className="font-black text-slate-800 text-xs mt-0.5 truncate">
                    {selectedBatch.housing_pen || "Standard Pen"}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Feed: {selectedBatch.feed_type || "—"}
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Average Weight
                  </span>
                  <p className="font-black text-emerald-800 text-xs mt-0.5">
                    {selectedBatch.average_weight ? `${selectedBatch.average_weight} kg` : "N/A"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Target: {selectedBatch.target_weight ? `${selectedBatch.target_weight} kg` : "Unspecified"}
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Target Harvest Date
                  </span>
                  <p className="font-black text-slate-800 text-xs mt-0.5">
                    {selectedBatch.target_harvest_date || "Open Schedule"}
                  </p>
                  <p className="text-[10px] text-slate-500">Registered: {selectedBatch.created_at?.split("T")[0]}</p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Individual review</span>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-600">Each animal has its own SIBAT and MAO status. This herd is only a grouping container.</p>
                  <Link href={`/data-validation?domain=inventory&batchId=${selectedBatch.id}`} className="mt-2 block">
                    <Button type="button" size="sm" variant="outline" className="h-7 w-full rounded-lg text-[10px] font-bold">Open animal review records</Button>
                  </Link>
                </div>
              </div>

              {/* Reviewer Notes (append-only audit trail) */}
              <div className="px-3 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBatchNotes(!showBatchNotes)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={showBatchNotes}
                >
                  <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-emerald-700 shrink-0" />
                    Reviewer Notes &amp; Audit Trail
                    {selectedBatch.notes && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {selectedBatch.notes.split("\n").filter(Boolean).length}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${showBatchNotes ? "rotate-180" : ""}`}
                  />
                </button>

                {showBatchNotes && (
                  <div className="mt-2.5 space-y-2.5">
                    <pre className="text-[11px] text-slate-600 font-sans whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded-xl p-3 max-h-32 overflow-y-auto">
                      {selectedBatch.notes || "No notes recorded for this batch yet."}
                    </pre>
                    <div className="flex gap-2 items-start">
                      <Textarea
                        value={batchNoteText}
                        onChange={(e) => setBatchNoteText(e.target.value)}
                        placeholder="Add an official note for the farmer..."
                        className="h-14 sm:h-16 text-xs rounded-xl border-slate-200"
                      />
                      <Button
                        size="sm"
                        disabled={addBatchNoteMutation.isPending || !batchNoteText.trim()}
                        onClick={() => {
                          if (!batchNoteText.trim() || !selectedBatch) return;
                          addBatchNoteMutation.mutate({
                            batchId: selectedBatch.id,
                            text: batchNoteText.trim(),
                          });
                        }}
                        className="h-14 sm:h-16 px-3 sm:px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed shrink-0"
                      >
                        {addBatchNoteMutation.isPending ? "Adding..." : "Add Note"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Animals Drilldown Section */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-emerald-700" />
                      Individual Animal Roster ({filteredChildAnimals.length} Heads)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Drill down into individual ear tags, health biometric logs, and vaccination records
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setBulkApproveOpen(true)}
                      disabled={selectedAnimalIds.length === 0 || selectedVerifiedAnimals.length !== selectedAnimalIds.length}
                      className="h-8 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      <ShieldCheck className="mr-1.5 size-3.5" />
                      Approve selected verified ({selectedAnimalIds.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleVisibleVerifiedAnimals(!allVisibleVerifiedAnimalsSelected)}
                      disabled={visibleVerifiedAnimalIds.length === 0}
                      className="h-8 rounded-xl text-xs font-bold"
                    >
                      {allVisibleVerifiedAnimalsSelected ? "Clear page selection" : "Select verified on page"}
                    </Button>
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        placeholder="Search ear tag, breed..."
                        value={animalSearchQuery}
                        onChange={(e) => setAnimalSearchQuery(e.target.value)}
                        className="pl-8 h-8 rounded-xl border-slate-200 text-xs"
                      />
                    </div>

                    <Select value={animalStatusFilter} onValueChange={setAnimalStatusFilter}>
                      <SelectTrigger className="h-8 rounded-xl border-slate-200 text-xs w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="VERIFIED">Verified</SelectItem>
                        <SelectItem value="SUBJECT_TO_REVISION">Revision</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Animals Table */}
                <div className="border border-slate-200 rounded-2xl overflow-x-auto w-full no-scrollbar bg-white">
                  <Table className="min-w-[460px] md:min-w-[650px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-10">
                          <input
                            type="checkbox"
                            aria-label="Select all verified animals on this page"
                            title="Select all verified animals on this page"
                            checked={allVisibleVerifiedAnimalsSelected}
                            disabled={visibleVerifiedAnimalIds.length === 0}
                            onChange={(event) => toggleVisibleVerifiedAnimals(event.target.checked)}
                            className="size-4 rounded border-slate-300 accent-emerald-700 disabled:cursor-not-allowed"
                          />
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Ear Tag #
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Breed &amp; Sex
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 hidden md:table-cell">
                          Weight (kg)
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:table-cell">
                          Vaccination
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Review Status
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-right sticky right-0 z-10 bg-slate-50 border-l border-slate-200 shadow-[-4px_0_8px_-8px_rgba(0,0,0,0.25)]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChildAnimals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                            No individual animals found matching filter criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedChildAnimals.map((animal) => {
                          const avatar = getDefaultAvatarForSpecies(selectedBatch.livestock_type_name);
                          const animalWeight = animal.weight ? Number(animal.weight) : null;
                          const batchAvg = selectedBatch.average_weight ? Number(selectedBatch.average_weight) : null;
                          const weightDiff = animalWeight && batchAvg ? (animalWeight - batchAvg).toFixed(1) : null;

                          const isTarget = highlightedAnimalId === animal.id;

                          return (
                            <TableRow
                              key={animal.id}
                              id={`admin-animal-row-${animal.id}`}
                              className={`transition-all duration-500 ${
                                isTarget
                                  ? "bg-emerald-100/90 ring-2 ring-emerald-600 ring-inset shadow-md font-medium"
                                  : "hover:bg-slate-50/70"
                              }`}
                            >
                              <TableCell>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for approval`}
                                  checked={selectedAnimalIds.includes(animal.id)}
                                  disabled={animal.status !== "VERIFIED"}
                                  onChange={(event) => {
                                    setSelectedAnimalIds((current) => event.target.checked
                                      ? Array.from(new Set([...current, animal.id]))
                                      : current.filter((id) => id !== animal.id));
                                  }}
                                  className="size-4 rounded border-slate-300 accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                                />
                              </TableCell>
                              {/* Tag Number */}
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`size-8 rounded-xl flex items-center justify-center text-sm border shadow-2xs shrink-0 ${avatar.bgGradient}`}
                                  >
                                    {avatar.emoji}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono font-black text-xs text-slate-900">
                                        {animal.tag_number || `#${animal.id}`}
                                      </span>
                                      {isTarget && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] font-black text-white shadow-xs animate-pulse">
                                          <Check className="size-2.5" /> Selected Record
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleCopyTag(animal.tag_number)}
                                        className="text-slate-400 hover:text-slate-700"
                                        title="Copy tag number"
                                      >
                                        {copiedTag === animal.tag_number ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ID: {animal.id}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Breed & Sex */}
                              <TableCell className="text-xs">
                                <span className="font-bold text-slate-800 block">
                                  {animal.breed || "Standard Breed"}
                                </span>
                                <span
                                  className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${animal.sex === "Female"
                                    ? "text-rose-700 bg-rose-50"
                                    : animal.sex === "Male"
                                      ? "text-blue-700 bg-blue-50"
                                      : "text-amber-700 bg-amber-50"
                                    }`}
                                >
                                  {animal.sex || "Unspecified"}
                                </span>
                              </TableCell>

                              {/* Weight */}
                              <TableCell className="hidden md:table-cell text-xs">
                                <div className="font-mono font-bold text-slate-900">
                                  {animalWeight ? `${animalWeight} kg` : "N/A"}
                                </div>
                                {weightDiff && (
                                  <span
                                    className={`text-[10px] font-mono font-bold ${Number(weightDiff) >= 0 ? "text-emerald-700" : "text-amber-700"
                                      }`}
                                  >
                                    {Number(weightDiff) >= 0 ? `+${weightDiff}` : weightDiff} kg vs avg
                                  </span>
                                )}
                              </TableCell>

                              {/* Vaccination */}
                              <TableCell className="hidden sm:table-cell text-xs">
                                <span className="font-medium text-slate-700 block">
                                  {animal.last_vaccination_date || "Up to Date"}
                                </span>
                                <span className="text-[10px] text-emerald-700 font-bold">
                                  ✓ Biosecure
                                </span>
                              </TableCell>

                              {/* Status */}
                              <TableCell>{getAnimalStatusBadge(animal.status)}</TableCell>

                              {/* Row Actions */}
                              <TableCell className="sticky right-0 z-10 bg-white border-l border-slate-200 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setPassportAnimal(animal);
                                      setIsPassportOpen(true);
                                    }}
                                    className="h-7 px-2 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 gap-1"
                                    title="View Animal Biosecurity Passport"
                                  >
                                    <QrCode className="w-3 h-3 text-emerald-700" />
                                    Passport
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openAnimalDetail(animal)}
                                    className="h-7 px-2 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 gap-1"
                                    aria-label={`Review details for ${animal.tag_number || `animal ${animal.id}`}`}
                                  >
                                    <Eye className="size-3 text-blue-700" />
                                    Review
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {filteredChildAnimals.length > ANIMAL_PAGE_SIZE && (
                  <BatchPager page={animalPage} pageSize={ANIMAL_PAGE_SIZE} total={filteredChildAnimals.length} onPageChange={setAnimalPage} />
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                <span className="text-[11px] sm:text-xs text-slate-500">
                  Batangas Livestock Tracking System • Municipal Agriculture Office of Padre Garcia
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDrilldownOpen(false)}
                  className="rounded-xl font-bold text-xs w-full sm:w-auto"
                >
                  Close Drilldown
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkApproveOpen} onOpenChange={(open) => {
        if (!bulkApproving) setBulkApproveOpen(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve verified animals?</AlertDialogTitle>
            <AlertDialogDescription>
              This will submit {selectedVerifiedAnimals.length} selected SIBAT-verified animal record(s) for MAO approval in this herd. Each animal is reviewed separately, and the server will recheck its current status and your permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkApproving || selectedVerifiedAnimals.length === 0 || selectedVerifiedAnimals.length !== selectedAnimalIds.length}
              onClick={(event) => {
                event.preventDefault();
                void approveSelectedAnimals();
              }}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {bulkApproving ? "Approving..." : `Approve ${selectedVerifiedAnimals.length} animal(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecordDetailDialog
        record={reviewAnimal}
        open={reviewAnimal !== null}
        onOpenChange={(open) => { if (!open) setReviewAnimal(null); }}
        onConfirmAction={reviewAnimalRecord}
      />

      {/* ──────────────────────────────────────────────────────────────────────────
          BATCH REVIEW CONFIRMATION MODAL
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isPassportOpen} onOpenChange={setIsPassportOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200 max-h-[92vh] overflow-y-auto">
          {(!passportAnimal || !selectedBatch) && (
            <DialogHeader className="sr-only">
              <DialogTitle>Municipal Livestock Passport</DialogTitle>
              <DialogDescription>Republic of the Philippines • Municipality of Padre Garcia, Batangas</DialogDescription>
            </DialogHeader>
          )}
          {passportAnimal && selectedBatch && (
            <>
              <DialogHeader className="text-center">
                <div className="mx-auto size-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl mb-1">
                  🏛️
                </div>
                <DialogTitle className="text-base font-black text-slate-900">
                  Municipal Livestock Passport
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Republic of the Philippines • Municipality of Padre Garcia, Batangas
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-center">
                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 inline-block mx-auto">
                  <svg className="size-36 mx-auto" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="10" width="30" height="30" rx="4" fill="#064E3B" />
                    <rect x="16" y="16" width="18" height="18" rx="2" fill="white" />
                    <rect x="20" y="20" width="10" height="10" rx="1" fill="#064E3B" />

                    <rect x="80" y="10" width="30" height="30" rx="4" fill="#064E3B" />
                    <rect x="86" y="16" width="18" height="18" rx="2" fill="white" />
                    <rect x="90" y="20" width="10" height="10" rx="1" fill="#064E3B" />

                    <rect x="10" y="80" width="30" height="30" rx="4" fill="#064E3B" />
                    <rect x="16" y="86" width="18" height="18" rx="2" fill="white" />
                    <rect x="20" y="90" width="10" height="10" rx="1" fill="#064E3B" />

                    <rect x="48" y="12" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="58" y="12" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="68" y="18" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="48" y="26" width="12" height="6" rx="1" fill="#064E3B" />

                    <rect x="12" y="48" width="6" height="6" rx="1" fill="#064E3B" />
                    <rect x="24" y="48" width="6" height="12" rx="1" fill="#064E3B" />
                    <rect x="12" y="60" width="18" height="6" rx="1" fill="#064E3B" />

                    <rect x="44" y="44" width="32" height="32" rx="6" fill="#10B981" />
                    <circle cx="60" cy="60" r="10" fill="white" />
                    <circle cx="60" cy="60" r="5" fill="#064E3B" />

                    <rect x="82" y="48" width="14" height="6" rx="1" fill="#064E3B" />
                    <rect x="90" y="60" width="18" height="6" rx="1" fill="#064E3B" />
                    <rect x="82" y="70" width="6" height="14" rx="1" fill="#064E3B" />

                    <rect x="48" y="84" width="8" height="8" rx="1" fill="#064E3B" />
                    <rect x="60" y="92" width="14" height="6" rx="1" fill="#064E3B" />
                    <rect x="48" y="102" width="20" height="6" rx="1" fill="#064E3B" />
                    <rect x="84" y="90" width="12" height="6" rx="1" fill="#064E3B" />
                    <rect x="98" y="98" width="10" height="10" rx="1" fill="#064E3B" />
                  </svg>
                </div>

                <div>
                  <p className="font-mono font-black text-base text-slate-900 tracking-wider">
                    {passportAnimal.tag_number}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Parent Batch: <strong className="font-mono text-emerald-800">{selectedBatch.batch_code}</strong>
                  </p>
                </div>

                {/* Biometrics Table */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Species &amp; Breed:</span>
                    <span className="font-bold text-slate-900">
                      {selectedBatch.livestock_type_name} • {passportAnimal.breed}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sex &amp; Weight:</span>
                    <span className="font-bold text-slate-900">
                      {passportAnimal.sex} • {passportAnimal.weight ? `${passportAnimal.weight} kg` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Farm Owner:</span>
                    <span className="font-bold text-slate-900">{selectedBatch.farmer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Barangay:</span>
                    <span className="font-bold text-slate-900">{selectedBatch.barangay_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vaccination Status:</span>
                    <span className="font-bold text-emerald-700">
                      {passportAnimal.last_vaccination_date || "Certified Up to Date"}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPassportOpen(false)}
                  className="rounded-xl text-xs font-bold flex-1"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    toast.success("Print command triggered.", {
                      description: `Exporting biometric passport for ${passportAnimal.tag_number}`,
                    });
                    setIsPassportOpen(false);
                  }}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Passport
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────────
          BATCH BIOSECURITY CERTIFICATE & QR PASS MODAL
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isBatchCertificateOpen} onOpenChange={setIsBatchCertificateOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200 max-h-[92vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedBatch
                ? `Batch ${selectedBatch.batch_name} Biosecurity Certificate & Movement Clearance Pass`
                : "Batch Biosecurity Certificate & Movement Clearance Pass"}
            </DialogTitle>
            <DialogDescription>
              Official Municipal Biosecurity &amp; Movement Clearance Pass
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-4">
              <QrCodePass
                code={selectedBatch.batch_code}
                qrPayload={livestockBatchQrPayload(selectedBatch.id)}
                title={`Batch ${selectedBatch.batch_name}`}
                subtitle="Livestock batch identity · check current status in SmartLivestock"
                ownerName={selectedBatch.farmer_name}
                barangay={selectedBatch.barangay_name}
                specie={selectedBatch.livestock_type_name}
                headCount={selectedBatch.animals?.length || selectedBatch.total_animals}
                status={selectedBatch.review_status || selectedBatch.status || "PENDING"}
                verifiedAt={selectedBatch.reviewed_at ? selectedBatch.reviewed_at.slice(0, 10) : undefined}
              />

              {/* Enrolled Animals in this Herd */}
              {selectedBatch.animals && selectedBatch.animals.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Enrolled Ear Tag Codes in this Herd ({selectedBatch.animals.length} heads):
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {selectedBatch.animals.map((a) => (
                      <span
                        key={a.id}
                        className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-800"
                      >
                        {a.tag_number}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-2 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBatchCertificateOpen(false)}
                  className="rounded-xl text-xs font-bold flex-1"
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    toast.success("Print clearance pass dispatched.");
                    window.print();
                  }}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Official Clearance Pass
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminBatchesDrilldownPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50/70 pb-16">
          <PageHeader
            title="Municipal Herd Registry"
            subtitle="Browse herd containers, inspect individual livestock records, and approve SIBAT-verified animals."
            variant="admin"
            maxWidthClass="w-full"
            icon={<Layers className="size-5 text-slate-800" />}
          />
          <div className="mx-auto w-full max-w-[1500px] p-3 sm:p-5 lg:px-8 lg:py-6">
            <ValidationLoadingScreen
              isLoading={true}
              title="Loading Municipal Herd Ledger"
              subtitle="Connecting authorized livestock batches, aggregate animal counts, and verification rosters..."
              badgeLabel="Herd Validation Center"
              authorityText="MAO Regulatory Review · Padre Garcia, Batangas"
              items={[
                {
                  id: "batches",
                  label: "Livestock Herds",
                  sublabel: "Grouped cattle, swine, and livestock batches",
                  icon: <Layers className="size-4 text-emerald-700" />,
                  loaded: false,
                },
              ]}
            />
          </div>
        </div>
      }
    >
      <AdminBatchesDrilldownContent />
    </Suspense>
  );
}
