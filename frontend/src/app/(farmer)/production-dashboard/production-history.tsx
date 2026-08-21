"use client";

import { useState, useMemo } from "react";
import { AxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Filter, ChevronRight,
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ArrowUpDown,
  SlidersHorizontal,
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
  ProductionType,
  fetchProductionRecords,
  type ProductionRecordItem,
  type ProductionStatus,
} from "./production-analytics";
import ProductionRecordDialog from "./production-record-dialog";
import { EntryType } from "../livestock-inventory/page";
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

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
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

  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [productionType, setProductionType] = useState<ProductionType>("milk");
  const [selected, setSelected] = useState<ProductionRecordItem | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const filteredRecords = userProductions.filter(
    (r) =>
      (typeFilter === "ALL" || r.productionType === typeFilter) &&
      (statusFilter === "ALL" || r.status === statusFilter) &&
      (searchQuery === "" || r.notes.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: userProductions.length, APPROVED: 0, PENDING: 0, REJECTED: 0 };
    userProductions.forEach((item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1
    });
    return counts;
  }, [userProductions])

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    let result = userProductions.filter((item) => {
      const matchedSearch = !query ||
        item?.notes.includes(query) ||
        item?.productionType.includes(query) ||
        item?.status.includes(query)

      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const matchesType = productionType === "milk" || item.productionType === productionType
      return matchedSearch && matchesStatus && matchesType;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();  // getTime: converts Date into a number
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "quantity_desc":
          return b.quantity - a.quantity;
        case "quantity_asc":
          return a.quantity - b.quantity;
        default:
          return 0
      }
    });

    return result;
  }, [userProductions, searchQuery, statusFilter, productionType, sortBy])
  console.log(filtered)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-3 ">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search notes..."
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
                {
                  SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))
                }
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        <Separator className="opacity-60" />

        <div className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 mr-0.5 shrink-0 hidden sm:block" />
            {
              STATUS_CHIPS.map((chip) => {
                const isActive = statusFilter === chip.value;
                const count = statusCounts[chip.value] ?? 0;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setStatusFilter(chip.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold
                    border transition-all duration-200 active:scale-95 ${isActive ? chip.activeClass : "bg-white border-slate-500 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`
                    }
                  >
                    {!isActive && <span className={`w-1.5 h-1.5 rounded-full ${chip.dotClass}`}></span>}
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
                )
              })
            }
          </div>

        </div>

      </div>

      {
        isLoading ? (
          <div className="flex justify-center py-8">
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

            <Button
              className="mt-4"
              onClick={() => refetch()}
            >
              Try Again
            </Button>
          </Card>
        ) : filteredRecords.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-200">
            <p className="text-slate-500 text-center items-center flex justify-center">
              No production records match your filter.
            </p>
          </Card>
        ) : (
          filteredRecords.map((record: ProductionRecordItem, index: number) => (
            <button
              key={record.id != null ? `history-record-${record.id}` : `history - record - ${index} -${record.created_at || record.record_date || ""} `}
              type="button"
              onClick={() => setSelected(record)}
              className="w-full text-left transition-shadow"
            >
              <Card className="border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge
                          className={`uppercase tracking - wider ${typeClasses[record.productionType] ?? "bg-slate-100 text-slate-800"} `}
                        >
                          {PRODUCTION_TYPE_LABELS[record.productionType]}
                        </Badge>
                        <Badge
                          className={`uppercase tracking - wider ${statusClasses[record.status] ?? DEFAULT_STATUS_CLASS} `}
                        >
                          {record.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xl font-bold text-slate-900">
                          {record.quantity.toLocaleString()}{" "}
                          <span className="text-sm font-normal text-slate-500">
                            {formatUnit(record.unit)}
                          </span>
                        </p>
                        <span className="text-sm text-slate-500 font-medium">
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
                      <p className="text-sm text-slate-600 italic truncate">
                        {record.notes ? `"${record.notes}"` : "No notes added"}
                      </p>
                      {record.reviewRemarks ? (
                        <p className="text-xs text-slate-500 mt-1">
                          Review: {record.reviewRemarks}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            </button>
          ))
        )
      }

      <ProductionRecordDialog
        record={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div >
  );
}
