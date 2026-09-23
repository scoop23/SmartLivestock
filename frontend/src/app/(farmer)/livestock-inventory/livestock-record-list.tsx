"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  Info,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Tag,
  Trash2,
  Weight,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/components/ui/utils";
import { toast } from "sonner";
import type { LivestockInventoryItem, StatusType, EntryType } from "./page";

/* ── Species Color Palette & Styling ── */
interface SpeciesTheme {
  label: string;
  badge: string;
  dot: string;
}

const getSpeciesTheme = (typeName?: string): SpeciesTheme => {
  const name = (typeName || "").toLowerCase();
  if (name.includes("cattle") || name.includes("cow") || name.includes("baka")) {
    return {
      label: "Cattle",
      badge: "bg-amber-50 text-amber-900 border-amber-200",
      dot: "bg-amber-500",
    };
  }
  if (name.includes("carabao") || name.includes("kalabaw") || name.includes("buffalo")) {
    return {
      label: "Carabao",
      badge: "bg-indigo-50 text-indigo-900 border-indigo-200",
      dot: "bg-indigo-500",
    };
  }
  if (name.includes("swine") || name.includes("pig") || name.includes("baboy") || name.includes("hog")) {
    return {
      label: "Swine",
      badge: "bg-rose-50 text-rose-900 border-rose-200",
      dot: "bg-rose-500",
    };
  }
  if (name.includes("goat") || name.includes("kambing")) {
    return {
      label: "Goat",
      badge: "bg-emerald-50 text-emerald-900 border-emerald-200",
      dot: "bg-emerald-500",
    };
  }
  if (name.includes("sheep") || name.includes("tupa")) {
    return {
      label: "Sheep",
      badge: "bg-sky-50 text-sky-900 border-sky-200",
      dot: "bg-sky-500",
    };
  }
  if (name.includes("poultry") || name.includes("chicken") || name.includes("manok") || name.includes("duck")) {
    return {
      label: "Poultry",
      badge: "bg-orange-50 text-orange-900 border-orange-200",
      dot: "bg-orange-500",
    };
  }
  return {
    label: typeName || "Livestock",
    badge: "bg-slate-50 text-slate-800 border-slate-200",
    dot: "bg-slate-500",
  };
};

/* ── Status badge for record items (Accessibility-compliant high contrast) ── */
export const getStatusBadge = (status: StatusType) => {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Approved
        </Badge>
      );
    case "VERIFIED":
      return (
        <Badge className="bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          Verified by SIBAT
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pending
        </Badge>
      );
    case "SUBJECT_TO_REVISION":
    case "REJECTED":
      return (
        <Badge className="bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200/90 font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          Needs Revision
        </Badge>
      );
    default:
      return null;
  }
};

/* ── Status chip config (Preserved for exports & production-history compatibility) ── */
export const STATUS_CHIPS: {
  value: StatusType | "ALL";
  label: string;
  icon: React.ElementType;
  activeClass: string;
  dotClass: string;
  count?: number;
}[] = [
  {
    value: "ALL",
    label: "All Records",
    icon: Layers,
    activeClass: "bg-slate-900 text-white border-slate-900 shadow-sm",
    dotClass: "bg-slate-400",
  },
  {
    value: "APPROVED",
    label: "Approved",
    icon: CheckCircle2,
    activeClass: "bg-emerald-700 text-white border-emerald-700 shadow-sm",
    dotClass: "bg-emerald-500",
  },
  {
    value: "VERIFIED",
    label: "Verified by SIBAT",
    icon: ShieldCheck,
    activeClass: "bg-sky-700 text-white border-sky-700 shadow-sm",
    dotClass: "bg-sky-500",
  },
  {
    value: "PENDING",
    label: "Pending Review",
    icon: Clock,
    activeClass: "bg-amber-600 text-white border-amber-600 shadow-sm",
    dotClass: "bg-amber-500",
  },
  {
    value: "SUBJECT_TO_REVISION",
    label: "Needs Revision",
    icon: RotateCcw,
    activeClass: "bg-rose-700 text-white border-rose-700 shadow-sm",
    dotClass: "bg-rose-500",
  },
];

