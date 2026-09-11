"use client";

import { useState, useMemo } from "react";
import { AxiosError } from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Filter,
  ChevronRight,
  ArrowDownWideNarrow,
  ArrowUpDown,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { STATUS_CHIPS, type SortKey } from "../livestock-inventory/livestock-record-list";

import {
  PRODUCTION_TYPE_LABELS,
  fetchProductionRecords,
  deleteProductionRecord,
  type ProductionRecordItem,
  type ProductionStatus,
} from "./production-analytics";
import ProductionRecordDialog from "./production-record-dialog";
import ProductionDeleteDialog from "./production-delete-dialog";
import ProductionApprovalCard from "./production-approval-card";
import { Separator } from "@/components/ui/separator";

export interface ApiError {
  detail?: string;
  [key: string]: unknown;
}

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ElementType }[] = [
  { value: "newest", label: "Newest First", icon: ArrowDownWideNarrow },
  { value: "oldest", label: "Oldest First", icon: ArrowUpDown },
  { value: "quantity_desc", label: "Most Heads", icon: ArrowDownWideNarrow },
  { value: "quantity_asc", label: "Fewest Heads", icon: ArrowUpDown },
];

const statusClasses: Record<ProductionStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  REJECTED: "bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200",
};

const DEFAULT_STATUS_CLASS =
  "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200";

const typeClasses: Record<string, string> = {
  milk: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200",
  eggs: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  wool: "bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200",
};

const formatUnit = (unit: string) =>
  unit === "LITERS" ? "L" : unit === "KILOGRAMS" ? "kg" : unit === "PIECES" ? "pc" : unit;

