"use client";

import { useState, useMemo } from "react";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpDown,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Weight,
  X,
  XCircle,
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import type { LivestockInventoryItem, StatusType, EntryType } from "./page";

/* ── Status badge for record cards ── */
const getStatusBadge = (status: StatusType) => {
  switch (status) {
    case "APPROVED":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Approved
        </Badge>
      );
    case "PENDING":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 flex items-center gap-1 font-medium">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Pending Review
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 flex items-center gap-1 font-medium">
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
          Rejected
        </Badge>
      );
  }
};

/* ── Status chip config ── */
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
      label: "All",
      icon: Layers,
      activeClass: "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/20",
      dotClass: "bg-slate-400",
    },
    {
      value: "APPROVED",
      label: "Approved",
      icon: CheckCircle2,
      activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25",
      dotClass: "bg-emerald-500",
    },
    {
      value: "PENDING",
      label: "Pending",
      icon: Clock,
      activeClass: "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25",
      dotClass: "bg-amber-500",
    },
    {
      value: "REJECTED",
      label: "Rejected",
      icon: XCircle,
      activeClass: "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/25",
      dotClass: "bg-rose-500",
    },
  ];

/* ── Sort options ── */
export type SortKey = "newest" | "oldest" | "quantity_desc" | "quantity_asc" | "breed_az";

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ElementType }[] = [
  { value: "newest", label: "Newest First", icon: ArrowDownWideNarrow },
  { value: "oldest", label: "Oldest First", icon: ArrowUpDown },
  { value: "quantity_desc", label: "Most Heads", icon: ArrowDownWideNarrow },
  { value: "quantity_asc", label: "Fewest Heads", icon: ArrowUpDown },
  { value: "breed_az", label: "Breed A → Z", icon: ArrowDownAZ },
];

/* ── Component ── */
interface LivestockRecordListProps {
  items: LivestockInventoryItem[];
  isLoading: boolean;
  livestockTypes?: Record<string, number>;
  onView: (item: LivestockInventoryItem) => void;
  onEdit: (item: LivestockInventoryItem) => void;
  onDelete: (item: LivestockInventoryItem) => void;
}