/* ── Sort options ── */
export type SortKey =
  | "newest"
  | "oldest"
  | "quantity_desc"
  | "quantity_asc"
  | "breed_az"
  | "weight_desc"
  | "weight_asc";

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ElementType }[] = [
  { value: "newest", label: "Newest First", icon: ArrowDownWideNarrow },
  { value: "oldest", label: "Oldest First", icon: ArrowUpDown },
  { value: "quantity_desc", label: "Most Heads", icon: ArrowDownWideNarrow },
  { value: "quantity_asc", label: "Fewest Heads", icon: ArrowUpDown },
  { value: "breed_az", label: "Breed A → Z", icon: ArrowDownAZ },
  { value: "weight_desc", label: "Weight: High to Low", icon: Scale },
  { value: "weight_asc", label: "Weight: Low to High", icon: Scale },
];

/* ── Component Props ── */
export interface LivestockRecordListProps {
  items: LivestockInventoryItem[];
  isLoading: boolean;
  livestockTypes?: Record<string, number>;
  onView: (item: LivestockInventoryItem) => void;
  onEdit: (item: LivestockInventoryItem) => void;
  onDelete: (item: LivestockInventoryItem) => void;
  onAddRecord?: () => void;
}

export default function LivestockRecordList({
  items,
  isLoading,
  livestockTypes,
  onView,
  onEdit,
  onDelete,
  onAddRecord,
}: LivestockRecordListProps) {
  const router = useRouter();

  // View mode: "grid" | "table"
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Filtering states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(12);

  /* Count active filters */
  const activeFilterCount = [
    statusFilter !== "ALL",
    typeFilter !== "ALL",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setSortBy("newest");
    setCurrentPage(1);
  };

  /* Filter + sort pipeline */
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let result = items.filter((item) => {
      const matchesSearch =
        !query ||
        item?.tagNumber?.toLowerCase().includes(query) ||
        item.breed?.toLowerCase().includes(query) ||
        item.livestockTypeName?.toLowerCase().includes(query) ||
        item.farmerName?.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "ALL" ||
        item.status === statusFilter ||
        (statusFilter === "SUBJECT_TO_REVISION" &&
          (item.status === "SUBJECT_TO_REVISION" || item.status === "REJECTED"));

      const matchesType =
        typeFilter === "ALL" || item.livestockTypeName === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "quantity_desc":
          return (b.quantity || 1) - (a.quantity || 1);
        case "quantity_asc":
          return (a.quantity || 1) - (b.quantity || 1);
        case "breed_az":
          return (a.breed || "").localeCompare(b.breed || "");
        case "weight_desc":
          return (Number(b.weight) || 0) - (Number(a.weight) || 0);
        case "weight_asc":
          return (Number(a.weight) || 0) - (Number(b.weight) || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, statusFilter, typeFilter, sortBy]);

  /* Reset pagination to page 1 whenever filters change */
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, sortBy, pageSize]);

  /* Paginated slice */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /* Slim Horizontal Metrics Summary */
  const metrics = useMemo(() => {
    const totalHeads = filtered.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);
    const approvedCount = filtered.filter((i) => i.status === "APPROVED").length;
    const verifiedCount = filtered.filter((i) => i.status === "VERIFIED").length;
    const pendingCount = filtered.filter((i) => i.status === "PENDING").length;
    const revisionCount = filtered.filter(
      (i) => i.status === "SUBJECT_TO_REVISION" || i.status === "REJECTED"
    ).length;
    const vaxCount = filtered.filter((i) => Boolean(i.lastVaccinationDate)).length;
    const vaxRate = filtered.length > 0 ? Math.round((vaxCount / filtered.length) * 100) : 0;

    return { totalHeads, approvedCount, verifiedCount, pendingCount, revisionCount, vaxCount, vaxRate };
  }, [filtered]);

  /* Copy Tag to clipboard */
  const handleCopyTag = (tag: string) => {
    if (!tag) return;
    navigator.clipboard.writeText(tag);
    toast.success("Ear Tag Copied", {
      description: `${tag} has been copied to your clipboard.`,
    });
  };

  /* Export CSV of currently filtered dataset */
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      toast.error("No records to export.");
      return;
    }

    const headers = [
      "Record ID",
      "Tag Number / Batch ID",
      "Entry Type",
      "Species",
      "Breed",
      "Sex",
      "Quantity",
      "Weight (kg)",
      "Last Vaccination Date",
      "Status",
      "Date Registered",
      "Officer Remarks",
    ];

    const rows = filtered.map((item) => [
      item.id,
      item.tagNumber || `Batch-${item.id}`,
      item.entryType,
      item.livestockTypeName,
      item.breed || "Standard",
      item.sex,
      item.quantity,
      item.weight ?? "N/A",
      item.lastVaccinationDate ?? "Pending",
      item.status,
      item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "",
      `"${(item.reviewRemarks || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `SmartLivestock_Registry_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Registry Exported", {
      description: `Downloaded ${filtered.length} records as CSV spreadsheet.`,
    });
  };

  return (
    <div className="space-y-3.5">
      {/* ═══ 2. Top Metrics Summary: Slim Horizontal KPI Bar ═══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap text-xs shadow-2xs">
        <div className="flex items-center gap-5 sm:gap-7 flex-wrap">
          {/* Total Heads */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#1E4D2B]/10 text-[#1E4D2B] flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5 text-[#1E4D2B]" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {metrics.totalHeads}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Total Heads
              </span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-4 bg-slate-200" />

          {/* Active Records */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {filtered.length}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Active Records
              </span>
            </div>
          </div>

          <div className="hidden sm:block w-px h-4 bg-slate-200" />

          {/* Vaccination Status */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {metrics.vaxRate}%
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Vaccinated
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
                ({metrics.vaxCount}/{filtered.length})
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicators Pill Breakdown */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {metrics.approvedCount} Approved
          </span>
          {metrics.verifiedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
              {metrics.verifiedCount} Verified by SIBAT
            </span>
          )}
          {metrics.pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
              {metrics.pendingCount} Pending
            </span>
          )}
          {metrics.revisionCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-900 border border-rose-200">
              {metrics.revisionCount} Needs Revision
            </span>
          )}
        </div>
      </div>

      {/* ═══ 3. Sub-Header & Controls Bar ═══ */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Clean Search Bar */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by ear tag, breed, or species..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 bg-slate-50/80 border-slate-200 rounded-lg h-9 text-xs focus-visible:ring-[#1E4D2B]/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Inline Dropdown Filters & Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Species Dropdown */}
          {livestockTypes && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[125px] rounded-lg h-9 border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700">
                <SelectValue placeholder="All Species" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Species</SelectItem>
                {Object.entries(livestockTypes).map(([name, id]) => (
                  <SelectItem key={id} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Dropdown */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusType | "ALL")}
          >
            <SelectTrigger className="w-[155px] rounded-lg h-9 border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="VERIFIED">Verified by SIBAT</SelectItem>
              <SelectItem value="PENDING">Pending Review</SelectItem>
              <SelectItem value="SUBJECT_TO_REVISION">Needs Revision</SelectItem>
            </SelectContent>
          </Select>

          {/* Sorting Dropdown */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-[135px] rounded-lg h-9 border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <SelectValue placeholder="Sort by" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Grid / List View Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Cards Grid"
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={cn(
                "p-1.5 rounded-md transition-all",
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Export Button */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCSV}
                  className="h-9 px-3 rounded-lg border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700 font-bold text-xs gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Export filtered records as CSV spreadsheet
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Add Record Button */}
          <Button
            type="button"
            onClick={() => {
              if (onAddRecord) {
                onAddRecord();
              } else {
                router.push("/livestock-inventory");
              }
            }}
            className="h-9 px-3.5 rounded-lg bg-[#1E4D2B] hover:bg-[#163b21] text-white font-bold text-xs gap-1.5 shrink-0 shadow-2xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Record</span>
          </Button>

          {/* Reset Filters Icon */}
          {activeFilterCount > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Reset filters ({activeFilterCount} active)
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* ═══ Content Area: Loading / Empty / Grid / Table ═══ */}
      {isLoading ? (
        /* Premium Skeleton Loading States */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((sk) => (
            <Card
              key={sk}
              className="p-4 rounded-xl border border-slate-200 animate-pulse space-y-3 h-[270px] flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <div className="h-6 w-28 bg-slate-200 rounded-full" />
                <div className="h-5 w-20 bg-slate-200 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
                <div className="h-10 bg-slate-100 rounded-lg" />
              </div>
              <div className="h-8 bg-slate-100 rounded-lg" />
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div className="h-4 w-20 bg-slate-200 rounded" />
                <div className="h-7 w-20 bg-slate-200 rounded-lg" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty State */
        <Card className="py-14 border-dashed border-slate-300 rounded-xl bg-white shadow-2xs">
          <div className="flex flex-col items-center text-center space-y-2.5 px-6 max-w-md mx-auto">
            <div className="p-3 rounded-xl bg-[#1E4D2B]/10 text-[#1E4D2B]">
              <Search className="w-6 h-6 text-[#1E4D2B]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                No Matching Livestock Records
              </h3>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No records found matching "${searchQuery}".`
                  : activeFilterCount > 0
                  ? "None of your registered animals match the selected criteria."
                  : "No livestock animals have been registered in your inventory yet."}
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="rounded-lg text-xs font-bold gap-1.5 mt-1 border-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset all filters
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* ═══ 4. Data Display Cards: Structured Grid Layout ═══ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {paginatedItems.map((item) => {
            const hasVax = Boolean(item.lastVaccinationDate);
            const isApproved = item.status === "APPROVED";

            return (
              <Card
                key={item.id}
                className={cn(
                  "relative overflow-hidden bg-white border border-slate-200/90 rounded-xl transition-all duration-150",
                  "hover:border-[#1E4D2B]/50 hover:shadow-md flex flex-col justify-between h-[280px]",
                  item.status === "SUBJECT_TO_REVISION" && "border-rose-300/80 bg-rose-50/15"
                )}
              >
                <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
                  {/* Tag Header: High-visibility pill badge alongside clean status indicator */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 group min-w-0">
                      {item.entryType === "INDIVIDUAL" ? (
                        <div className="flex items-center gap-1.5 bg-[#1E4D2B] text-white font-mono px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide shadow-2xs shrink-0">
                          <Tag className="w-3 h-3 text-emerald-300" />
                          <span className="truncate max-w-[140px]">
                            {item.tagNumber || "TAG-UNASSIGNED"}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-teal-900 text-white px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide shadow-2xs shrink-0">
                          <Layers className="w-3 h-3 text-teal-300" />
                          <span>Batch ({item.quantity} Heads)</span>
                        </div>
                      )}

                      {item.tagNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopyTag(item.tagNumber)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 transition-opacity"
                          title="Copy ear tag"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Clean Status Badge */}
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>

                  {/* Core Stats: Compact 2-column layout (Weight, Immunization Status, Breed, Sex) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Weight */}
                    <div className="p-2 rounded-lg bg-slate-50/90 border border-slate-200/70 flex items-center gap-2">
                      <div className="p-1 rounded-md bg-white text-[#1E4D2B] shadow-2xs shrink-0">
                        <Weight className="w-3.5 h-3.5 text-[#1E4D2B]" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                          Weight
                        </span>
                        <span className="font-extrabold text-slate-900 truncate block leading-tight">
                          {item.weight ? `${item.weight} kg` : "Unrecorded"}
                        </span>
                      </div>
                    </div>

                    {/* Immunization Status */}
                    <div className="p-2 rounded-lg bg-slate-50/90 border border-slate-200/70 flex items-center gap-2">
                      <div className="p-1 rounded-md bg-white shadow-2xs shrink-0">
                        {hasVax ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                          Immunization
                        </span>
                        <span
                          className={cn(
                            "font-extrabold truncate block leading-tight",
                            hasVax ? "text-emerald-700" : "text-amber-600"
                          )}
                        >
                          {hasVax ? item.lastVaccinationDate : "Due for Vaccine"}
                        </span>
                      </div>
                    </div>

                    {/* Breed & Species */}
                    <div className="p-2 rounded-lg bg-slate-50/90 border border-slate-200/70 flex items-center gap-2">
                      <div className="p-1 rounded-md bg-white text-slate-700 shadow-2xs shrink-0">
                        <Sprout className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                          Breed
                        </span>
                        <span
                          className="font-extrabold text-slate-900 truncate block leading-tight"
                          title={`${item.breed || "Standard"} (${item.livestockTypeName})`}
                        >
                          {item.breed || "Standard"}
                        </span>
                      </div>
                    </div>

                    {/* Sex & Quantity */}
                    <div className="p-2 rounded-lg bg-slate-50/90 border border-slate-200/70 flex items-center gap-2">
                      <div className="p-1 rounded-md bg-white text-teal-700 shadow-2xs shrink-0">
                        <Tag className="w-3.5 h-3.5 text-teal-700" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">
                          Sex / Heads
                        </span>
                        <span className="font-extrabold text-slate-900 truncate block leading-tight">
                          {item.sex} • {item.quantity} {item.quantity === 1 ? "head" : "heads"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Remarks Section: Distinct, soft-tint alert box for official remarks (MAO Officer) with truncation */}
                  <div className="min-h-[36px] flex items-center">
                    {item.reviewRemarks ? (
                      <div className="w-full p-2 rounded-lg bg-rose-50/80 border border-rose-200/80 text-[11px] text-rose-950 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <p className="line-clamp-2 leading-relaxed min-w-0">
                          <strong className="font-bold text-rose-900">Officer Note:</strong>{" "}
                          {item.reviewRemarks}
                        </p>
                      </div>
                    ) : (
                      <div className="w-full p-1.5 rounded-lg bg-slate-50/60 border border-dashed border-slate-200/60 text-[10px] text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        <span>Standard registry record verified</span>
                      </div>
                    )}
                  </div>

                  {/* Footer Bar: Creation date aligned left, action icons subtle and right-aligned */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleDateString()
                          : "Registered"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onView(item)}
                              className="h-7 w-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            View full animal details
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(item)}
                                disabled={isApproved}
                                className="h-7 w-7 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {isApproved ? "Approved entries are locked" : "Edit animal record"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onDelete(item)}
                                disabled={isApproved}
                                className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {isApproved
                              ? "Approved entries cannot be deleted"
                              : "Delete record"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ═══ Pro Table View ═══ */
        <Card className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
          <Table>
            <TableHeader className="bg-slate-50/90 border-b border-slate-200">
              <TableRow>
                <TableHead className="font-bold text-slate-700 text-xs py-3">
                  Ear Tag / ID
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Species & Breed
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Sex
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Heads
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Weight
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Immunization
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Status
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs">
                  Registered
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs text-right pr-4">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                const hasVax = Boolean(item.lastVaccinationDate);
                const isApproved = item.status === "APPROVED";

                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                  >
                    {/* Ear Tag */}
                    <TableCell className="font-mono text-xs font-black py-2.5">
                      {item.entryType === "INDIVIDUAL" ? (
                        <span className="bg-[#1E4D2B] text-white px-2 py-0.5 rounded-full text-[11px] shadow-2xs">
                          {item.tagNumber || "TAG-UNASSIGNED"}
                        </span>
                      ) : (
                        <span className="bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
                          Batch ({item.quantity})
                        </span>
                      )}
                    </TableCell>

                    {/* Species & Breed */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs">
                          {item.breed || "Standard"}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {item.livestockTypeName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Sex */}
                    <TableCell className="text-xs font-semibold text-slate-700">
                      {item.sex}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="text-xs font-extrabold text-slate-900 tabular-nums">
                      {item.quantity}
                    </TableCell>

                    {/* Weight */}
                    <TableCell className="text-xs font-bold text-slate-800 tabular-nums">
                      {item.weight ? `${item.weight} kg` : "—"}
                    </TableCell>

                    {/* Immunization */}
                    <TableCell>
                      {hasVax ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.lastVaccinationDate}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 font-bold text-xs">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          <span>Pending</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Status Badge */}
                    <TableCell>{getStatusBadge(item.status)}</TableCell>

                    {/* Date */}
                    <TableCell className="text-xs font-medium text-slate-500 tabular-nums">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString()
                        : "—"}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(item)}
                          className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(item)}
                          disabled={isApproved}
                          className="h-7 w-7 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-25"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(item)}
                          disabled={isApproved}
                          className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ═══ Numbered Pagination Bar ═══ */}
      {filtered.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 px-1">
          <p className="text-xs text-slate-500 font-semibold">
            Page <strong className="text-slate-900">{currentPage}</strong> of{" "}
            <strong className="text-slate-900">{totalPages}</strong> ({filtered.length} total)
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 px-2 rounded-lg border-slate-200 text-xs font-bold disabled:opacity-30"
              title="First page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 rounded-lg border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </Button>

            {/* Numeric page pills */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && (
                        <span className="text-xs text-slate-400 px-1">...</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "h-8 min-w-[32px] px-2 rounded-lg text-xs font-bold transition-colors",
                          currentPage === p
                            ? "bg-[#1E4D2B] text-white shadow-2xs"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 rounded-lg border-slate-200 text-xs font-bold gap-1 disabled:opacity-30"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 px-2 rounded-lg border-slate-200 text-xs font-bold disabled:opacity-30"
              title="Last page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
