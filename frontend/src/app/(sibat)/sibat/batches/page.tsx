"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { PageHeader } from "@/app/components/page-header";
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
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Tag,
  Scale,
  Calendar,
  Building2,
  MapPin,
  User,
  Activity,
  Copy,
  Check,
  LayoutGrid,
  List,
  RefreshCw,
  Info,
  AlertCircle,
  CheckSquare,
  ClipboardList,
  ClipboardCheck,
  Download,
} from "lucide-react";
import { PADRE_GARCIA_BARANGAYS } from "@/app/(admin)/admin/admin-charts";
import { getDefaultAvatarForSpecies } from "@/app/(farmer)/livestock-inventory/livestock-inventory";
import SibatReviewDialog from "../components/sibat-review-dialog";
import type { UnifiedSubmissionItem } from "../sibat-analytics";
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

// ── Types ──────────────────────────────────────────────────────────────────

interface ChildAnimal {
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

interface BatchItem {
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
  total_animals: number;
  enrolled_animals?: number;
  pending_animals?: number;
  verified_animals?: number;
  approved_animals?: number;
  revision_animals?: number;
  rejected_animals?: number;
  average_weight: number | string | null;
  animals: ChildAnimal[];
  review_status: "PENDING" | "VERIFIED" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "MIXED" | "NO_ANIMALS";
  review_remarks?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

interface BatchSummaryPage {
  count: number;
  results: BatchItem[];
  summary: {
    totalAnimals: number | null;
    totalHerds: number;
    pendingAnimals: number | null;
    verifiedAnimals: number | null;
    approvedAnimals: number | null;
    revisionAnimals: number | null;
    rejectedAnimals: number | null;
  };
}

async function fetchAllHerdSummaries(): Promise<BatchSummaryPage> {
  const pageSize = 100;
  const first = (await api.get<BatchSummaryPage>("livestock/batches/", {
    params: { summary: "true", page: 1, page_size: pageSize },
  })).data;
  const pageCount = Math.ceil(first.count / pageSize);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      api.get<BatchSummaryPage>("livestock/batches/", {
        params: { summary: "true", page: index + 2, page_size: pageSize },
      }),
    ),
  );
  return { ...first, results: [
    ...first.results,
    ...remainingPages.flatMap((response) => response.data.results),
  ] };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

function exportHerdRosterCsv(batches: BatchItem[]) {
  const headers = [
    "Row Type", "Batch Code", "Batch Name", "Farmer", "Barangay", "Livestock Type", "Review Status",
    "Herd Status", "Housing Pen", "Feed Type", "Target Weight", "Target Harvest Date", "Animal Tag",
    "Animal Breed", "Animal Sex", "Animal Weight", "Animal Review Status", "Last Vaccination Date", "Animal Registered At",
  ];
  const rows = batches.flatMap((batch) => {
    const shared = [
      batch.batch_code, batch.batch_name, batch.farmer_name, batch.barangay_name,
      batch.livestock_type_name, batch.review_status, batch.status, batch.housing_pen,
      batch.feed_type, batch.target_weight, batch.target_harvest_date,
    ];
    if (batch.animals?.length) {
      return batch.animals.map((animal) => [
        "Animal", ...shared, animal.tag_number, animal.breed, animal.sex, animal.weight,
        animal.status, animal.last_vaccination_date, animal.created_at,
      ]);
    }
    return [["Batch", ...shared, "", "", "", "", "", "", ""]];
  });
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blobUrl = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `sibat-herd-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

function deriveBatchReviewStatus(batch: BatchItem): BatchItem["review_status"] {
  const statuses = (batch.animals || []).map((animal) =>
    (animal.status || "PENDING").toUpperCase(),
  );

  if (statuses.length === 0) return "NO_ANIMALS";
  if (statuses.every((status) => status === "APPROVED")) return "APPROVED";
  if (statuses.every((status) => status === "SUBJECT_TO_REVISION")) {
    return "SUBJECT_TO_REVISION";
  }
  if (statuses.every((status) => status === "VERIFIED")) return "VERIFIED";
  if (statuses.every((status) => status === "PENDING")) return "PENDING";
  return "MIXED";
}


function SibatBatchesVerificationContent() {
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
  const [batchPage, setBatchPage] = useState(1);

  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [selectedAnimalReview, setSelectedAnimalReview] = useState<UnifiedSubmissionItem | null>(null);
  const [animalSearchQuery, setAnimalSearchQuery] = useState("");
  const [animalStatusFilter, setAnimalStatusFilter] = useState<string>("ALL");
  const [selectedAnimalIds, setSelectedAnimalIds] = useState<number[]>([]);
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);



  const [batchNoteText, setBatchNoteText] = useState("");
  const [showBatchNotes, setShowBatchNotes] = useState(true);

  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    setShowBatchNotes(!isMobile);
  }, []);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const {
    data: batchSummaryPage,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useQuery<BatchSummaryPage>({
    queryKey: ["sibat-batches-drilldown"],
    queryFn: fetchAllHerdSummaries,
    // Herds may be created or reviewed by another user while this page is open.
    // Refresh on entry so a cached empty list does not hide newly available herds.
    staleTime: 30_000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const batches = batchSummaryPage?.results ?? [];

  // Load the individual roster only after a reviewer opens a herd.
  const detailQuery = useQuery<BatchItem>({
    queryKey: ["sibat-batch-detail", selectedBatch?.id],
    enabled: isDrilldownOpen && Boolean(selectedBatch?.id),
    queryFn: async ({ signal }) => (await api.get(`livestock/batches/${selectedBatch?.id}/`, { signal })).data,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (detailQuery.data && detailQuery.data.id === selectedBatch?.id) {
      setSelectedBatch(detailQuery.data);
    }
  }, [detailQuery.data, selectedBatch?.id]);

  // Automatically select and open drilldown if `batchId` is present in URL
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

  // ── KPI Metrics ──────────────────────────────────────────────────────────
  // The API aggregates statuses from individual rows, so herd list KPIs stay accurate without loading every roster.
  const kpis = useMemo(() => {
    const summary = batchSummaryPage?.summary;
    const totalBatches = batchSummaryPage?.count ?? 0;
    const totalAnimals = summary?.totalAnimals ?? 0;
    return {
      totalBatches,
      totalAnimals,
      pendingAnimals: summary?.pendingAnimals ?? 0,
      verifiedAnimals: summary?.verifiedAnimals ?? 0,
      approvedAnimals: summary?.approvedAnimals ?? 0,
      revisionAnimals: summary?.revisionAnimals ?? 0,
      avgHeads: totalBatches > 0 ? (totalAnimals / totalBatches).toFixed(1) : "0",
    };
  }, [batchSummaryPage]);

  const speciesList = useMemo(() => {
    const set = new Set<string>();
    batches.forEach((b) => {
      if (b.livestock_type_name) set.add(b.livestock_type_name);
    });
    return Array.from(set).sort();
  }, [batches]);

  // ── Filtered Batches ─────────────────────────────────────────────────────
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const matchSearch =
        !searchQuery ||
        b.batch_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.batch_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.farmer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.barangay_name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSpecies =
        speciesFilter === "ALL" ||
        b.livestock_type_name?.trim().toLowerCase() === speciesFilter.trim().toLowerCase();

      const matchStatus = statusFilter === "ALL" || (
        statusFilter === "PENDING" ? (b.pending_animals ?? 0) > 0 :
        statusFilter === "VERIFIED" ? (b.verified_animals ?? 0) > 0 :
        statusFilter === "APPROVED" ? (b.approved_animals ?? 0) > 0 :
        statusFilter === "SUBJECT_TO_REVISION" ? (b.revision_animals ?? 0) > 0 : false
      );

      const matchBarangay =
        barangayFilter === "ALL" ||
        b.barangay_name?.trim().toLowerCase() === barangayFilter.trim().toLowerCase();

      return matchSearch && matchSpecies && matchStatus && matchBarangay;
    });
  }, [batches, searchQuery, speciesFilter, statusFilter, barangayFilter]);

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

  // ── Pagination: Batch Table View ─────────────────────────────────────────
  const pageCountBatches = Math.max(1, Math.ceil(filteredBatches.length / BATCH_PAGE_SIZE));
  const pagedBatches = useMemo(
    () =>
      filteredBatches.slice(
        (batchPage - 1) * BATCH_PAGE_SIZE,
        (batchPage - 1) * BATCH_PAGE_SIZE + BATCH_PAGE_SIZE,
      ),
    [filteredBatches, batchPage],
  );

  useEffect(() => {
    setBatchPage(1);
  }, [searchQuery, speciesFilter, statusFilter, barangayFilter]);

  useEffect(() => {
    if (batchPage > pageCountBatches) setBatchPage(pageCountBatches);
  }, [batchPage, pageCountBatches]);

  // ── Pagination: Individual Animal Roster ─────────────────────────────────
  const ANIMAL_PAGE_SIZE = 10;
  const [animalPage, setAnimalPage] = useState(1);
  const pageCountAnimals = Math.max(1, Math.ceil(filteredChildAnimals.length / ANIMAL_PAGE_SIZE));
  const pagedChildAnimals = useMemo(
    () =>
      filteredChildAnimals.slice(
        (animalPage - 1) * ANIMAL_PAGE_SIZE,
        (animalPage - 1) * ANIMAL_PAGE_SIZE + ANIMAL_PAGE_SIZE,
      ),
    [filteredChildAnimals, animalPage],
  );
  const visiblePendingAnimalIds = pagedChildAnimals
    .filter((animal) => (animal.status || "PENDING").toUpperCase() === "PENDING")
    .map((animal) => animal.id);
  const selectedPendingAnimals = (selectedBatch?.animals ?? []).filter(
    (animal) => selectedAnimalIds.includes(animal.id) && (animal.status || "PENDING").toUpperCase() === "PENDING",
  );
  const allVisiblePendingAnimalsSelected = visiblePendingAnimalIds.length > 0
    && visiblePendingAnimalIds.every((id) => selectedAnimalIds.includes(id));

  useEffect(() => {
    if (animalPage > pageCountAnimals) setAnimalPage(1);
  }, [animalPage, pageCountAnimals]);

  useEffect(() => {
    setAnimalPage(1);
    setSelectedAnimalIds([]);
  }, [selectedBatch?.id, animalSearchQuery, animalStatusFilter]);

  // ── Mutations: Batch Review (SIBAT verification) ─────────────────────────
  // Individual animals are reviewed from the inventory queue.

  function toggleVisiblePendingAnimals(checked: boolean) {
    setSelectedAnimalIds((current) => checked
      ? Array.from(new Set([...current, ...visiblePendingAnimalIds]))
      : current.filter((id) => !visiblePendingAnimalIds.includes(id)));
  }

  async function verifySelectedAnimals() {
    if (!selectedBatch || selectedPendingAnimals.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length) return;
    setBulkVerifying(true);
    try {
      // Reuse the individual review endpoint so role checks, barangay scope,
      // audit fields, and farmer notifications remain the same for every animal.
      const results = await Promise.allSettled(selectedPendingAnimals.map((animal) =>
        api.post(`livestock/inventory/${animal.id}/review/`, {
          status: "VERIFIED",
          remarks: "Field verification completed in the herd registry.",
        }),
      ));
      const verifiedCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - verifiedCount;
      setBulkVerifyOpen(false);
      setSelectedAnimalIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] }),
        queryClient.invalidateQueries({ queryKey: ["sibat-batch-detail", selectedBatch.id] }),
        queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      await detailQuery.refetch();
      if (failedCount > 0) {
        toast.warning(`${verifiedCount} animal${verifiedCount === 1 ? "" : "s"} verified. ${failedCount} could not be verified.`, {
          description: "Refresh the herd and review the remaining animals individually.",
        });
      } else {
        toast.success(`${verifiedCount} animal${verifiedCount === 1 ? "" : "s"} verified.`, {
          description: "These records are now ready for MAO review.",
        });
      }
    } catch {
      toast.error("Could not verify the selected animals. Please try again.");
    } finally {
      setBulkVerifying(false);
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
      queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["sibat-batch-detail"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
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

  function openHerdDrilldown(batch: BatchItem) {
    // Summary rows omit `animals`; keep cached detail when reopening a herd so
    // the roster does not disappear while React Query serves its cached result.
    const cachedDetail = queryClient.getQueryData<BatchItem>([
      "sibat-batch-detail",
      batch.id,
    ]);
    setSelectedBatch(cachedDetail ?? batch);
    setIsDrilldownOpen(true);
  }

  function openAnimalReview(batch: BatchItem, animal: ChildAnimal) {
    // The herd roster contains enough animal and farmer context to open the same
    // individual review dialog used by the SIBAT registry.
    setSelectedAnimalReview({
      id: `inv-${animal.id}`,
      rawId: animal.id,
      sourceType: "INVENTORY",
      submissionTypeLabel: "Livestock Inventory",
      farmerName: batch.farmer_name,
      barangayName: batch.barangay_name,
      livestockTypeName: batch.livestock_type_name,
      detailsTitle: `${animal.tag_number || `Animal #${animal.id}`} (${batch.livestock_type_name})`,
      quantityDisplay: "1 head",
      quantity: 1,
      unit: "head",
      recordDate: animal.created_at || batch.created_at,
      status: animal.status,
      notes: animal.review_remarks || "",
      breed: animal.breed,
      tagNumber: animal.tag_number,
      sex: animal.sex,
      weight: animal.weight == null ? null : Number(animal.weight),
      entryType: "INDIVIDUAL",
      batchId: batch.id,
      batchCode: batch.batch_code,
      batchName: batch.batch_name,
      photoUrl: animal.photo_url,
      lastVaccinationDate: animal.last_vaccination_date || null,
      reviewRemarks: animal.review_remarks || null,
      reviewedAt: animal.reviewed_at || null,
      reviewedByName: animal.reviewed_by_name || null,
      createdAt: animal.created_at || batch.created_at,
    });
  }

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
          All animals checked
        </span>
      );
    }
    if (s === "SUBJECT_TO_REVISION" || s === "SUBJECT_FOR_REVISION") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Animals Needing Revision
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
          Waiting for field check
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
        title="Herds"
        subtitle="Choose a herd to see its animals and check their records."
        variant="farmer"
        maxWidthClass="w-full"
        icon={<Layers className="size-5 text-white" />}
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-4 p-3 pb-16 sm:space-y-5 sm:p-4 sm:pb-6 md:p-6">
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex min-w-0 flex-col items-start justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:p-4">
          <div className="flex items-center gap-2">
            <Link href="/sibat">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to overview
              </Button>
            </Link>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider hidden sm:inline">
              Herds ({batches.length})
            </span>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportHerdRosterCsv(filteredBatches)}
              disabled={isLoading || filteredBatches.length === 0}
              title="Download all herds matching the current filters, including their animal rosters"
              className="min-h-11 w-full gap-2 rounded-xl border-slate-200 px-3 text-sm font-semibold text-slate-700 sm:w-auto sm:px-4"
            >
              <Download className="size-3.5" />
              Download list ({filteredBatches.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="min-h-11 w-full gap-2 rounded-xl border-slate-200 px-3 text-sm font-semibold text-slate-700 sm:w-auto sm:px-4"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin text-sky-600" : ""}`} />
              Refresh list
            </Button>