export default function ProductionHistory() {
  const queryClient = useQueryClient();

  const {
    data: userProductions = [],
    isError,
    error,
    refetch,
    isLoading,
  } = useQuery<ProductionRecordItem[], AxiosError<ApiError>>({
    queryKey: ["production"],
    queryFn: fetchProductionRecords,
  });

  const [deleteTarget, setDeleteTarget] = useState<ProductionRecordItem | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<ProductionRecordItem | null>(null);
  const [dialogRecord, setDialogRecord] = useState<ProductionRecordItem | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProductionRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
      if (selected?.id === deleteTarget?.id) {
        setSelected(null);
      }
      if (dialogRecord?.id === deleteTarget?.id) {
        setDialogRecord(null);
      }
      setDeleteTarget(null);
      toast.success("Production record deleted successfully");
    },
    onError: (err: AxiosError<{ error?: string; detail?: string }>) => {
      const msg =
        err.response?.data?.error ??
        err.response?.data?.detail ??
        "Failed to delete production record";
      toast.error(msg);
    },
  });

  const handleDelete = (record: ProductionRecordItem) => {
    if (record.status === "APPROVED") {
      toast.error("Approved records cannot be deleted.");
      return;
    }
    setDialogRecord(null);
    setDeleteTarget(record);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: userProductions.length, APPROVED: 0, PENDING: 0, REJECTED: 0 };
    userProductions.forEach((item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    });
    return counts;
  }, [userProductions]);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let result = userProductions.filter((item) => {
      const matchedSearch =
        !query ||
        item.notes?.toLowerCase().includes(query) ||
        item.productionType?.toLowerCase().includes(query) ||
        item.status?.toLowerCase().includes(query) ||
        item.livestockTypeName?.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const matchesType = typeFilter === "ALL" || item.productionType === typeFilter;
      return matchedSearch && matchesStatus && matchesType;
    });

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
        default:
          return 0;
      }
    });

    return result;
  }, [userProductions, searchQuery, statusFilter, typeFilter, sortBy]);

  const activeRecord = useMemo(() => {
    if (selected) {
      const found = filtered.find((item) => item.id === selected.id);
      if (found) return found;
    }
    return filtered.length > 0 ? filtered[0] : null;
  }, [selected, filtered]);

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-3 ">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search notes, type, or livestock..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="milk">Milk</SelectItem>
                <SelectItem value="eggs">Eggs</SelectItem>
                <SelectItem value="wool">Wool</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="opacity-60" />

        <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-3">
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                  border transition-all duration-200 active:scale-95 ${
                    isActive
                      ? chip.activeClass
                      : "bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {!isActive && <span className={`w-1.5 h-1.5 rounded-full ${chip.dotClass}`}></span>}
                  {chip.label}
                  <span
                    className={`
                    text-[10px] font-extrabold tabular-nums ml-0.5 px-1.5 py-0.5 rounded-full leading-none
                    ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-500"
                    }
                  `}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-16 text-emerald-600" />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center border-red-200 bg-red-50">
          <h3 className="font-semibold text-red-700">
            Failed to load production records
          </h3>
          <p className="text-sm text-red-600 mt-2">
            {error.response?.data?.detail ??
              error.message ??
              "Something went wrong."}
          </p>
          <Button className="mt-4" onClick={() => refetch()}>
            Try Again
          </Button>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <Card className="p-10 text-center border-dashed border-slate-200 bg-white">
              <p className="text-slate-500 font-medium">
                No production records match your filter criteria.
              </p>
            </Card>
          </div>
          <div className="lg:col-span-5">
            <ProductionApprovalCard
              record={null}
              totalApprovedCount={statusCounts.APPROVED ?? 0}
              totalRecordsCount={userProductions.length}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Production Records List */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Showing {filtered.length} {filtered.length === 1 ? "Record" : "Records"}
              </p>
              <p className="text-xs text-slate-400 hidden lg:block">
                Click any record to view approval & remark details on the right
              </p>
            </div>

            {filtered.map((record: ProductionRecordItem, index: number) => {
              const isSelected = activeRecord?.id === record.id;
              const isApproved = record.status === "APPROVED";

              return (
                <div
                  key={record.id != null ? `history-record-${record.id}` : `history-record-${index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelected(record);
                    if (typeof window !== "undefined" && window.innerWidth < 1024) {
                      setDialogRecord(record);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(record);
                    }
                  }}
                  className="w-full text-left transition-all cursor-pointer group focus:outline-none"
                >
                  <Card
                    className={`transition-all duration-200 ${
                      isSelected
                        ? "border-emerald-600 ring-2 ring-emerald-600/30 bg-emerald-50/20 shadow-md"
                        : "border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 bg-white"
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Badge
                              className={`uppercase tracking-wider ${
                                typeClasses[record.productionType] ?? "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {PRODUCTION_TYPE_LABELS[record.productionType]}
                            </Badge>
                            <Badge
                              className={`uppercase tracking-wider ${
                                statusClasses[record.status] ?? DEFAULT_STATUS_CLASS
                              }`}
                            >
                              {record.status}
                            </Badge>
                            {isSelected && (
                              <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                                Selected Details
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-baseline gap-2 mb-1.5">
                            <p className="text-xl font-black text-slate-900">
                              {record.quantity.toLocaleString()}{" "}
                              <span className="text-xs font-bold text-slate-500">
                                {formatUnit(record.unit)}
                              </span>
                            </p>
                            <span className="text-xs text-slate-500 font-medium">
                              •{" "}
                              {new Date(record.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 italic truncate max-w-md">
                            {record.notes ? `"${record.notes}"` : "No notes added"}
                          </p>

                          {/* Inline preview for approved remarks if present */}
                          {isApproved && record.reviewRemarks && (
                            <div className="mt-2.5 p-2 rounded-lg bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-950 flex items-center gap-1.5">
                              <span className="font-bold text-emerald-800 shrink-0">
                                Remark:
                              </span>
                              <span className="truncate italic font-medium">
                                &ldquo;{record.reviewRemarks}&rdquo;
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 mt-1">
                          {record.status !== "APPROVED" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(record);
                              }}
                              title="Delete / cancel record"
                              className="rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          <ChevronRight
                            className={`w-4 h-4 transition-transform ${
                              isSelected
                                ? "text-emerald-700 translate-x-0.5"
                                : "text-slate-300 group-hover:text-slate-400"
                            }`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Right: Approval & Remark Details Side Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
            <ProductionApprovalCard
              record={activeRecord}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
              totalApprovedCount={statusCounts.APPROVED ?? 0}
              totalRecordsCount={userProductions.length}
            />
          </div>
        </div>
      )}

      {/* Mobile Detailed Dialog */}
      <ProductionRecordDialog
        record={dialogRecord}
        open={dialogRecord !== null}
        onOpenChange={(open) => {
          if (!open) setDialogRecord(null);
        }}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <ProductionDeleteDialog
        record={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
