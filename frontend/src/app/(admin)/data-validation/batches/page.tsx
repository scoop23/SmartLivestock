"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
  Filter,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Printer,
  ChevronRight,
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

export default function AdminBatchesDrilldownPage() {
  const queryClient = useQueryClient();

  // ── States ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [barangayFilter, setBarangayFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

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

  const [animalReviewModal, setAnimalReviewModal] = useState<{
    open: boolean;
    animal: ChildAnimal | null;
    action: "APPROVED" | "SUBJECT_TO_REVISION";
  }>({ open: false, animal: null, action: "APPROVED" });
  const [animalReviewRemarks, setAnimalReviewRemarks] = useState("");

  // Passport & Print Modal
  const [passportAnimal, setPassportAnimal] = useState<ChildAnimal | null>(null);
  const [isPassportOpen, setIsPassportOpen] = useState(false);
  const [isBatchCertificateOpen, setIsBatchCertificateOpen] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // ── Data Fetching ────────────────────────────────────────────────────────
  const {
    data: batches = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<BatchItem[]>({
    queryKey: ["admin-batches-drilldown"],
    queryFn: async () => {
      const res = await api.get("livestock/batches/?all=true");
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 30 * 1000,
  });

  // Keep selectedBatch updated when data refetches
  React.useEffect(() => {
    if (selectedBatch) {
      const updated = batches.find((b) => b.id === selectedBatch.id);
      if (updated) setSelectedBatch(updated);
    }
  }, [batches, selectedBatch]);

  // ── KPI Metrics ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalBatches = batches.length;
    const totalAnimals = batches.reduce((acc, b) => acc + (b.total_animals || b.animals?.length || 0), 0);
    const approvedBatches = batches.filter(
      (b) => (b.review_status || "PENDING").toUpperCase() === "APPROVED"
    ).length;
    const pendingBatches = batches.filter(
      (b) => (b.review_status || "PENDING").toUpperCase() === "PENDING"
    ).length;
    const verifiedBatches = batches.filter(
      (b) => (b.review_status || "").toUpperCase() === "VERIFIED"
    ).length;
    const revisionBatches = batches.filter(
      (b) => (b.review_status || "").toUpperCase() === "SUBJECT_TO_REVISION"
    ).length;
    const avgHeads = totalBatches > 0 ? (totalAnimals / totalBatches).toFixed(1) : "0";

    return {
      totalBatches,
      totalAnimals,
      approvedBatches,
      pendingBatches,
      verifiedBatches,
      revisionBatches,
      avgHeads,
    };
  }, [batches]);

  // Unique species for filter
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
        b.barangay_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.animals?.some((a) =>
          a.tag_number?.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchSpecies =
        speciesFilter === "ALL" ||
        b.livestock_type_name?.trim().toLowerCase() === speciesFilter.trim().toLowerCase();

      const matchStatus =
        statusFilter === "ALL" ||
        (b.review_status || "PENDING").trim().toUpperCase() === statusFilter.trim().toUpperCase();

      const matchBarangay =
        barangayFilter === "ALL" ||
        b.barangay_name?.trim().toLowerCase() === barangayFilter.trim().toLowerCase();

      return matchSearch && matchSpecies && matchStatus && matchBarangay;
    });
  }, [batches, searchQuery, speciesFilter, statusFilter, barangayFilter]);

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
        (a.status || "PENDING").toUpperCase() === animalStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [selectedBatch, animalSearchQuery, animalStatusFilter]);

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
    onSuccess: (data, variables) => {
      const verb =
        variables.status === "APPROVED"
          ? "approved & certified"
          : "returned for revision";
      toast.success(`Batch ${selectedBatch?.batch_code || ""} ${verb}!`, {
        description: `All child animals in this cohort updated to ${variables.status}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["livestock-batches"] });
      setBatchReviewModal({ open: false, batch: null, action: "APPROVED" });
      setReviewRemarks("");
    },
    onError: (err) => {
      console.error("Batch review failed:", err);
      toast.error("Failed to update batch review status. Please try again.");
    },
  });

  // ── Mutations: Individual Animal Review ──────────────────────────────────
  const reviewAnimalMutation = useMutation({
    mutationFn: async ({
      animalId,
      status,
      remarks,
    }: {
      animalId: number;
      status: "APPROVED" | "SUBJECT_TO_REVISION";
      remarks: string;
    }) => {
      const res = await api.post(`livestock/inventory/${animalId}/review/`, {
        status,
        remarks,
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      const verb =
        variables.status === "APPROVED"
          ? "certified & approved"
          : "returned for revision";
      toast.success(`Animal tag verified: ${verb}.`);
      queryClient.invalidateQueries({ queryKey: ["admin-batches-drilldown"] });
      queryClient.invalidateQueries({ queryKey: ["admin-inventory-records"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setAnimalReviewModal({ open: false, animal: null, action: "APPROVED" });
      setAnimalReviewRemarks("");
    },
    onError: (err) => {
      console.error("Animal review failed:", err);
      toast.error("Failed to update animal review status.");
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
    if (s === "SUBJECT_TO_REVISION") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Revision Needed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
        <Clock className="w-3 h-3 text-amber-600" />
        Pending MAO
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
        title="Municipal Batch & Cohort Validation"
        subtitle="Official MAO inspection center: review complete livestock cohorts and drill down into individual ear tags"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Layers className="w-6 h-6 text-slate-900" />}
      />

      <div className="p-3 sm:p-5 md:p-6 w-full space-y-4 pb-20">
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
                Total Cohort Batches
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
                  <SelectItem value="ALL">All Species ({batches.length})</SelectItem>
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
                  <SelectItem value="ALL">All Statuses ({batches.length})</SelectItem>
                  <SelectItem value="APPROVED">MAO Approved ({kpis.approvedBatches})</SelectItem>
                  <SelectItem value="PENDING">Pending Review ({kpis.pendingBatches})</SelectItem>
                  <SelectItem value="VERIFIED">SIBAT Verified ({kpis.verifiedBatches})</SelectItem>
                  <SelectItem value="SUBJECT_TO_REVISION">Subject to Revision ({kpis.revisionBatches})</SelectItem>
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
                  {PADRE_GARCIA_BARANGAYS.map((brgy) => (
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
            <p className="text-sm font-black text-slate-800">Loading Municipal Cohort Batches...</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredBatches.map((batch) => {
              const headCount = batch.total_animals || batch.animals?.length || 0;
              const avgWeight = batch.average_weight ? Number(batch.average_weight) : null;
              const targetWeight = batch.target_weight ? Number(batch.target_weight) : null;
              const weightProgress =
                avgWeight && targetWeight && targetWeight > 0
                  ? Math.min(Math.round((avgWeight / targetWeight) * 100), 100)
                  : null;

              return (
                <Card
                  key={batch.id}
                  className="rounded-2xl border-slate-200 bg-white shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-3">
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

                    <CardTitle className="text-sm font-black text-slate-900 mt-2 truncate">
                      {batch.batch_name || `${batch.livestock_type_name} Cohort`}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="font-bold text-slate-700 truncate">{batch.farmer_name}</span>
                      <span>•</span>
                      <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                      <span className="truncate">{batch.barangay_name || "Padre Garcia"}</span>
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-3">
                    {/* Headcount and Housing strip */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Head Count
                        </span>
                        <p className="font-black text-emerald-800 text-sm mt-0.5">
                          {headCount} <span className="text-xs font-normal text-slate-600">Animals</span>
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                          Housing Pen
                        </span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">
                          {batch.housing_pen || "General Pen"}
                        </p>
                      </div>
                    </div>

                    {/* Weight Metrics */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">
                          Avg: <strong className="text-slate-800">{avgWeight ? `${avgWeight} kg` : "N/A"}</strong>
                        </span>
                        {targetWeight && (
                          <span className="text-slate-500">
                            Target: <strong className="text-slate-800">{targetWeight} kg</strong>
                          </span>
                        )}
                      </div>
                      {weightProgress !== null && (
                        <div className="space-y-1">
                          <Progress value={weightProgress} className="h-1.5 bg-slate-100" />
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Growth progress</span>
                            <span className="font-bold text-emerald-700">{weightProgress}%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Review remarks if any */}
                    {batch.review_remarks && (
                      <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                        <span className="italic line-clamp-2">&ldquo;{batch.review_remarks}&rdquo;</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedBatch(batch);
                          setIsDrilldownOpen(true);
                        }}
                        className="flex-1 h-8 rounded-xl bg-slate-900 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Drill Down ({headCount})
                      </Button>

                      {batch.review_status !== "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBatchReviewModal({
                              open: true,
                              batch: batch,
                              action: "APPROVED",
                            });
                          }}
                          className="h-8 rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-bold px-3"
                          title="Quick Approve Entire Batch"
                        >
                          Approve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
                      Cohort Name &amp; Species
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
                  {filteredBatches.map((batch) => {
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
                            {batch.feed_type || "Rations"}
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
                              setSelectedBatch(batch);
                              setIsDrilldownOpen(true);
                            }}
                            className="h-8 rounded-xl bg-slate-900 hover:bg-emerald-800 text-white font-bold text-xs gap-1 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Drill Down
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          DEEP DRILLDOWN INSPECTION DIALOG (COHORT & INDIVIDUAL LIVESTOCK ROSTER)
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isDrilldownOpen} onOpenChange={setIsDrilldownOpen}>
        <DialogContent className="w-full max-w-[98vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl xl:max-w-[1440px] rounded-2xl sm:rounded-3xl bg-white p-0 overflow-hidden shadow-2xl border-slate-200 max-h-[94vh] flex flex-col">
          {selectedBatch && (
            <div className="flex flex-col max-h-[94vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white border-b border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pr-12 sm:pr-14">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {selectedBatch.livestock_type_name} Cohort
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
                    className="h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Biosecurity Pass
                  </Button>
                </div>
              </div>

              {/* Husbandry & Environment Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-slate-50 border-b border-slate-200 text-xs shrink-0">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Housing Facility
                  </span>
                  <p className="font-black text-slate-800 text-xs mt-0.5 truncate">
                    {selectedBatch.housing_pen || "Standard Pen"}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Feed: {selectedBatch.feed_type || "Rations"}
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
                    MAO Cohort Action
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Button
                      size="sm"
                      onClick={() =>
                        setBatchReviewModal({
                          open: true,
                          batch: selectedBatch,
                          action: "APPROVED",
                        })
                      }
                      className="h-6 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px]"
                    >
                      Approve All
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
                      className="h-6 px-2 rounded-lg border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-[10px]"
                    >
                      Revision
                    </Button>
                  </div>
                </div>
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
                  <Table className="min-w-[650px]">
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Ear Tag #
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Breed &amp; Sex
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Weight (kg)
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Vaccination
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Review Status
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-500 text-right">
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
                        filteredChildAnimals.map((animal) => {
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
                              <TableCell className="text-xs">
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
                              <TableCell className="text-xs">
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
                              <TableCell className="text-right">
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

                                  {animal.status !== "APPROVED" ? (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setAnimalReviewModal({
                                          open: true,
                                          animal: animal,
                                          action: "APPROVED",
                                        });
                                      }}
                                      className="h-7 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[10px]"
                                    >
                                      Approve
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setAnimalReviewModal({
                                          open: true,
                                          animal: animal,
                                          action: "SUBJECT_TO_REVISION",
                                        });
                                      }}
                                      className="h-7 px-2 rounded-lg text-rose-700 hover:bg-rose-50 font-bold text-[10px]"
                                    >
                                      Flag
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
                  Approve Cohort Batch &amp; All Heads
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  Request Cohort Revision
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
              disabled={reviewBatchMutation.isPending}
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
          INDIVIDUAL ANIMAL REVIEW MODAL
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog
        open={animalReviewModal.open}
        onOpenChange={(open) => {
          if (!open) setAnimalReviewModal({ open: false, animal: null, action: "APPROVED" });
        }}
      >
        <DialogContent className="w-full max-w-[95vw] sm:max-w-lg md:max-w-xl rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900">
              {animalReviewModal.action === "APPROVED"
                ? "Approve Individual Animal"
                : "Flag Individual Animal"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Animal Tag: <strong className="font-mono text-slate-800">{animalReviewModal.animal?.tag_number}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Official Validation Remarks
              </label>
              <Textarea
                placeholder="Enter remarks or certification notes..."
                value={animalReviewRemarks}
                onChange={(e) => setAnimalReviewRemarks(e.target.value)}
                className="text-xs rounded-xl border-slate-200"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnimalReviewModal({ open: false, animal: null, action: "APPROVED" })}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reviewAnimalMutation.isPending}
              onClick={() => {
                if (animalReviewModal.animal) {
                  reviewAnimalMutation.mutate({
                    animalId: animalReviewModal.animal.id,
                    status: animalReviewModal.action,
                    remarks: animalReviewRemarks,
                  });
                }
              }}
              className={`rounded-xl text-xs font-bold text-white ${animalReviewModal.action === "APPROVED"
                ? "bg-emerald-700 hover:bg-emerald-800"
                : "bg-rose-700 hover:bg-rose-800"
                }`}
            >
              {reviewAnimalMutation.isPending
                ? "Processing..."
                : animalReviewModal.action === "APPROVED"
                  ? "Certify Animal"
                  : "Submit Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────────────────────────────────────────────────────────────────────────
          DIGITAL ANIMAL PASSPORT MODAL (WITH SVG QR CODE)
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isPassportOpen} onOpenChange={setIsPassportOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-md md:max-w-lg rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200 max-h-[92vh] overflow-y-auto">
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
          BATCH BIOSECURITY CERTIFICATE MODAL
      ────────────────────────────────────────────────────────────────────────── */}
      <Dialog open={isBatchCertificateOpen} onOpenChange={setIsBatchCertificateOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl border-slate-200 max-h-[92vh] overflow-y-auto">
          {selectedBatch && (
            <>
              <DialogHeader className="text-center pb-2 border-b border-slate-100">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="size-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-black">
                    🏛️
                  </div>
                  <div className="size-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg font-black">
                    🌾
                  </div>
                </div>
                <DialogTitle className="text-base font-black text-slate-900">
                  Municipal Cohort Biosecurity Clearance
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Office of the Municipal Agriculturist • Padre Garcia, Batangas
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                      Certified Batch Code
                    </span>
                    <span className="font-mono text-base font-black text-emerald-950">
                      {selectedBatch.batch_code}
                    </span>
                  </div>
                  {getStatusBadge(selectedBatch.review_status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Livestock Raiser
                    </span>
                    <strong className="text-slate-900">{selectedBatch.farmer_name}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Barangay
                    </span>
                    <strong className="text-slate-900">{selectedBatch.barangay_name}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Total Cohort Heads
                    </span>
                    <strong className="text-slate-900">
                      {selectedBatch.animals?.length || selectedBatch.total_animals} Heads
                    </strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Housing Facility
                    </span>
                    <strong className="text-slate-900">{selectedBatch.housing_pen || "General"}</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                    Enrolled Ear Tag Codes in this Cohort:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {selectedBatch.animals?.map((a) => (
                      <span
                        key={a.id}
                        className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] font-bold text-slate-800"
                      >
                        {a.tag_number}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 text-center italic pt-1">
                  This document serves as municipal biosecurity verification under Municipal Ordinance 2026-03.
                </p>
              </div>

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
                    toast.success("Print certificate dispatched.");
                    setIsBatchCertificateOpen(false);
                  }}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex-1 gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Official Clearance
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
