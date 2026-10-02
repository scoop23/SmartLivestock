"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import api from "@/lib/axios";
import { PageHeader } from "@/app/components/page-header";
import { QrCodePass } from "@/components/qr-code-pass";
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
} from "lucide-react";
import { PADRE_GARCIA_BARANGAYS } from "../../admin/admin-charts";
import { getDefaultAvatarForSpecies } from "@/app/(farmer)/livestock-inventory/livestock-inventory";

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
  housing_pen: string;
  feed_type: string;
  target_weight: number | string | null;
  target_harvest_date?: string | null;
  status: string;
  notes?: string;
  enrolled_animals?: number;
  verified_animals?: number;
  total_animals: number;
  average_weight: number | string | null;
  animals: ChildAnimal[];
  review_status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED";
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface BatchPage {
  count: number;
  results: BatchItem[];
  summary: { totalAnimals: number | null; approvedBatches: number; pendingBatches: number; verifiedBatches: number; revisionBatches: number };
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

function AdminBatchesDrilldownContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const batchIdParam = searchParams.get("batchId") || searchParams.get("id");

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
  const [animalSearchQuery, setAnimalSearchQuery] = useState("");
  const [animalStatusFilter, setAnimalStatusFilter] = useState<string>("ALL");

  // Review confirmation modals
  const [batchReviewModal, setBatchReviewModal] = useState<{
    open: boolean;
    batch: BatchItem | null;
    action: "APPROVED" | "SUBJECT_TO_REVISION";
  }>({ open: false, batch: null, action: "APPROVED" });
  const [reviewRemarks, setReviewRemarks] = useState("");



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
  const detailId = selectedBatch?.id || (batchIdParam && /^\d+$/.test(batchIdParam) ? Number(batchIdParam) : null);
  const detailQuery = useQuery<BatchItem>({
    queryKey: ["admin-batch-detail", detailId],
    enabled: !!detailId && (isDrilldownOpen || isBatchCertificateOpen || !!batchIdParam),
    queryFn: async ({ signal }) => (await api.get(`livestock/batches/${detailId}/`, { signal })).data,
    staleTime: 30 * 1000,
  });
  useEffect(() => {
    if (detailQuery.data) {
      setSelectedBatch(detailQuery.data);
      if (batchIdParam) setIsDrilldownOpen(true);
    }
  }, [detailQuery.data, batchIdParam]);
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
    approvedBatches: batchPageData?.summary.approvedBatches || 0,
    pendingBatches: batchPageData?.summary.pendingBatches || 0,
    verifiedBatches: batchPageData?.summary.verifiedBatches || 0,
    revisionBatches: batchPageData?.summary.revisionBatches || 0,
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

  useEffect(() => {
    setAnimalPage(1);
  }, [selectedBatch?.id, animalSearchQuery, animalStatusFilter]);

  useEffect(() => {
    if (animalPage > pageCountAnimals) setAnimalPage(pageCountAnimals);
  }, [animalPage, pageCountAnimals]);

  // ── Mutations: Batch Review ──────────────────────────────────────────────
  const reviewBatchMutation = useMutation({
    mutationFn: async ({
      batchId,
      status,
      remarks,
    }: {
      batchId: number;
      status: "APPROVED" | "SUBJECT_TO_REVISION";
      remarks: string;
    }) => {
      const res = await api.post(`livestock/batches/${batchId}/review/`, {
        status,
        remarks,
      });
      return res.data;
    },
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["sibat-batches-drilldown"] }),
        queryClient.cancelQueries({ queryKey: ["admin-batches-drilldown"] }),
      ]);
      const previousSibat = queryClient.getQueryData<BatchItem[]>(["sibat-batches-drilldown"]);
      const previousAdmin = queryClient.getQueriesData<BatchPage>({ queryKey: ["admin-batches-drilldown"] });
      const previousSelected = selectedBatch;
      const previousModal = batchReviewModal;
      const updateBatch = (batch: BatchItem): BatchItem =>
        batch.id === variables.batchId
          ? {
              ...batch,
              review_status: variables.status,
              review_remarks: variables.remarks,
              animals: (batch.animals || []).map((animal) => ({
                ...animal,
                status: variables.status,
                review_remarks: variables.remarks,
              })),
            }
          : batch;
      queryClient.setQueryData<BatchItem[]>(["sibat-batches-drilldown"], (current) => current?.map(updateBatch));
      queryClient.setQueriesData<BatchPage>({ queryKey: ["admin-batches-drilldown"] }, (current) => current ? { ...current, results: current.results.map(updateBatch) } : current);
      setSelectedBatch((current) => current ? updateBatch(current) : null);
      setBatchReviewModal((current) => ({ ...current, open: false }));
      return { previousSibat, previousAdmin, previousSelected, previousModal };
    },
    onSuccess: (data, variables) => {
      if (data.batch) {
        setSelectedBatch(data.batch);
        queryClient.setQueryData(["admin-batch-detail", variables.batchId], data.batch);
      }
      const verb =
        variables.status === "APPROVED"
          ? "approved & certified"
          : "returned for revision";
      toast.success(`Batch ${selectedBatch?.batch_code || ""} ${verb}!`, {
        description: `All child animals in this herd updated to ${variables.status}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      setBatchReviewModal({ open: false, batch: null, action: "APPROVED" });
      setReviewRemarks("");
    },
    onError: (err, _variables, context) => {
      if (context?.previousSibat) {
        queryClient.setQueryData(["sibat-batches-drilldown"], context.previousSibat);
      }
      if (context?.previousAdmin) {
        for (const [key, value] of context.previousAdmin) queryClient.setQueryData(key, value);
      }
      setSelectedBatch(context?.previousSelected ?? null);
      if (context?.previousModal) setBatchReviewModal(context.previousModal);
      console.error("Batch review failed:", err);
      toast.error("Failed to update batch review status. Please try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] });
    },
  });

  // ── Mutations: Reviewer Notes (append-only audit trail) ──────────────────
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
    if (s === "APPROVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          MAO Approved
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

  return (
    <>
      <PageHeader
        title="Municipal Herd Validation"
        subtitle="Official MAO inspection center: review complete livestock herds and drill down into individual ear tags"
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
                MAO Certified Batches
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-700 font-mono">
                  {kpis.approvedBatches}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">Fully validated & sealed</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Pending Municipal Review
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${kpis.pendingBatches > 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {kpis.pendingBatches}
                </span>
                <Clock className={`w-4 h-4 ${kpis.pendingBatches > 0 ? "text-amber-600" : "text-slate-400"}`} />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">Awaiting MAO stamp</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-all col-span-2 sm:col-span-1">
            <CardContent className="p-3.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                SIBAT Field Verified
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-sky-700 font-mono">
                  {kpis.verifiedBatches}
                </span>
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-[10px] text-slate-500 mt-1 truncate">Cooperative verified</p>
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

            {/* Review Status Dropdown */}
            <div className="lg:col-span-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 rounded-xl border-slate-200 text-xs font-medium">
                  <SelectValue placeholder="Review Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="APPROVED">MAO Approved ({kpis.approvedBatches})</SelectItem>
                  <SelectItem value="PENDING">Awaiting SIBAT ({kpis.pendingBatches})</SelectItem>
                  <SelectItem value="VERIFIED">SIBAT Verified ({kpis.verifiedBatches})</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Revision Required ({kpis.revisionBatches})</SelectItem>
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
            <p className="text-xs text-slate-500 mt-1">Retrieving 99 batches and individual animal rosters from backend</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {pagedBatches.map((batch) => {
              const headCount = batch.total_animals || batch.animals?.length || 0;
              const avgWeight = batch.average_weight ? Number(batch.average_weight) : null;
              const sibatCheckedCount = batch.verified_animals ?? (batch.animals || []).filter((animal) =>
                ["VERIFIED", "APPROVED"].includes((animal.status || "").toUpperCase()),
              ).length;
              const verificationProgress =
                headCount > 0 ? Math.round((sibatCheckedCount / headCount) * 100) : 0;
              const isReadyForMao = batch.review_status === "VERIFIED";

              return (
                <Card
                  key={batch.id}
                  className="group overflow-hidden rounded-2xl border-slate-200 bg-white shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col"
                >
                  <CardHeader className="p-3.5 pb-2.5 min-h-[88px]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider border ${getSpeciesColor(
                            batch.livestock_type_name
                          )}`}
                        >
                          {batch.livestock_type_name || "Livestock"}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] font-black text-slate-600 border-slate-200 bg-slate-50"
                        >
                          {batch.batch_code}
                        </Badge>
                      </div>
                      {getStatusBadge(batch.review_status)}
                    </div>

                    <CardTitle className="text-sm font-black text-slate-900 mt-1.5 truncate">
                      {batch.batch_name || `${batch.livestock_type_name} Herd`}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="font-bold text-slate-700 truncate">{batch.farmer_name}</span>
                      <span>•</span>
                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{batch.barangay_name || "Padre Garcia"}</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-3.5 pt-0 space-y-2.5 flex flex-1 flex-col">
                    <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 px-2 py-2">
                      <div className="px-1.5">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">
                          Herd Size
                        </span>
                        <p className="text-sm leading-none font-black text-slate-900 mt-1">
                          {headCount}
                          <span className="text-[8px] font-bold text-slate-500 ml-1">heads</span>
                        </p>
                      </div>
                      <div className="px-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">
                          Verified
                        </span>
                        <p className="text-sm leading-none font-black text-sky-800 mt-1">
                          {sibatCheckedCount}
                          <span className="text-[8px] font-bold text-slate-500 ml-1">of {headCount}</span>
                        </p>
                      </div>
                      <div className="px-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">
                          Avg Weight
                        </span>
                        <p className="text-sm leading-none font-black text-slate-900 mt-1">
                          {avgWeight ? `${avgWeight} kg` : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-500">
                          SIBAT verification - {sibatCheckedCount}/{headCount} animals
                        </span>
                        <span className={`text-[9px] font-black ${isReadyForMao ? "text-emerald-700" : "text-sky-700"}`}>
                          {verificationProgress}%
                        </span>
                      </div>
                      <Progress
                        value={verificationProgress}
                        className={`h-1.5 bg-slate-100 ${
                          batch.review_status === "APPROVED"
                            ? "[&>div]:bg-emerald-600"
                            : "[&>div]:bg-sky-600"
                        }`}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[9px]">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-600 capitalize">
                        <Building2 className="size-3 text-slate-400" />
                        {batch.housing_pen || "General Pen"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-600 capitalize">
                        <Activity className="size-3 text-slate-400" />
                        {batch.feed_type || "—"}
                      </span>
                    </div>

                    <div
                      className={`h-9 px-2.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
                        batch.review_remarks
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      <Info className={`size-3.5 shrink-0 ${batch.review_remarks ? "text-amber-600" : "text-slate-300"}`} />
                      <span className="line-clamp-1">
                        {batch.review_remarks || "No review remarks"}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-[1fr_auto] gap-1.5 pt-2 border-t border-slate-100 mt-auto">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedBatch(batch);
                          setIsDrilldownOpen(true);
                        }}
                        className="h-8 rounded-lg bg-slate-900 hover:bg-emerald-800 text-white font-bold text-[10px] gap-1.5 shadow-2xs"
                      >
                        <Eye className="size-3.5" />
                        Inspect herd
                        <ChevronRight className="size-3.5 ml-auto" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBatch(batch);
                          setIsBatchCertificateOpen(true);
                        }}
                        className="size-8 p-0 rounded-lg border-slate-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                        title="View Batch QR Clearance Pass"
                      >
                        <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                      </Button>

                      {batch.review_status !== "APPROVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isReadyForMao}
                          onClick={() => {
                            setBatchReviewModal({
                              open: true,
                              batch: batch,
                              action: "APPROVED",
                            });
                          }}
                          className="col-span-2 h-8 rounded-lg border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 text-[10px] font-bold disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                          title={
                            isReadyForMao
                              ? "Approve this SIBAT-verified herd"
                              : "Every animal must be SIBAT verified before herd approval"
                          }
                        >
                          {isReadyForMao ? (
                            <>
                              <ShieldCheck className="size-3.5" />
                              Approve verified herd
                            </>
                          ) : (
                            <>
                              <Clock className="size-3.5" />
                              Awaiting SIBAT verification
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="col-span-2 h-8 rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-bold disabled:opacity-100"
                        >
                          <CheckCircle2 className="size-3.5" />
                          Herd approved
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                                setSelectedBatch(batch);
                                setIsDrilldownOpen(true);
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
          if (!open && batchIdParam) {
            router.replace("/data-validation/batches", { scroll: false });
          }
        }}
      >
        <DialogContent className="w-full max-w-[98vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-[1440px] rounded-2xl sm:rounded-3xl bg-white p-0 overflow-hidden shadow-2xl border-slate-200 max-h-[94vh] flex flex-col">
          {selectedBatch && (
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
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    MAO Herd Action
                  </span>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 mt-1">
                    <Button
                      size="sm"
                      disabled={selectedBatch.review_status !== "VERIFIED"}
                      title={
                        selectedBatch.review_status === "VERIFIED"
                          ? "Approve all SIBAT-verified animals in this herd"
                          : "Every animal must be SIBAT verified before herd approval"
                      }
                      onClick={() =>
                        setBatchReviewModal({
                          open: true,
                          batch: selectedBatch,
                          action: "APPROVED",
                        })
                      }
                      className="h-6 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px] disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed w-full sm:w-auto truncate"
                    >
                      {selectedBatch.review_status === "VERIFIED" ? "Approve All" : "Awaiting SIBAT"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setBatchReviewModal({
                          open: true,
                          batch: selectedBatch,
                          action: "SUBJECT_TO_REVISION",
                        })
                      }
                      className="h-6 px-2 rounded-lg border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-[10px] w-full sm:w-auto"
                    >
                      Revision
                    </Button>
                  </div>
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

                  <div className="flex items-center gap-2 w-full sm:w-auto">
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
                          <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-400">
                            No individual animals found matching filter criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedChildAnimals.map((animal) => {
                          const avatar = getDefaultAvatarForSpecies(selectedBatch.livestock_type_name);
                          const animalWeight = animal.weight ? Number(animal.weight) : null;
                          const batchAvg = selectedBatch.average_weight ? Number(selectedBatch.average_weight) : null;
                          const weightDiff = animalWeight && batchAvg ? (animalWeight - batchAvg).toFixed(1) : null;

                          return (
                            <TableRow key={animal.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Tag Number */}
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`size-8 rounded-xl flex items-center justify-center text-sm border shadow-2xs shrink-0 ${avatar.bgGradient}`}
                                  >
                                    {avatar.emoji}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-black text-xs text-slate-900">
                                        {animal.tag_number || `#${animal.id}`}
                                      </span>
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
                              <TableCell>{getStatusBadge(animal.status)}</TableCell>

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

                                  {animal.status === "VERIFIED" ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      title="Herd animals share one review status. Use the batch-level Approve / Return to Revision actions in the batch card above."
                                      className="h-7 px-2 rounded-lg text-slate-500 font-bold text-[10px] disabled:opacity-100"
                                    >
                                      Batch review only
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      className="h-7 px-2 rounded-lg text-slate-500 font-bold text-[10px] disabled:opacity-100"
                                    >
                                      {animal.status === "APPROVED"
                                        ? "Approved"
                                        : animal.status === "SUBJECT_TO_REVISION"
                                          ? "Revision requested"
                                          : "Awaiting SIBAT"}
                                    </Button>
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

      {/* ──────────────────────────────────────────────────────────────────────────
          BATCH REVIEW CONFIRMATION MODAL
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={batchReviewModal.open}
        onOpenChange={(open) => {
          if (!open) setBatchReviewModal({ open: false, batch: null, action: "APPROVED" });
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg md:max-w-xl rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              {batchReviewModal.action === "APPROVED" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Approve Herd &amp; All Heads
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  Request Herd Revision
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {batchReviewModal.action === "APPROVED"
                ? `You are certifying ${batchReviewModal.batch?.batch_code} containing ${batchReviewModal.batch?.total_animals || batchReviewModal.batch?.animals?.length || 0
                } heads. All animals will be marked as MAO APPROVED.`
                : `Specify corrective instructions for farmer ${batchReviewModal.batch?.farmer_name}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Official Review Remarks (Optional for approval, recommended for revision)
              </label>
              <Textarea
                placeholder={
                  batchReviewModal.action === "APPROVED"
                    ? "e.g. Ear tags, breed consistency, and health credentials validated."
                    : "e.g. Please clarify housing ventilation and update vaccination logs."
                }
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                className="text-xs rounded-xl border-slate-200"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBatchReviewModal({ open: false, batch: null, action: "APPROVED" })}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                reviewBatchMutation.isPending ||
                (batchReviewModal.action === "APPROVED" &&
                  batchReviewModal.batch?.review_status !== "VERIFIED")
              }
              onClick={() => {
                if (batchReviewModal.batch) {
                  reviewBatchMutation.mutate({
                    batchId: batchReviewModal.batch.id,
                    status: batchReviewModal.action,
                    remarks: reviewRemarks,
                  });
                }
              }}
              className={`rounded-xl text-xs font-bold text-white ${batchReviewModal.action === "APPROVED"
                ? "bg-emerald-700 hover:bg-emerald-800"
                : "bg-rose-700 hover:bg-rose-800"
                }`}
            >
              {reviewBatchMutation.isPending
                ? "Processing..."
                : batchReviewModal.action === "APPROVED"
                  ? "Confirm MAO Approval"
                  : "Return for Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────────
          DIGITAL ANIMAL PASSPORT MODAL (WITH SVG QR CODE)
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
                title={`Batch ${selectedBatch.batch_name}`}
                subtitle="Official Municipal Biosecurity & Movement Clearance Pass"
                ownerName={selectedBatch.farmer_name}
                barangay={selectedBatch.barangay_name}
                specie={selectedBatch.livestock_type_name}
                headCount={selectedBatch.animals?.length || selectedBatch.total_animals}
                status={selectedBatch.review_status || "APPROVED"}
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
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-bold">Loading Herds & Animals...</div>}>
      <AdminBatchesDrilldownContent />
    </Suspense>
  );
}