            <div className="col-span-2 flex w-full items-center justify-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 sm:col-span-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "grid"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
                title="Show herds as cards"
                aria-label="Show herds as cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold flex items-center gap-2 transition-all ${viewMode === "table"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
                  }`}
                title="Show herds in a table"
                aria-label="Show herds in a table"
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Total herds
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {kpis.totalBatches}
                </span>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">In your assigned area</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Total animals
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-sky-800 font-mono">
                  {kpis.totalAnimals}
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  Heads
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Avg {kpis.avgHeads} animals / batch
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Checked by field staff
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-sky-700 font-mono">
                  {kpis.verifiedAnimals}
                </span>
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-xs text-slate-600 mt-1">Ready for MAO approval</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-emerald-300">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Waiting to be checked
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`}>
                  {kpis.pendingAnimals}
                </span>
                <Clock className={`w-4 h-4 ${kpis.pendingAnimals > 0 ? "text-amber-600" : "text-slate-400"}`} />
              </div>
              <p className="text-xs text-slate-600 mt-1">Farmer submissions</p>
            </CardContent>
          </Card>

          <Card className="col-span-2 rounded-xl border-slate-200 bg-white shadow-2xs transition-all hover:border-rose-300 sm:col-span-1">
            <CardContent className="p-3.5">
              <span className="text-xs font-bold text-slate-600 block">
                Needs correction
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${kpis.revisionAnimals > 0 ? "text-rose-600" : "text-slate-400"}`}>
                  {kpis.revisionAnimals}
                </span>
                <AlertTriangle className={`w-4 h-4 ${kpis.revisionAnimals > 0 ? "text-rose-600" : "text-slate-400"}`} />
              </div>
              <p className="text-xs text-slate-600 mt-1">Sent back to farmer</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2.5">
            <div className="relative lg:col-span-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by farmer, animal tag, or barangay"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 rounded-xl border-slate-200 bg-slate-50/80 pl-10 text-base focus-visible:ring-emerald-600"
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

            <div className="lg:col-span-3">
              <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
                <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-base font-medium">
                  <SelectValue placeholder="Animal type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All animal types ({batches.length})</SelectItem>
                  {speciesList.map((sp) => (
                    <SelectItem key={sp} value={sp}>
                      {sp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-base font-medium">
                  <SelectValue placeholder="Review status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ALL">All review statuses ({batches.length})</SelectItem>
                  <SelectItem value="PENDING">Waiting to be checked ({kpis.pendingAnimals})</SelectItem>
                  <SelectItem value="VERIFIED">Waiting for MAO ({kpis.verifiedAnimals})</SelectItem>
                  <SelectItem value="APPROVED">Approved ({kpis.approvedAnimals})</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Needs correction ({kpis.revisionAnimals})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Select value={barangayFilter} onValueChange={setBarangayFilter}>
                <SelectTrigger className="min-h-11 rounded-xl border-slate-200 text-base font-medium truncate">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-56">
                  <SelectItem value="ALL">All Barangays</SelectItem>
                  {PADRE_GARCIA_BARANGAYS.map((brgy) => (
                    <SelectItem key={brgy} value={brgy}>
                      {brgy}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(searchQuery || speciesFilter !== "ALL" || statusFilter !== "ALL" || barangayFilter !== "ALL") && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100 flex-wrap text-xs">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Filters:
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
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* ── Main Batch Displays ── */}
        {isLoading ? (
          <div role="status" aria-live="polite" className="mx-auto max-w-2xl rounded-xl border border-emerald-200 bg-white px-6 py-10 text-center shadow-2xs sm:px-10">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-emerald-50">
              <RefreshCw className="size-8 animate-spin text-emerald-700" />
            </div>
            <p className="text-xl font-bold text-slate-900">Loading your herd list</p>
            <p className="mx-auto mt-2 max-w-md text-base leading-6 text-slate-600">Please wait while we get the herds and animal records for your area.</p>
            <div className="mx-auto mt-6 max-w-md space-y-2" aria-hidden="true">
              <div className="h-3 animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto h-3 w-4/5 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        ) : isError && !batchSummaryPage ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center shadow-2xs">
            <p className="text-lg font-bold text-rose-900">We could not load the herd list</p>
            <p className="mx-auto mt-2 max-w-md text-base leading-6 text-rose-800">
              Check your internet connection, then try again. If the problem continues, ask your administrator for help.
            </p>
            <Button type="button" variant="outline" size="lg" onClick={() => void refetch()} className="mt-4 min-h-12 rounded-xl border-rose-300 px-5 text-base font-bold text-rose-900 hover:bg-rose-100">
              <RefreshCw className="mr-2 size-5" /> Try again
            </Button>
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-lg font-bold text-slate-800">No herds found</p>
            <p className="text-base leading-6 text-slate-600 mt-2 max-w-md mx-auto">
              Try a different search, or clear the filters to see all herds in your area.
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
              Clear filters
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View Mode */
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {pagedBatches.map((batch) => {
              const headCount = batch.total_animals || batch.animals?.length || 0;
              const avgWeight = batch.average_weight ? Number(batch.average_weight) : null;
              const sibatCheckedCount = (batch.verified_animals ?? 0) + (batch.approved_animals ?? 0);
              const verificationProgress =
                headCount > 0 ? Math.round((sibatCheckedCount / headCount) * 100) : 0;

              return (
              <Card
                  key={batch.id}
                  className="group flex flex-col overflow-hidden rounded-xl border-slate-200 bg-white shadow-2xs transition-all duration-200 hover:border-emerald-300 hover:shadow-md"
                >
                  <CardHeader className="p-4 pb-3 min-h-[88px]">
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

                    <CardTitle className="text-lg font-bold text-slate-900 mt-1.5 break-words">
                      {batch.batch_name || `${batch.livestock_type_name} Herd`}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600 flex flex-wrap items-center gap-1.5 mt-1">
                      <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="font-bold text-slate-700 truncate">{batch.farmer_name}</span>
                      <span>•</span>
                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{batch.barangay_name || "Padre Garcia"}</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-3 flex flex-1 flex-col">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="px-1.5">
                        <span className="text-xs font-semibold text-slate-600 block">
                          Animals
                        </span>
                        <p className="text-lg leading-none font-bold text-slate-900 mt-1.5">
                          {headCount}
                          <span className="text-xs font-semibold text-slate-600 ml-1">animals</span>
                        </p>
                      </div>
                      <div className="px-1.5 sm:border-l sm:pl-3">
                        <span className="text-xs font-semibold text-slate-600 block">
                          Checked
                        </span>
                        <p className="text-lg leading-none font-bold text-sky-800 mt-1.5">
                          {sibatCheckedCount}
                          <span className="text-xs font-semibold text-slate-600 ml-1">of {headCount}</span>
                        </p>
                      </div>
                      <div className="col-span-2 border-t border-slate-200 px-1.5 pt-2 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                        <span className="text-xs font-semibold text-slate-600 block">
                          Average weight
                        </span>
                        <p className="text-lg leading-none font-bold text-slate-900 mt-1.5">
                          {avgWeight ? `${avgWeight} kg` : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700">
                          Field check - {sibatCheckedCount} of {headCount} animals
                        </span>
                        <span className={`text-sm font-bold ${batch.verified_animals === 0 && batch.pending_animals === 0 ? "text-emerald-700" : "text-sky-700"}`}>
                          {verificationProgress}%
                        </span>
                      </div>
                      <Progress
                        value={verificationProgress}
                        className={`h-2.5 bg-slate-100 ${
                          batch.review_status === "APPROVED" ? "[&>div]:bg-emerald-600" : "[&>div]:bg-sky-600"
                        }`}
                      />
                    </div>

                    <p className="text-sm leading-5 text-slate-700">
                      {batch.approved_animals ?? 0} approved · {batch.pending_animals ?? 0} waiting for field check · {batch.verified_animals ?? 0} waiting for MAO · {batch.revision_animals ?? 0} need correction
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700 capitalize">
                        <Building2 className="size-3 text-slate-400" />
                        {batch.housing_pen || "General Pen"}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-700 capitalize">
                        <Activity className="size-3 text-slate-400" />
                        {batch.feed_type || "—"}
                      </span>
                    </div>

                    <div
                      className={`min-h-11 px-3 rounded-lg border text-sm flex items-center gap-2 ${
                        batch.review_remarks
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      <Info className={`size-3.5 shrink-0 ${batch.review_remarks ? "text-amber-600" : "text-slate-300"}`} />
                      <span className="line-clamp-2">
                        {batch.review_remarks || "No review remarks"}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-[1fr_auto] gap-1.5 pt-2 border-t border-slate-100 mt-auto">
                      <Button
                        size="sm"
                        onClick={() => {
                          openHerdDrilldown(batch);
                        }}
                        className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-2xs hover:bg-emerald-800"
                      >
                        <Eye className="size-3.5" />
                        Open herd
                        <ChevronRight className="size-3.5 ml-auto" />
                      </Button>

                      <Link href={`/sibat/livestock-registry?batchId=${batch.id}`} className="col-span-2">
                        <Button size="sm" variant="outline" className="min-h-11 w-full rounded-xl border-emerald-200 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
                          <Eye className="size-3.5 mr-1.5" /> View animal list
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-2 py-2 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing herds {(batchPage - 1) * BATCH_PAGE_SIZE + 1}–{Math.min(batchPage * BATCH_PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" disabled={batchPage <= 1} onClick={() => setBatchPage((p) => p - 1)} className="min-h-10 rounded-lg px-3 text-sm font-semibold">‹ Previous</Button>
                <span className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white">Page {batchPage} of {pageCountBatches}</span>
                <Button variant="outline" size="sm" disabled={batchPage >= pageCountBatches} onClick={() => setBatchPage((p) => p + 1)} className="min-h-10 rounded-lg px-3 text-sm font-semibold">Next ›</Button>
              </div>
            </div>
          </div>
        ) : (
          /* Table View Mode */
          <>
          <div className="space-y-3 md:hidden">
            {pagedBatches.map((batch) => (
              <Card key={batch.id} className="rounded-xl border-slate-200 shadow-2xs">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-lg font-bold text-slate-900">{batch.batch_name || `${batch.livestock_type_name} herd`}</p>
                      <p className="mt-1 text-sm text-slate-600">{batch.livestock_type_name} · {batch.batch_code}</p>
                    </div>
                    {getStatusBadge(batch.review_status)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <div><span className="block text-xs font-semibold text-slate-500">Farmer</span><span className="break-words font-semibold text-slate-900">{batch.farmer_name}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Barangay</span><span className="break-words font-semibold text-slate-900">{batch.barangay_name}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Animals</span><span className="font-semibold text-slate-900">{batch.total_animals || batch.animals?.length || 0}</span></div>
                    <div><span className="block text-xs font-semibold text-slate-500">Average weight</span><span className="font-semibold text-slate-900">{batch.average_weight ? `${batch.average_weight} kg` : "Not recorded"}</span></div>
                  </div>
                  <Button type="button" onClick={() => openHerdDrilldown(batch)} className="min-h-11 w-full rounded-xl bg-emerald-700 text-base font-bold text-white hover:bg-emerald-800">
                    <Eye className="mr-2 size-5" /> Open herd and animals
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Batch Code
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Herd name &amp; animal type
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
                        <TableCell className="text-center font-mono font-black text-xs text-sky-800">
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
                          <Button
                            size="sm"
                            onClick={() => {
                                openHerdDrilldown(batch);
                            }}
                            className="h-9 rounded-xl bg-emerald-700 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Open herd
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs">
              <span className="text-[11px] text-slate-500 font-medium">
                Showing herds {(batchPage - 1) * BATCH_PAGE_SIZE + 1}–
                {Math.min(batchPage * BATCH_PAGE_SIZE, filteredBatches.length)} of {filteredBatches.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={batchPage <= 1}
                  onClick={() => setBatchPage((p) => p - 1)}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold"
                >
                  ‹ Previous
                </Button>
                <span className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[10px] font-black text-white">
                  Page {batchPage} of {pageCountBatches}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={batchPage >= pageCountBatches}
                  onClick={() => setBatchPage((p) => p + 1)}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold"
                >
                  Next ›
                </Button>
              </div>
            </div>
          </div>
          </>
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
            router.replace("/sibat/batches", { scroll: false });
          }
        }}
      >
        <DialogContent className="h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-white p-0 shadow-2xl sm:h-auto sm:max-h-[94vh] sm:w-[98vw] sm:max-w-5xl sm:rounded-2xl sm:border md:max-w-6xl lg:max-w-7xl xl:max-w-[1440px] flex flex-col">
          {detailQuery.isLoading ? (
            <div
              className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
              role="status"
              aria-live="polite"
            >
              <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <RefreshCw className="size-6 animate-spin" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold text-slate-900">Loading herd and animals</DialogTitle>
                <DialogDescription className="text-base leading-6 text-slate-600">
                  Please wait. The animal list is on its way.
                </DialogDescription>
              </div>
            </div>
          ) : detailQuery.isError ? (
            <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="size-8 text-rose-600" />
              <div className="space-y-1">
                <DialogTitle className="text-lg font-bold text-slate-900">We could not open this herd</DialogTitle>
                <DialogDescription className="text-base leading-6 text-slate-600">
                  Check your internet connection, then try again.
                </DialogDescription>
              </div>
              <Button type="button" variant="outline" size="lg" onClick={() => void detailQuery.refetch()} className="min-h-12 rounded-xl px-5 text-base font-bold">
                Try again
              </Button>
            </div>
          ) : selectedBatch && (
            <div className="flex flex-col max-h-[94vh]">
              {/* Modal Header */}
              <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-emerald-900 bg-gradient-to-r from-emerald-900 via-emerald-950 to-teal-950 p-4 pr-12 text-white sm:flex-row sm:items-center sm:p-5 sm:pr-14">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-emerald-200">
                      {selectedBatch.livestock_type_name} herd
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-100">
                      {selectedBatch.batch_code}
                    </span>
                    {getStatusBadge(selectedBatch.review_status)}
                  </div>
                  <DialogTitle className="text-lg sm:text-xl font-black text-white">
                    {selectedBatch.batch_name}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2 text-xs text-emerald-100/85">
                    <span>Farmer: <strong>{selectedBatch.farmer_name}</strong></span>
                    <span>•</span>
                    <span>Barangay: <strong>{selectedBatch.barangay_name}</strong></span>
                    <span>•</span>
                    <span>Enrolled: <strong>{selectedBatch.animals?.length || selectedBatch.total_animals} Heads</strong></span>
                  </DialogDescription>
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
                  <div className="flex items-center gap-1 mt-0.5">
                    <Scale className="w-3 h-3 text-sky-600 shrink-0" />
                    <p className="font-black text-slate-800 text-xs">
                      {selectedBatch.average_weight ? `${selectedBatch.average_weight} kg` : "N/A"}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Target: {selectedBatch.target_weight ? `${selectedBatch.target_weight} kg` : "Unspecified"}
                  </p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Target Harvest Date
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <p className="font-black text-slate-800 text-xs">
                      {selectedBatch.target_harvest_date || "Open Schedule"}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">Registered: {selectedBatch.created_at?.split("T")[0]}</p>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Individual review</span>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-600">Review each animal separately. The herd only groups records and summarizes their current statuses.</p>
                  <Link href={`/sibat/livestock-registry?batchId=${selectedBatch.id}`} className="mt-2 block">
                    <Button type="button" size="sm" variant="outline" className="h-7 w-full rounded-lg text-[10px] font-bold">Open animal registry</Button>
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
                    <ClipboardList className="w-4 h-4 text-sky-700 shrink-0" />
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
                        placeholder="Add a field inspection note for the farmer..."
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
                        className="h-14 shrink-0 rounded-xl bg-emerald-700 px-3 text-[10px] font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 sm:h-16 sm:px-4"
                      >
                        {addBatchNoteMutation.isPending ? "Adding..." : "Add Note"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Animals Drilldown Section */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
                <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5" aria-label="How to verify animals">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-sky-700 text-white" aria-hidden="true">
                      <Info className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900">How to verify animals</h3>
                      <ol className="mt-2 space-y-1.5 text-base leading-6 text-slate-800">
                        <li><strong>1.</strong> Check the animal details and ear tag.</li>
                        <li><strong>2.</strong> Tick the box beside each animal you checked.</li>
                        <li><strong>3.</strong> Press <strong>Verify selected animals</strong>.</li>
                      </ol>
                      <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-700">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        Select only animals you checked in the field. Verified animals go to MAO for final approval.
                      </p>
                    </div>
                  </div>
                </section>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-sky-700" />
                      Animals in this herd ({filteredChildAnimals.length})
                    </h3>
                    <p className="text-sm leading-5 text-slate-600">
                      Check each animal's tag and details before marking it verified.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => setBulkVerifyOpen(true)}
                      disabled={selectedAnimalIds.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length}
                      className="min-h-12 rounded-xl bg-sky-700 px-5 text-base font-bold text-white hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-600"
                    >
                      <ShieldCheck className="mr-2 size-5" />
                      Verify selected animals ({selectedAnimalIds.length})
                    </Button>
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      onClick={() => toggleVisiblePendingAnimals(!allVisiblePendingAnimalsSelected)}
                      disabled={visiblePendingAnimalIds.length === 0}
                      className="min-h-12 rounded-xl border-slate-300 px-4 text-base font-semibold"
                    >
                      <CheckSquare className="mr-2 size-5" />
                      {allVisiblePendingAnimalsSelected ? "Unselect this page" : "Select pending on this page"}
                    </Button>
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        placeholder="Find an animal by tag or breed"
                        value={animalSearchQuery}
                        onChange={(e) => setAnimalSearchQuery(e.target.value)}
                        className="pl-9 min-h-11 rounded-xl border-slate-200 text-base"
                      />
                    </div>

                    <Select value={animalStatusFilter} onValueChange={setAnimalStatusFilter}>
                      <SelectTrigger className="min-h-11 w-full rounded-xl border-slate-200 text-base sm:w-40">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="VERIFIED">Verified</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="SUBJECT_TO_REVISION">Revision</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Stacked animal cards keep every field and action readable on phones. */}
                <div className="space-y-3 md:hidden">
                  {filteredChildAnimals.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-base text-slate-600">No animals match this search or status.</div>
                  ) : pagedChildAnimals.map((animal) => {
                    const mobileWeight = animal.weight == null ? null : Number(animal.weight);
                    const isPending = (animal.status || "PENDING").toUpperCase() === "PENDING";
                    return (
                      <article key={animal.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl pr-1">
                            <input
                              type="checkbox"
                              aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for field verification`}
                              checked={selectedAnimalIds.includes(animal.id)}
                              disabled={!isPending}
                              onChange={(event) => setSelectedAnimalIds((current) => event.target.checked
                                ? Array.from(new Set([...current, animal.id]))
                                : current.filter((id) => id !== animal.id))}
                              className="size-6 shrink-0 rounded border-slate-400 accent-sky-700 disabled:opacity-40"
                            />
                            <span className="min-w-0">
                              <span className="block break-all font-mono text-base font-bold text-slate-900">{animal.tag_number || `Animal #${animal.id}`}</span>
                              <span className="block text-sm text-slate-600">Tap to select for checking</span>
                            </span>
                          </label>
                          <div className="shrink-0">{getStatusBadge(animal.status)}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                          <div><span className="block text-xs font-semibold text-slate-500">Breed</span><span className="break-words font-semibold text-slate-900">{animal.breed || "Not recorded"}</span></div>
                          <div><span className="block text-xs font-semibold text-slate-500">Sex</span><span className="font-semibold text-slate-900">{animal.sex || "Not recorded"}</span></div>
                          <div><span className="block text-xs font-semibold text-slate-500">Weight</span><span className="font-semibold text-slate-900">{mobileWeight == null ? "Not recorded" : `${mobileWeight} kg`}</span></div>
                          <div><span className="block text-xs font-semibold text-slate-500">Last vaccination</span><span className="font-semibold text-slate-900">{animal.last_vaccination_date || "No date recorded"}</span></div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openAnimalReview(selectedBatch, animal)}
                          className="mt-3 min-h-12 w-full rounded-xl border-sky-200 text-base font-semibold text-sky-900"
                        >
                          <Eye className="mr-2 size-5" /> {isPending ? "Review animal details" : "View animal details"}
                        </Button>
                      </article>
                    );
                  })}
                </div>

                {/* Wider screens use a table; phones use the stacked cards above. */}
                <div className="hidden w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                  <Table className="min-w-[460px] md:min-w-[650px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-12 text-sm font-bold text-slate-700">Select</TableHead>
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
                          Status
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-right sticky right-0 z-10 bg-slate-50 border-l border-slate-200 shadow-[-4px_0_8px_-8px_rgba(0,0,0,0.25)]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredChildAnimals.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-base text-slate-600">
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
                              <TableCell>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${animal.tag_number || `animal ${animal.id}`} for field verification`}
                                  checked={selectedAnimalIds.includes(animal.id)}
                                  disabled={(animal.status || "PENDING").toUpperCase() !== "PENDING"}
                                  onChange={(event) => setSelectedAnimalIds((current) => event.target.checked
                                    ? Array.from(new Set([...current, animal.id]))
                                    : current.filter((id) => id !== animal.id))}
                                  className="size-5 rounded border-slate-400 accent-sky-700 disabled:opacity-40"
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
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openAnimalReview(selectedBatch, animal)}
                                    className="h-8 gap-1.5 rounded-lg border-emerald-200 px-2.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50"
                                    aria-label={`${animal.status === "PENDING" ? "Review" : "View"} individual animal ${animal.tag_number || animal.id}`}
                                  >
                                    <Eye className="size-3.5" />
                                    {animal.status === "PENDING" ? "Review animal" : "View review"}
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
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-1 pt-3 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Showing {(animalPage - 1) * ANIMAL_PAGE_SIZE + 1}–
                      {Math.min(animalPage * ANIMAL_PAGE_SIZE, filteredChildAnimals.length)} of {filteredChildAnimals.length} heads
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={animalPage <= 1}
                        onClick={() => setAnimalPage((p) => p - 1)}
                        className="h-7 rounded-lg text-[10px] font-bold"
                      >
                        ‹ Prev
                      </Button>
                      <span className="px-2.5 py-1 rounded-lg bg-sky-700 text-white font-black text-[10px]">
                        Page {animalPage} / {pageCountAnimals}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={animalPage >= pageCountAnimals}
                        onClick={() => setAnimalPage((p) => p + 1)}
                        className="h-7 rounded-lg text-[10px] font-bold"
                      >
                        Next ›
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                <span className="text-[11px] sm:text-xs text-slate-500">
                  Batangas Livestock Tracking System • SIBAT Field Sector of Padre Garcia
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDrilldownOpen(false)}
                  className="rounded-xl font-bold text-xs w-full sm:w-auto"
                >
                  Close herd
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SibatReviewDialog
        submission={selectedAnimalReview}
        open={selectedAnimalReview !== null}
        onOpenChange={(open) => { if (!open) setSelectedAnimalReview(null); }}
        onReviewSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: ["sibat-batches-drilldown"] });
          void queryClient.invalidateQueries({ queryKey: ["sibat", "livestock-registry"] });
        }}
      />

      <AlertDialog open={bulkVerifyOpen} onOpenChange={setBulkVerifyOpen}>
        <AlertDialogContent className="max-w-lg rounded-2xl p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Verify {selectedPendingAnimals.length} selected animal{selectedPendingAnimals.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base leading-6 text-slate-700">
              This records that you checked these animals. They will be sent to MAO for final approval. Continue only if you completed the field check.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="min-h-12 rounded-xl px-5 text-base">Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void verifySelectedAnimals(); }}
              disabled={bulkVerifying || selectedPendingAnimals.length === 0 || selectedPendingAnimals.length !== selectedAnimalIds.length}
              className="min-h-12 rounded-xl bg-sky-700 px-5 text-base font-bold hover:bg-sky-800"
            >
              {bulkVerifying ? "Saving verification…" : "Yes, verify animals"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ──────────────────────────────────────────────────────────────────────────
          HERD REVIEW CONFIRMATION
      ────────────────────────────────────────────────────────────────────────── */}

    </>
  );
}

export default function SibatBatchesVerificationPage() {
  return (
    <Suspense fallback={
      <div role="status" aria-live="polite" className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <div className="mb-4 grid size-16 place-items-center rounded-full bg-sky-50">
          <RefreshCw className="size-8 animate-spin text-sky-700" />
        </div>
        <p className="text-xl font-bold text-slate-900">Opening the herd list</p>
        <p className="mt-2 max-w-md text-base leading-6 text-slate-600">Please wait while we prepare the herds and animal records.</p>
      </div>
    }>
      <SibatBatchesVerificationContent />
    </Suspense>
  );
}
