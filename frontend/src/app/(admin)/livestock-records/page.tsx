"use client";

import { getDefaultAvatarForSpecies } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import { PageHeader } from "@/app/components/page-header";
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
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { QrCodePass } from "@/components/qr-code-pass";
import { UniversalQrScannerDialog } from "@/components/universal-qr-scanner-dialog";
import api from "@/lib/axios";
import { livestockBatchQrPayload } from "@/lib/livestock-identity";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  ImageIcon,
  Layers,
  LayoutGrid,
  List,
  MapPin,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  fetchAdminInventoryRecords,
  ValidationInventoryItem,
} from "../data-validation/validation-analytics";
import {
  IndividualAnimalReviewModal,
  AnimalReviewDetail,
} from "./individual-animal-review-dialog";
import {
  ValidationLoadingScreen,
  useSeamlessLoadingState,
} from "@/components/validation-loading-screen";
import LivestockRecordsLoading from "./loading";

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
  reviewed_by_role?: string | null;
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
  summary: {
    totalAnimals: number | null;
    totalHerds: number;
    approvedAnimals: number;
    pendingAnimals: number;
    verifiedAnimals: number;
    revisionAnimals: number;
    rejectedAnimals: number;
  };
}

const CowIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-1.5-11 0-.2-.6-1.5-2-3-2C1 5 .5 6.5 1 8c.8 2.3 2.5 3.5 4 4 .2 3.5 2.5 6 7 6s6.8-2.5 7-6c1.5-.5 3.2-1.7 4-4 .5-1.5 0-3-1-3Z" />
    <path d="M7 15v4" />
    <path d="M17 15v4" />
    <path d="M9 18h6" />
    <circle cx="9" cy="11" r="1" fill="currentColor" />
    <circle cx="15" cy="11" r="1" fill="currentColor" />
  </svg>
);