export default function LivestockRecordList({
  items,
  isLoading,
  livestockTypes,
  onView,
  onEdit,
  onDelete,
}: LivestockRecordListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "ALL">("ALL");
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  /* Count active filters (excluding defaults) */
  const activeFilterCount = [
    statusFilter !== "ALL",
    entryTypeFilter !== "ALL",
    typeFilter !== "ALL",
    searchQuery.trim().length > 0,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setEntryTypeFilter("ALL");
    setTypeFilter("ALL");
    setSortBy("newest");
  };

  /* Status counts for chips */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length, APPROVED: 0, PENDING: 0, REJECTED: 0, };
    items.forEach((item) => { counts[item.status] = (counts[item.status] ?? 0) + 1; });
    return counts;
  }, [items]);

  /* Filter + sort pipeline */
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let result = items.filter((item) => {
      const matchesSearch =
        !query || // if query is nothing then true so bassically saying if query is nothing then show all.
        item?.tagNumber?.toLowerCase().includes(query) ||
        item.breed.toLowerCase().includes(query) ||
        item.livestockTypeName.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const matchesEntryType = entryTypeFilter === "ALL" || item.entryType === entryTypeFilter;
      const matchesType = typeFilter === "ALL" || item.livestockTypeName === typeFilter;
      return matchesSearch && matchesStatus && matchesEntryType && matchesType;
    });

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "quantity_desc":
          return b.quantity - a.quantity;
        case "quantity_asc":
          return a.quantity - b.quantity;
        case "breed_az":
          return a.breed.localeCompare(b.breed);
        default:
          return 0;
      }
    });

    return result;
  }, [items, searchQuery, statusFilter, entryTypeFilter, typeFilter, sortBy]);

  return (
    <div className="space-y-4">
      {/* ═══ Filter Bar ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Row 1: Search + Sort + Filter count */}
        <div className="p-3 flex flex-col sm:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search breed, tag number, type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 bg-slate-50/60 border-slate-200 rounded-xl h-10 text-sm focus-visible:ring-emerald-500/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort + Filter badge */}
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-[165px] rounded-xl h-10 border-slate-200 bg-slate-50/60 text-sm">
                <div className="flex items-center gap-2">
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

            {/* Livestock type filter (only when types are passed) */}
            {livestockTypes && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[155px] rounded-xl h-10 border-slate-200 bg-slate-50/60 text-sm">
                  <SelectValue placeholder="Animal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  {Object.entries(livestockTypes).map(([name, id]) => (
                    <SelectItem key={id} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Active filter count badge + clear */}
            {activeFilterCount > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="relative flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-rose-50 hover:border-rose-200 transition-all group shrink-0"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-500 group-hover:text-rose-500 transition-colors" />
                      <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white px-1 leading-none shadow-sm">
                        {activeFilterCount}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Clear all filters
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

        <Separator className="opacity-60" />

        {/* Row 2: Status chips + Entry type toggle */}
        <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Status chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0 hidden sm:block" />
            {STATUS_CHIPS.map((chip) => {
              const isActive = statusFilter === chip.value;
              const count = statusCounts[chip.value] ?? 0;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setStatusFilter(chip.value)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                    border transition-all duration-200 active:scale-95
                    ${isActive
                      ? chip.activeClass // if is active then change design
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }
                  `}
                >
                  {!isActive && <span className={`w-1.5 h-1.5 rounded-full ${chip.dotClass}`} />}
                  {chip.label}
                  <span className={`
                    text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none
                    ${isActive
                      ? "bg-white/25 text-white"
                      : "bg-slate-100 text-slate-500"
                    }
                  `}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Separator on desktop */}
          <div className="hidden sm:block w-px h-6 bg-slate-200" />

          {/* Entry type toggles */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">Entry</span>
            {(["ALL", "BATCH", "INDIVIDUAL"] as const).map((val) => {
              const isActive = entryTypeFilter === val;
              const label = val === "ALL" ? "All" : val === "BATCH" ? "Batch" : "Individual";
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => setEntryTypeFilter(val)}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 active:scale-95
                    ${isActive
                      ? "bg-emerald-900 text-white border-emerald-900 shadow-md shadow-emerald-900/15"
                      : "bg-white border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                    }
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Results count ═══ */}
      {!isLoading && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-slate-500">
            Showing{" "}
            <span className="text-emerald-950 font-extrabold tabular-nums">{filtered.length}</span>
            {" "}of{" "}
            <span className="text-emerald-950 font-extrabold tabular-nums">{items.length}</span>
            {" "}record{items.length !== 1 ? "s" : ""}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ═══ Record Cards ═══ */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-16 text-emerald-600" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="py-12 border-dashed border-slate-200 rounded-2xl">
            <div className="flex flex-col items-center text-center space-y-3 px-6">
              <div className="p-3 rounded-2xl bg-slate-100">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-700">No records found</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  {searchQuery
                    ? `No results for "${searchQuery}".`
                    : activeFilterCount > 0
                      ? "Try adjusting your filters to see more results."
                      : "No livestock records have been added yet."}
                </p>
              </div>
              {activeFilterCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="rounded-xl text-xs font-bold gap-1.5 mt-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset all filters
                </Button>
              )}
            </div>
          </Card>
        ) : (
          filtered.map((item) => (
            <Card
              key={item.id}
              className="relative overflow-hidden border-2 border-emerald-900/10 bg-emerald-50/30 hover:bg-emerald-50/60 shadow-xs hover:shadow-sm rounded-2xl transition-all duration-200"
            >
              <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between h-full space-y-3">
                {/* Top Header Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  <div className="space-y-1.5 flex-1 w-full">
                    {/* Main Title & Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-emerald-950 tracking-tight">
                        {item.entryType === "INDIVIDUAL"
                          ? item.tagNumber || "Un-tagged"
                          : `${item.quantity}x ${item.livestockTypeName} (Batch)`}
                      </h3>

                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900/70 bg-emerald-900/10 px-2 py-0.5 rounded-full">
                        {item.entryType}
                      </span>

                      {getStatusBadge(item.status)}
                    </div>

                    {/* Subtitle */}
                    <p className="text-xs font-semibold text-stone-600">
                      <span className="text-emerald-950 font-bold">
                        {item.livestockTypeName}
                      </span>{" "}
                      • {item.breed || "Standard Breed"} • {item.sex}
                    </p>

                    {/* Slimmer Stats Grid with Inner Depth */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      {/* Weight */}
                      {item.weight && (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                          <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                            <Weight className="w-3.5 h-3.5 text-emerald-900" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Weight</span>
                            <span className="font-extrabold text-emerald-950 truncate leading-tight">{item.weight} kg</span>
                          </div>
                        </div>
                      )}

                      {/* Vaccination */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                        <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-emerald-900" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Vaccinated</span>
                          {item.lastVaccinationDate ? (
                            <span className="font-extrabold text-emerald-950 truncate leading-tight">{item.lastVaccinationDate}</span>
                          ) : (
                            <span className="font-extrabold text-amber-700 truncate leading-tight">No</span>
                          )}
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                        <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                          <Tag className="w-3.5 h-3.5 text-emerald-900" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Quantity</span>
                          <span className="font-extrabold text-emerald-950 truncate leading-tight">{item.quantity} head</span>
                        </div>
                      </div>

                      {/* Created Date */}
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white/70 border border-emerald-900/10 shadow-2xs">
                        <div className="p-1 rounded-lg bg-emerald-900/10 shrink-0">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-900" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Created</span>
                          <span className="font-extrabold text-emerald-950 truncate leading-tight">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Review Remarks Note */}
                    {item.reviewRemarks && (
                      <div className="mt-2 p-2.5 bg-rose-500/10 border-2 border-rose-900/10 rounded-xl text-xs text-rose-950">
                        <strong className="font-extrabold">Review Note:</strong> {item.reviewRemarks}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(item)}
                      className="rounded-xl h-8 px-2.5 text-xs font-extrabold text-emerald-950 hover:bg-emerald-900/10"
                    >
                      View Details
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(item)}
                      disabled={item.status === "APPROVED"}
                      title={
                        item.status === "APPROVED"
                          ? "Approved entries can no longer be edited"
                          : "Edit entry"
                      }
                      className="rounded-xl text-emerald-950 hover:bg-emerald-900/10 disabled:opacity-30 disabled:cursor-not-allowed h-8 w-8"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      disabled={item.status === "APPROVED"}
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item)}
                      className="rounded-xl text-stone-600 hover:text-rose-600 hover:bg-rose-500/10 h-8 w-8"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