// ── SPLIT CARD WITH HERO IMAGE COMPONENT (Herd Registry Cards) ──────────────
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
      className={`group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row justify-between backdrop-blur-xs ${
        isSelected
          ? "border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/30 shadow-md"
          : "border-slate-200/90 bg-white/95 hover:border-emerald-400 hover:shadow-md"
      }`}
    >
      {/* ── LEFT HERO IMAGE SECTION ── */}
      <div className="relative aspect-[21/9] sm:aspect-auto sm:w-48 md:w-52 lg:w-56 sm:self-stretch min-h-[150px] sm:min-h-full shrink-0 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
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
            <span className="text-3xl drop-shadow-md">{avatar.emoji}</span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {batch.livestock_type_name}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

        <div className="absolute left-2.5 right-2.5 top-2.5 flex items-center justify-between gap-1.5 z-10">
          <Badge className="rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
            {batch.livestock_type_name}
          </Badge>
          {isSelected && (
            <Badge className="bg-emerald-700 text-white font-bold text-[9px] gap-1 px-1.5 py-0.5 shadow-xs">
              <Check className="size-2.5 stroke-[3]" /> Selected
            </Badge>
          )}
        </div>

        {photos.length > 1 && (
          <div className="absolute inset-y-0 left-1 right-1 flex items-center justify-between z-20 pointer-events-none">
            <button
              type="button"
              aria-label="Previous herd picture"
              onClick={handlePrevPhoto}
              className="pointer-events-auto flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs"
            >
              <ChevronLeft className="size-3 stroke-[2.5]" />
            </button>
            <button
              type="button"
              aria-label="Next herd picture"
              onClick={handleNextPhoto}
              className="pointer-events-auto flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all hover:bg-black/90 hover:scale-110 shadow-xs"
            >
              <ChevronRight className="size-3 stroke-[2.5]" />
            </button>
          </div>
        )}

        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white z-10">
          {photos.length > 0 ? (
            <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold backdrop-blur-md">
              <Camera className="size-3 text-emerald-400" />
              <span>
                {(photoIndex % photos.length) + 1} of {photos.length}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-300">
              <ImageIcon className="size-3" />
              <span>Preset avatar</span>
            </div>
          )}
          <span className="sm:hidden rounded-md bg-white/90 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-900 shadow-2xs">
            {batch.batch_code}
          </span>
        </div>
      </div>

      {/* ── RIGHT CONTENT SECTION ── */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-3.5 space-y-2 min-w-0">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-slate-950 group-hover:text-emerald-800 transition-colors line-clamp-1">
                  {batch.batch_name || `${batch.livestock_type_name} Herd`}
                </h3>
                <span className="inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 border border-slate-200 shrink-0">
                  {batch.batch_code}
                </span>
              </div>
            </div>
            <div className="shrink-0">{getStatusBadge(batch.review_status)}</div>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
              <User className="size-3.5 shrink-0 text-slate-400" />
              <span>{batch.farmer_name}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="size-3.5 shrink-0 text-emerald-700" />
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
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold text-slate-700">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[9px] uppercase">Animals in Herd</span>
              <span className="text-slate-950 font-bold text-xs">
                {headCount} Heads
              </span>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center">
              <span className="block text-slate-500 text-[9px] uppercase">Avg Weight</span>
              <span className="text-slate-950 font-bold text-xs">
                {avgWeight ? `${avgWeight} kg` : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-slate-500">
            {photos.length > 0 ? `${photos.length} photo(s)` : "Preset avatar"}
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
              className="size-7 p-0 rounded-lg border-slate-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
              title="View Batch QR Clearance Pass"
            >
              <QrCode className="size-3.5" />
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className="h-7 px-2.5 rounded-lg text-xs font-bold bg-[#1E4D2B] hover:bg-emerald-800 text-white shadow-2xs flex items-center gap-1"
            >
              <Eye className="size-3" />
              <span>Inspect</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── MAIN CONTENT COMPONENT ──────────────────────────────────────────────────
function LivestockRecordsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showHistory = searchParams.get("history") === "true";
  const queryClient = useQueryClient();

  // Tab State: default 'herd' (Herd Registry) or 'individual' (Individual Animals)
  const initialTab = searchParams.get("tab") === "individual" ? "individual" : "herd";
  const [activeTab, setActiveTab] = useState<"herd" | "individual">(initialTab);

  // QR Scanner modal
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Sync tab with URL
  const handleTabChange = (tab: "herd" | "individual") => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`/livestock-records?${params.toString()}`, { scroll: false });
  };

  // View mode for herd registry (table or cards)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [barangayFilter, setBarangayFilter] = useState("ALL");
  const [speciesFilter, setSpeciesFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [quarterFilter, setQuarterFilter] = useState("ALL");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pagination States
  const [herdPage, setHerdPage] = useState(1);
  const [individualPage, setIndividualPage] = useState(1);
  const pageSize = 10;

  // Selected Detail Dialogs
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [isBatchCertificateOpen, setIsBatchCertificateOpen] = useState(false);
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [passportAnimal, setPassportAnimal] = useState<ChildAnimal | null>(null);

  // Individual Record Inspection & Review Modal (Enriched with CBAT & Farmer Notes)
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [selectedAnimalFallback, setSelectedAnimalFallback] = useState<Partial<AnimalReviewDetail> | null>(null);
  const [isAnimalReviewOpen, setIsAnimalReviewOpen] = useState(false);
  const [animalReviewMode, setAnimalReviewMode] = useState(false);

  // Reviewer notes
  const [batchNoteText, setBatchNoteText] = useState("");
  const [showBatchNotes, setShowBatchNotes] = useState(false);

  // ── Queries ──
  // 1. References (Species and Barangays)
  const references = useQuery<{ species: { name: string }[]; barangays: { barangay_name: string }[] }>({
    queryKey: ["admin-batch-filter-options"],
    queryFn: async () => {
      const [species, barangays] = await Promise.all([
        api.get("livestock/livestock_types/"),
        api.get("livestock/barangays/"),
      ]);
      return { species: species.data, barangays: barangays.data };
    },
    staleTime: 10 * 60 * 1000,
  });

  const barangayList = (references.data?.barangays || []).map((b) => b.barangay_name);
  const speciesList = (references.data?.species || []).map((s) => s.name);

  // Keep the all-herds total separate from the currently filtered herd table.
  const herdOverviewQuery = useQuery<{ summary?: { totalHerds?: number | null } }>({
    queryKey: ["admin-livestock-records-herd-overview"],
    queryFn: async ({ signal }) =>
      (await api.get("livestock/batches/", {
        params: { summary: "true", page: 1, page_size: 1 },
        signal,
      })).data,
    staleTime: 60 * 1000,
  });

  // 2. Herd Batches Query
  const batchParams = useMemo(() => ({
    summary: "true",
    page: herdPage,
    page_size: pageSize,
    search: debouncedSearch,
    species: speciesFilter !== "ALL" ? speciesFilter : undefined,
    review_status: statusFilter === "CBAT_VERIFIED"
      ? "VERIFIED"
      : statusFilter !== "ALL" ? statusFilter : undefined,
    reviewer_role: statusFilter === "CBAT_VERIFIED" ? "CBAT" : undefined,
    barangay: barangayFilter !== "ALL" ? barangayFilter : undefined,
  }), [herdPage, pageSize, debouncedSearch, speciesFilter, statusFilter, barangayFilter]);

  const {
    data: batchPageData,
    isLoading: isBatchLoading,
    refetch: refetchBatches,
    isFetching: isBatchFetching,
  } = useQuery<BatchPage>({
    queryKey: ["admin-batches-drilldown", batchParams],
    queryFn: async ({ signal }) => (await api.get("livestock/batches/", { params: batchParams, signal })).data,
    staleTime: 60 * 1000,
  });

  const batches = batchPageData?.results || [];
  const totalHerdsCount = batchPageData?.count || 0;

  // 3. Batch Detail Query for active herd
  const detailQuery = useQuery<BatchItem>({
    queryKey: ["admin-batch-detail", selectedBatch?.id],
    enabled: Boolean(selectedBatch?.id) && (isDrilldownOpen || isBatchCertificateOpen),
    queryFn: async ({ signal }) => (await api.get(`livestock/batches/${selectedBatch?.id}/`, { signal })).data,
    staleTime: 30 * 1000,
  });

  const activeBatch = detailQuery.data || selectedBatch;

  // 4. Individual Animals Query
  const {
    data: rawInventory = [],
    isLoading: isInventoryLoading,
    refetch: refetchInventory,
    isFetching: isInventoryFetching,
  } = useQuery<ValidationInventoryItem[]>({
    queryKey: ["admin-inventory-records"],
    queryFn: fetchAdminInventoryRecords,
    staleTime: 60 * 1000,
  });

  // Seamless Loading Screen State for initial mount
  const isInitialDataLoading =
    (isBatchLoading && !batchPageData) ||
    (isInventoryLoading && rawInventory.length === 0) ||
    (references.isLoading && !references.data);

  const { keepLoadingScreenMounted, showContent } = useSeamlessLoadingState(
    isInitialDataLoading,
    { exitDurationMs: 400, contentDelayMs: 150 }
  );

  // Filter individual animal records
  const individualAnimals = useMemo(() => {
    return rawInventory.filter((item) => !item.isBatch && item.entryType === "INDIVIDUAL"
      && (item.operationalStatus || "ACTIVE") === "ACTIVE");
  }, [rawInventory]);

  const filteredIndividualAnimals = useMemo(() => {
    const records = showHistory
      ? rawInventory.filter((item) => !item.isBatch && item.entryType === "INDIVIDUAL"
          && (item.operationalStatus || "ACTIVE") !== "ACTIVE")
      : individualAnimals;
    return records.filter((item) => {
      const q = debouncedSearch.toLowerCase();
      const matchSearch =
        !q ||
        item.tagNumber.toLowerCase().includes(q) ||
        item.farmerName.toLowerCase().includes(q) ||
        item.barangayName.toLowerCase().includes(q) ||
        item.breed.toLowerCase().includes(q) ||
        item.livestockType.toLowerCase().includes(q);

      const matchBarangay =
        barangayFilter === "ALL" ||
        item.barangayName.toLowerCase() === barangayFilter.toLowerCase();

      const matchSpecies =
        speciesFilter === "ALL" ||
        item.livestockType.toLowerCase() === speciesFilter.toLowerCase();

      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "APPROVED" && item.status === "APPROVED") ||
        (statusFilter === "CBAT_VERIFIED" && item.status === "VERIFIED" && item.reviewedByRole?.toUpperCase() === "CBAT") ||
        (statusFilter === "FOR_REVIEW" && (item.status === "PENDING" || item.status === "VERIFIED")) ||
        (statusFilter === "SUBJECT_TO_REVISION" &&
          (item.status === "SUBJECT_TO_REVISION" || item.status === "REJECTED")) ||
        item.status === statusFilter;

      return matchSearch && matchBarangay && matchSpecies && matchStatus;
    });
  }, [individualAnimals, rawInventory, showHistory, debouncedSearch, barangayFilter, speciesFilter, statusFilter]);

  // Paginated Individual Animals
  const paginatedIndividualAnimals = useMemo(() => {
    const start = (individualPage - 1) * pageSize;
    return filteredIndividualAnimals.slice(start, start + pageSize);
  }, [filteredIndividualAnimals, individualPage, pageSize]);

  const totalIndividualCount = filteredIndividualAnimals.length;
  const individualTotalPages = Math.max(1, Math.ceil(totalIndividualCount / pageSize));
  const herdTotalPages = Math.max(1, Math.ceil(totalHerdsCount / pageSize));

  // ── Overall KPI Calculations ──
  const kpis = useMemo(() => {
    const headCountFor = (items: ValidationInventoryItem[]) =>
      items.reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
    // The shared validation fetcher includes both animal records and herd
    // summary rows. Count inventory records only so each head is counted once.
    const totalAnimals = headCountFor(individualAnimals);
    const forReviewCount = headCountFor(
      individualAnimals.filter(
        (animal) => animal.entryType === "INDIVIDUAL" && animal.status === "VERIFIED",
      ),
    );
    const approvedCount = headCountFor(
      individualAnimals.filter(
        (animal) => animal.entryType === "INDIVIDUAL" && animal.status === "APPROVED",
      ),
    );

    return {
      totalHerds: herdOverviewQuery.data?.summary?.totalHerds ?? 0,
      totalAnimals,
      forReview: forReviewCount,
      approved: approvedCount,
    };
  }, [herdOverviewQuery.data, individualAnimals]);

  const openAnimalReview = (item: ValidationInventoryItem, reviewMode = false) => {
    const rawId = Number(item.rawId ?? item.id);
    setSelectedAnimalId(rawId);
    setSelectedAnimalFallback({
      id: rawId,
      tag_number: item.tagNumber,
      livestock_type_name: item.livestockType,
      breed: item.breed,
      sex: item.sex,
      weight: item.weight,
      status: item.status,
      farmer_name: item.farmerName,
      barangay_name: item.barangayName,
      last_vaccination_date: item.lastVaccinationDate,
      operational_status: item.operationalStatus,
      review_remarks: item.reviewRemarks,
      reviewed_by_name: item.reviewedBy,
      reviewed_by_role: item.reviewedByRole,
      reviewed_at: item.reviewedAt,
      created_at: item.createdAt,
      batch_code: item.batchCode,
      batch_name: item.batchName,
      photo_url: item.photoUrl,
    });
    setAnimalReviewMode(reviewMode);
    setIsAnimalReviewOpen(true);
  };

  // Sync tab with URL searchParams
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "individual" || tabParam === "herd") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const deepLinkedAnimalRef = React.useRef<string | null>(null);
  const deepLinkedBatchRef = React.useRef<string | null>(null);

  // Deep-linking for individual animal: ?tab=individual&recordId=123
  useEffect(() => {
    const recordId = searchParams.get("recordId");
    if (!recordId || isInventoryLoading || individualAnimals.length === 0) return;
    if (deepLinkedAnimalRef.current === recordId) return;

    const target = recordId.trim().toLowerCase();
    const found = individualAnimals.find((item) => {
      const rawId = String(item.rawId ?? item.id);
      return rawId === target || item.tagNumber?.toLowerCase() === target;
    });
    if (found) {
      deepLinkedAnimalRef.current = recordId;
      if (activeTab !== "individual") {
        setActiveTab("individual");
      }
      openAnimalReview(found, true);
    }
  }, [searchParams, individualAnimals, isInventoryLoading, activeTab]);

  // Deep-linking for herd batch: ?tab=herd&batchId=45
  useEffect(() => {
    const batchId = searchParams.get("batchId");
    if (!batchId || isBatchLoading || batches.length === 0) return;
    if (deepLinkedBatchRef.current === batchId) return;

    const target = batchId.trim().toLowerCase();
    const found = batches.find((batch) => {
      return String(batch.id) === target || batch.batch_code?.toLowerCase() === target;
    });
    if (found) {
      deepLinkedBatchRef.current = batchId;
      if (activeTab !== "herd") {
        setActiveTab("herd");
      }
      setSelectedBatch(found);
      setIsDrilldownOpen(true);
    }
  }, [searchParams, batches, isBatchLoading, activeTab]);

  const openChildAnimalReview = (animal: ChildAnimal, batch: BatchItem, reviewMode = false) => {
    setSelectedAnimalId(animal.id);
    setSelectedAnimalFallback({
      id: animal.id,
      tag_number: animal.tag_number,
      breed: animal.breed,
      sex: animal.sex,
      weight: animal.weight,
      status: animal.status,
      farmer_name: batch.farmer_name,
      barangay_name: batch.barangay_name,
      batch_code: batch.batch_code,
      batch_name: batch.batch_name,
      batch_housing_pen: batch.housing_pen,
      batch_feed_type: batch.feed_type,
      batch_target_weight: batch.target_weight,
      last_vaccination_date: animal.last_vaccination_date,
      photo_url: animal.photo_url,
      avatar_key: animal.avatar_key,
      review_remarks: animal.review_remarks,
      reviewed_by_name: animal.reviewed_by_name,
      reviewed_by_role: animal.reviewed_by_role,
      reviewed_at: animal.reviewed_at,
      created_at: animal.created_at,
    });
    setAnimalReviewMode(reviewMode);
    setIsAnimalReviewOpen(true);
  };

  // ── Notes Mutation ──
  const addBatchNoteMutation = useMutation({
    mutationFn: async ({ batchId, text }: { batchId: number; text: string }) => {
      const res = await api.post(`livestock/batches/${batchId}/notes/`, { text });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Note added to herd audit trail.");
      queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["admin-batch-detail", selectedBatch?.id] });
      setBatchNoteText("");
    },
    onError: () => toast.error("Failed to add note. Please try again."),
  });

  const getStatusBadge = (status?: string, reviewerRole?: string | null) => {
    const s = (status || "PENDING").toUpperCase();
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
          Approved
        </span>
      );
    }
    if (s === "VERIFIED") {
      const role = reviewerRole?.trim().toUpperCase();
      const label = !role || role === "CBAT" || role === "SIBAT" ? "CBAT Verified" : "Field Verified";
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
          <ShieldCheck className="w-3 h-3 text-sky-600" />
          {label}
        </span>
      );
    }
    if (s === "PENDING" || s === "FOR_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <Clock className="w-3 h-3 text-amber-600" />
          Pending Field Review
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Revision Required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
        For Review
      </span>
    );
  };

  const openDrilldown = (batch: BatchItem) => {
    setSelectedBatch(batch);
    setIsDrilldownOpen(true);
  };



  return (
    <>
      {/* ── Official Admin Header (matching Data Validation pattern) ── */}
      <PageHeader
        title="Livestock Management"
        subtitle="Official Municipal Agriculture Office (MAO) livestock registry, herd inspection, and animal tracking"
        variant="admin"
        maxWidthClass="w-full"
        icon={<CowIcon className="size-5" />}
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              className="bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 h-9 cursor-pointer"
            >
              <QrCode className="size-4" />
              <span>Scan Ear Tag / Pass</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchBatches();
                refetchInventory();
              }}
              disabled={isBatchFetching || isInventoryFetching}
              className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 gap-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(isBatchFetching || isInventoryFetching) ? "animate-spin text-emerald-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
      />

      {/* ── Main Workspace with Futuristic Background Pattern ── */}
      <div className="relative isolate min-h-[calc(100vh-8rem)] w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16 sm:pb-8">
        {/* Subtle futuristic grid background pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(rgba(16,185,129,0.14)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,#000_40%,transparent_100%)] opacity-70"
        />

        {(isInitialDataLoading || keepLoadingScreenMounted) && (
          <div className={`w-full ${showContent ? "absolute inset-0 z-30 pointer-events-none" : ""}`}>
            <ValidationLoadingScreen
              isLoading={isInitialDataLoading}
              title="Synchronizing Municipal Livestock Registry"
              subtitle="Retrieving official herd records, individual ear tag biometrics, barangay directories, and field verification ledgers..."
              badgeLabel="Livestock Registry Sync"
              authorityText="Municipal Agriculture Office • Padre Garcia, Batangas"
              items={[
                {
                  id: "batches",
                  label: "Herd Batches Registry",
                  sublabel: "Registered herd groups & biometric profiles",
                  icon: <Layers className="size-4 shrink-0 text-emerald-700" />,
                  loaded: !isBatchLoading && batchPageData !== undefined,
                },
                {
                  id: "individual",
                  label: "Individual Ear Tag Records",
                  sublabel: "Individual identification, breed & status",
                  icon: <Tag className="size-4 shrink-0 text-sky-700" />,
                  loaded: !isInventoryLoading && rawInventory.length > 0,
                },
                {
                  id: "references",
                  label: "Reference Metadata",
                  sublabel: "17 Padre Garcia barangays & species options",
                  icon: <MapPin className="size-4 shrink-0 text-purple-700" />,
                  loaded: !references.isLoading && references.data !== undefined,
                },
                {
                  id: "verification",
                  label: "Field Verification Ledger",
                  sublabel: "CBAT / SIBAT inspector audit trail",
                  icon: <ShieldCheck className="size-4 shrink-0 text-amber-700" />,
                  loaded: !herdOverviewQuery.isLoading && herdOverviewQuery.data !== undefined,
                },
              ]}
            />
          </div>
        )}

        {showContent && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both ease-out motion-reduce:animate-none">
            {/* ── 4 Futuristic KPI Summary Cards (matching Data Validation aesthetics) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Herds */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Total Herds
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono block mt-0.5">
                  {kpis.totalHerds}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                  Registered herds
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                <CowIcon className="w-6 h-6 text-emerald-700" />
              </div>
            </CardContent>
          </Card>

          {/* Total Animals */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-sky-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Registered Heads
                </span>
                <span className="text-2xl sm:text-3xl font-black text-sky-900 font-mono block mt-0.5">
                  {kpis.totalAnimals}
                </span>
                <span className="text-[10px] text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-md inline-block mt-1">
                  Across inventory records
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-sky-100 to-sky-50 text-sky-800 flex items-center justify-center shrink-0 border border-sky-200 shadow-2xs">
                <CowIcon className="w-6 h-6 text-sky-700" />
              </div>
            </CardContent>
          </Card>

          {/* For Review */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-amber-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  For Review
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-900 font-mono block mt-0.5">
                  {kpis.forReview}
                </span>
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md inline-flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  Verified by field staff
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 shadow-2xs">
                <Clock className="w-6 h-6 text-amber-700" />
              </div>
            </CardContent>
          </Card>

          {/* Approved */}
          <Card className="rounded-2xl border-slate-200/90 bg-white/95 backdrop-blur-xs shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block truncate">
                  Approved
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono block mt-0.5">
                  {kpis.approved}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
                  Approved animal heads
                </span>
              </div>
              <div className="size-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200 shadow-2xs">
                <Check className="w-6 h-6 text-emerald-700 stroke-[3]" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Top Navigation Tabs (Herd Registry & Individual Animals ONLY, no add button) ── */}
        <div className="flex items-center justify-between border-b border-slate-200/90 pb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleTabChange("herd")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "herd"
                  ? "bg-[#1E4D2B] text-white shadow-sm ring-1 ring-emerald-950/20"
                  : "bg-white/80 text-slate-700 hover:text-slate-950 hover:bg-white border border-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Herd Registry</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${activeTab === "herd" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {kpis.totalHerds}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("individual")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === "individual"
                  ? "bg-[#1E4D2B] text-white shadow-sm ring-1 ring-emerald-950/20"
                  : "bg-white/80 text-slate-700 hover:text-slate-950 hover:bg-white border border-slate-200"
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>{showHistory ? "Animal History" : "Individual Animals"}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${activeTab === "individual" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                {totalIndividualCount}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setIndividualPage(1);
                setStatusFilter("ALL");
                setActiveTab("individual");
                const params = new URLSearchParams(searchParams.toString());
                params.set("tab", "individual");
                if (showHistory) params.delete("history");
                else params.set("history", "true");
                router.replace(`/livestock-records?${params.toString()}`, { scroll: false });
              }}
            >
              {showHistory ? "Current animals" : "Animal history"}
            </Button>

            {/* View mode toggle when on herd registry */}
            {activeTab === "herd" && (
              <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    viewMode === "table"
                      ? "bg-[#1E4D2B] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    viewMode === "cards"
                      ? "bg-[#1E4D2B] text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Cards View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter Toolbar ── */}
        <div className="bg-white/95 backdrop-blur-xs p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="relative lg:col-span-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={
                  activeTab === "herd"
                    ? "Search herd code, farmer, or barangay..."
                    : "Search animal tag, farmer, or barangay..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 rounded-xl border-slate-200 text-xs focus-visible:ring-emerald-500 bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* Barangay Dropdown */}
            <div className="lg:col-span-2">
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50">
                  <SelectValue placeholder="All Barangays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Barangays</SelectItem>
                  {barangayList.map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Species Dropdown */}
            <div className="lg:col-span-2">
              <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50">
                  <SelectValue placeholder="All Species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Species</SelectItem>
                  {speciesList.map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {sp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Dropdown */}
            <div className="lg:col-span-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="CBAT_VERIFIED">CBAT Verified</SelectItem>
                  <SelectItem value="FOR_REVIEW">For Review</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Revision Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quarter Dropdown */}
            <div className="lg:col-span-2">
              <Select value={quarterFilter} onValueChange={setQuarterFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-semibold bg-slate-50/50">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0" />
                  <SelectValue placeholder="All Quarters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Quarters</SelectItem>
                  <SelectItem value="Q1">Q1 2026</SelectItem>
                  <SelectItem value="Q2">Q2 2026</SelectItem>
                  <SelectItem value="Q3">Q3 2026</SelectItem>
                  <SelectItem value="Q4">Q4 2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Clear Button */}
          {(debouncedSearch || barangayFilter !== "ALL" || speciesFilter !== "ALL" || statusFilter !== "ALL" || quarterFilter !== "ALL") && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-medium">Active filters applied</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setBarangayFilter("ALL");
                  setSpeciesFilter("ALL");
                  setStatusFilter("ALL");
                  setQuarterFilter("ALL");
                }}
                className="h-6 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 rounded-lg"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>

        {/* ── TAB 1: HERD REGISTRY ── */}
        {activeTab === "herd" && (
          <>
            {isBatchLoading ? (
              <div className="p-12 text-center bg-white/95 rounded-2xl border border-slate-200 shadow-2xs">
                <RefreshCw className="w-7 h-7 mx-auto text-emerald-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-800">Loading Herd Registry...</p>
              </div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center bg-white/95 rounded-2xl border border-slate-200 shadow-2xs">
                <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-base font-bold text-slate-800">
                  {statusFilter === "CBAT_VERIFIED" ? "No CBAT-verified herds found" : "No herds found"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {statusFilter === "CBAT_VERIFIED"
                    ? "No herds with animals verified by a CBAT match these filters. SIBAT-verified animals are not included."
                    : "No herd records matched your active search query or filter criteria."}
                </p>
              </div>
            ) : viewMode === "cards" ? (
              /* Cards View */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {batches.map((batch) => (
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

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white/95 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">
                    Showing {(herdPage - 1) * pageSize + 1}–{Math.min(herdPage * pageSize, totalHerdsCount)} of {totalHerdsCount} herds
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={herdPage <= 1}
                      onClick={() => setHerdPage((p) => p - 1)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, herdTotalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setHerdPage(pageNum)}
                          className={`size-8 rounded-lg text-xs font-bold transition-all ${
                            herdPage === pageNum
                              ? "bg-[#1E4D2B] text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={herdPage >= herdTotalPages}
                      onClick={() => setHerdPage((p) => p + 1)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Table View (Matching Mockup) */
              <div className="bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/90">
                      <TableRow>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Herd Code
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Farmer / Owner
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Barangay
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Species
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3 text-center">
                          No. of Heads
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {batches.map((batch) => {
                        const headCount = batch.total_animals || batch.animals?.length || 0;
                        return (
                          <TableRow
                            key={batch.id}
                            className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                            onClick={() => openDrilldown(batch)}
                          >
                            <TableCell className="font-mono text-xs font-bold text-slate-900 px-4 py-3.5">
                              {batch.batch_code}
                            </TableCell>
                            <TableCell className="font-bold text-slate-800 text-xs px-4 py-3.5">
                              {batch.farmer_name}
                            </TableCell>
                            <TableCell className="px-4 py-3.5">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                                <span>{batch.barangay_name || "Padre Garcia"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3.5">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                                {batch.livestock_type_name}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-bold text-xs text-slate-800 px-4 py-3.5">
                              {headCount}
                            </TableCell>
                            <TableCell className="px-4 py-3.5">
                              {getStatusBadge(batch.review_status || batch.status)}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDrilldown(batch)}
                                  className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="View Herd Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedBatch(batch);
                                    setIsBatchCertificateOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 rounded-lg text-emerald-700 hover:bg-emerald-50"
                                  title="View QR Clearance Pass"
                                >
                                  <QrCode className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Bottom Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs">
                  <span className="text-slate-500 font-medium">
                    Showing {(herdPage - 1) * pageSize + 1}–{Math.min(herdPage * pageSize, totalHerdsCount)} of {totalHerdsCount} herds
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={herdPage <= 1}
                      onClick={() => setHerdPage((p) => p - 1)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, herdTotalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setHerdPage(pageNum)}
                          className={`size-8 rounded-lg text-xs font-bold transition-all ${
                            herdPage === pageNum
                              ? "bg-[#1E4D2B] text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={herdPage >= herdTotalPages}
                      onClick={() => setHerdPage((p) => p + 1)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: INDIVIDUAL ANIMALS ── */}
        {activeTab === "individual" && (
          <div className="bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <p className="px-4 py-3 text-sm text-slate-600 border-b border-slate-100">
              {showHistory ? "Sold, deceased, slaughtered, and moved-out animals are preserved here and excluded from current population. A buyer registers acquired livestock for approval before it counts again." : "Current animals only. Inactive livestock is available in Animal history."}
            </p>
            {isInventoryLoading ? (
              <div className="p-12 text-center">
                <RefreshCw className="w-7 h-7 mx-auto text-emerald-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-800">Loading Individual Animal Records...</p>
              </div>
            ) : filteredIndividualAnimals.length === 0 ? (
              <div className="p-12 text-center">
                <Tag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-base font-bold text-slate-800">
                  {statusFilter === "CBAT_VERIFIED" ? "No CBAT-verified animals found" : "No individual animals found"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {statusFilter === "CBAT_VERIFIED"
                    ? "No individual records verified by a CBAT match these filters. SIBAT-verified animals are not included."
                    : "No individual animal records matched your active search query or filter criteria."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/90">
                      <TableRow>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Animal Tag &amp; Specie
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Farmer / Raiser
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Barangay
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Breed &amp; Sex
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Weight (kg)
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Last Vaccination
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-wider text-slate-500 px-4 py-3 text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {paginatedIndividualAnimals.map((item) => (
                        <TableRow
                          key={item.id}
                          className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                          onClick={() => openAnimalReview(item, false)}
                        >
                          <TableCell className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-blue-700 font-mono">
                                {item.tagNumber}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.livestockType}
                              </span>
                              {showHistory && <Badge variant="outline">{item.operationalStatus?.replaceAll("_", " ")}</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-slate-800 text-xs px-4 py-3.5">
                            {item.farmerName}
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-[#2D5A27] shrink-0" />
                              <span>{item.barangayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <div className="flex flex-col text-xs">
                              <span className="font-bold text-slate-800">{item.breed}</span>
                              <span className="text-[11px] text-slate-500">{item.sex}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-black text-xs text-slate-800 px-4 py-3.5">
                            {item.weight ? `${item.weight} kg` : "—"}
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-600 px-4 py-3.5">
                            {item.lastVaccinationDate || "No record"}
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                          {getStatusBadge(item.status, item.reviewedByRole)}
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {!showHistory && item.status === "VERIFIED" && item.entryType === "INDIVIDUAL" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAnimalReview(item, true);
                                  }}
                                  className="h-8 px-2 rounded-lg text-xs font-bold text-emerald-800 hover:bg-emerald-50 gap-1 cursor-pointer"
                                  title="Review field-verified animal (CBAT & Farmer notes)"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">Review</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAnimalReview(item, false);
                                }}
                                className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                title="Inspect Animal Details, Notes & History"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Individual Animals Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs">
                  <span className="text-slate-500 font-medium">
                    Showing {(individualPage - 1) * pageSize + 1}–{Math.min(individualPage * pageSize, totalIndividualCount)} of {totalIndividualCount} animals
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={individualPage <= 1}
                      onClick={() => setIndividualPage((p) => p - 1)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, individualTotalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setIndividualPage(pageNum)}
                          className={`size-8 rounded-lg text-xs font-bold transition-all ${
                            individualPage === pageNum
                              ? "bg-[#1E4D2B] text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={individualPage >= individualTotalPages}
                      onClick={() => setIndividualPage((p) => p + 1)}
                      className="h-8 px-2.5 rounded-lg text-xs font-bold"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
          </div>
        )}

        {/* ── HERD DRILLDOWN INSPECTION DIALOG ── */}
        <Dialog open={isDrilldownOpen} onOpenChange={setIsDrilldownOpen}>
          <DialogContent className="w-full max-w-[98vw] sm:max-w-5xl md:max-w-6xl rounded-2xl sm:rounded-3xl bg-white p-0 overflow-hidden shadow-2xl border-slate-200 max-h-[94vh] flex flex-col">
            {detailQuery.isLoading && !activeBatch ? (
              <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <RefreshCw className="size-6 text-emerald-700 animate-spin" />
                <DialogTitle className="text-base font-bold text-slate-900">Loading herd details...</DialogTitle>
              </div>
            ) : activeBatch && (
              <div className="flex flex-col max-h-[94vh]">
                {/* Modal Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white border-b border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pr-12">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {activeBatch.livestock_type_name} Herd
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-200">
                        {activeBatch.batch_code}
                      </span>
                      {getStatusBadge(activeBatch.review_status)}
                    </div>
                    <DialogTitle className="text-lg sm:text-xl font-black text-white">
                      {activeBatch.batch_name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-emerald-200/80 flex items-center gap-2 flex-wrap">
                      <span>Farmer: <strong>{activeBatch.farmer_name}</strong></span>
                      <span>•</span>
                      <span>Barangay: <strong>{activeBatch.barangay_name}</strong></span>
                      <span>•</span>
                      <span>Enrolled: <strong>{activeBatch.animals?.length || activeBatch.total_animals} Heads</strong></span>
                    </DialogDescription>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchCertificateOpen(true)}
                    className="h-8.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border-emerald-400/40 text-xs font-bold gap-1.5 shadow-xs"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Batch QR Pass</span>
                  </Button>
                </div>

                {/* Husbandry & Pen Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Housing Facility</span>
                    <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">{activeBatch.housing_pen || "Standard Pen"}</p>
                    <p className="text-[10px] text-slate-500 truncate">Feed: {activeBatch.feed_type || "—"}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Average Weight</span>
                    <p className="font-bold text-emerald-800 text-xs mt-0.5">{activeBatch.average_weight ? `${activeBatch.average_weight} kg` : "N/A"}</p>
                    <p className="text-[10px] text-slate-500">Target: {activeBatch.target_weight ? `${activeBatch.target_weight} kg` : "Unspecified"}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Target Harvest Date</span>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">{activeBatch.target_harvest_date || "Open Schedule"}</p>
                    <p className="text-[10px] text-slate-500">Registered: {activeBatch.created_at?.split("T")[0]}</p>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Roster Verification</span>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {activeBatch.approved_animals ?? 0} approved / {activeBatch.animals?.length || activeBatch.total_animals} total
                    </p>
                    <p className="text-[10px] text-slate-500">{activeBatch.verified_animals ?? 0} verified by SIBAT</p>
                  </div>
                </div>

                {/* Reviewer Notes Accordion */}
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBatchNotes(!showBatchNotes)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-emerald-700" />
                      Reviewer Notes &amp; Audit Trail
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showBatchNotes ? "rotate-180" : ""}`} />
                  </button>
                  {showBatchNotes && (
                    <div className="mt-2 space-y-2">
                      <pre className="text-[11px] text-slate-600 font-sans whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded-xl p-2.5 max-h-24 overflow-y-auto">
                        {activeBatch.notes || "No notes recorded for this batch yet."}
                      </pre>
                      <div className="flex gap-2">
                        <Textarea
                          value={batchNoteText}
                          onChange={(e) => setBatchNoteText(e.target.value)}
                          placeholder="Add an official note..."
                          className="h-12 text-xs rounded-xl border-slate-200"
                        />
                        <Button
                          size="sm"
                          disabled={addBatchNoteMutation.isPending || !batchNoteText.trim()}
                          onClick={() => addBatchNoteMutation.mutate({ batchId: activeBatch.id, text: batchNoteText.trim() })}
                          className="h-12 rounded-xl text-xs font-bold bg-emerald-700 text-white shrink-0"
                        >
                          Add Note
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Child Animals Roster Table */}
                <div className="flex-1 overflow-y-auto p-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Enrolled Animals Roster ({activeBatch.animals?.length || 0})
                  </h4>
                  {(!activeBatch.animals || activeBatch.animals.length === 0) ? (
                    <div className="p-8 text-center border rounded-xl bg-slate-50 text-slate-500 text-xs">
                      No individual animal records found in this herd.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 py-2">Tag Number</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 py-2">Breed &amp; Sex</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 py-2">Weight</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 py-2">Last Vaccination</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 py-2">Status</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-500 px-3 py-2 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-y divide-slate-100">
                          {activeBatch.animals.map((animal) => (
                            <TableRow
                              key={animal.id}
                              className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                              onClick={() => openChildAnimalReview(animal, activeBatch, false)}
                            >
                              <TableCell className="font-mono text-xs font-bold text-blue-700 px-3 py-2">
                                {animal.tag_number}
                              </TableCell>
                              <TableCell className="text-xs px-3 py-2">
                                {animal.breed} • {animal.sex}
                              </TableCell>
                              <TableCell className="text-xs font-bold px-3 py-2">
                                {animal.weight ? `${animal.weight} kg` : "—"}
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 px-3 py-2">
                                {animal.last_vaccination_date || "Up to date"}
                              </TableCell>
                              <TableCell className="px-3 py-2">
                                {getStatusBadge(animal.status, animal.reviewed_by_role)}
                              </TableCell>
                              <TableCell className="px-3 py-2 text-right">
                                <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  {animal.status === "VERIFIED" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openChildAnimalReview(animal, activeBatch, true)}
                                      className="h-7 px-2 rounded-lg text-[10px] font-bold text-emerald-800 hover:bg-emerald-50 gap-1 cursor-pointer"
                                      title="Review field-verified animal (CBAT & Farmer notes)"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Review</span>
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setPassportAnimal(animal);
                                      setIsPassportOpen(true);
                                    }}
                                    className="h-7 px-2 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100 gap-1 cursor-pointer"
                                  >
                                    <QrCode className="w-3 h-3 text-emerald-700" />
                                    <span>Passport</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <DialogFooter className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDrilldownOpen(false)}
                    className="rounded-xl font-bold text-xs"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── BATCH QR CLEARANCE PASS MODAL ── */}
        <Dialog open={isBatchCertificateOpen} onOpenChange={setIsBatchCertificateOpen}>
          <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200 max-h-[92vh] overflow-y-auto">
            <DialogHeader className="sr-only">
              <DialogTitle>Batch QR Clearance Pass</DialogTitle>
              <DialogDescription>Biosecurity &amp; Movement Clearance Pass</DialogDescription>
            </DialogHeader>

            {activeBatch && (
              <div className="space-y-4">
                <QrCodePass
                  code={activeBatch.batch_code}
                  qrPayload={livestockBatchQrPayload(activeBatch.id)}
                  title={`Batch ${activeBatch.batch_name}`}
                  subtitle="Livestock batch identity · check current status in SmartLivestock"
                  ownerName={activeBatch.farmer_name}
                  barangay={activeBatch.barangay_name}
                  specie={activeBatch.livestock_type_name}
                  headCount={activeBatch.animals?.length || activeBatch.total_animals}
                  status={activeBatch.review_status || activeBatch.status || "PENDING"}
                  verifiedAt={activeBatch.reviewed_at ? activeBatch.reviewed_at.slice(0, 10) : undefined}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsBatchCertificateOpen(false)}
                    className="rounded-xl text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── ANIMAL PASSPORT MODAL ── */}
        <Dialog open={isPassportOpen} onOpenChange={setIsPassportOpen}>
          <DialogContent className="w-full max-w-md rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200">
            <DialogHeader className="sr-only">
              <DialogTitle>Animal Passport</DialogTitle>
              <DialogDescription>Livestock Identity &amp; Biosecurity Record</DialogDescription>
            </DialogHeader>

            {passportAnimal && activeBatch && (
              <div className="space-y-3">
                <div className="text-center pb-2 border-b border-slate-100">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    Biosecurity Tag Passport
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">
                    Tag #{passportAnimal.tag_number}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeBatch.livestock_type_name} • {passportAnimal.breed} • {passportAnimal.sex}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Owner:</span>
                    <span className="font-bold text-slate-900">{activeBatch.farmer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Barangay:</span>
                    <span className="font-bold text-slate-900">{activeBatch.barangay_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Weight:</span>
                    <span className="font-bold text-slate-900">{passportAnimal.weight ? `${passportAnimal.weight} kg` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vaccination:</span>
                    <span className="font-bold text-emerald-700">{passportAnimal.last_vaccination_date || "Up to date"}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPassportOpen(false)}
                    className="rounded-xl text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── ENRICHED INDIVIDUAL ANIMAL REVIEW & INSPECTION MODAL ── */}
        <IndividualAnimalReviewModal
          open={isAnimalReviewOpen}
          onOpenChange={setIsAnimalReviewOpen}
          animalId={selectedAnimalId}
          fallbackItem={selectedAnimalFallback}
          defaultToReviewMode={animalReviewMode}
          onReviewSuccess={() => {
            refetchBatches();
            refetchInventory();
          }}
        />

        {/* ── UNIVERSAL QR SCANNER DIALOG ── */}
        <UniversalQrScannerDialog
          isOpen={isScannerOpen}
          onOpenChange={setIsScannerOpen}
          role="admin"
        />
      </div>
    </>
  );
}

// ── DEFAULT EXPORT WITH SUSPENSE BOUNDARY ───────────────────────────────────
export default function LivestockRecordsPage() {
  return (
    <Suspense fallback={<LivestockRecordsLoading />}>
      <LivestockRecordsContent />
    </Suspense>
  );
}
