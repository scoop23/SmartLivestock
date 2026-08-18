"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, ChevronRight } from "lucide-react";
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

import {
  PRODUCTION_TYPE_LABELS,
  fetchProductionRecords,
  type ProductionRecordItem,
  type ProductionStatus,
} from "./production-analytics";
import ProductionRecordDialog from "./production-record-dialog";

export interface ApiError {
  detail?: string;
  [key: string]: unknown;
}

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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ProductionRecordItem | null>(null);

  const filteredRecords = userProductions.filter(
    (r) =>
      (typeFilter === "ALL" || r.production_type === typeFilter) &&
      (statusFilter === "ALL" || r.status === statusFilter) &&
      (search === "" || r.notes.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-50/50 border-slate-200"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {isLoading ? (
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
            key={record.id != null ? `history-record-${record.id}` : `history-record-${index}-${record.created_at || record.record_date || ""}`}
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
                        className={`uppercase tracking-wider ${typeClasses[record.production_type] ?? "bg-slate-100 text-slate-800"}`}
                      >
                        {PRODUCTION_TYPE_LABELS[record.production_type]}
                      </Badge>
                      <Badge
                        className={`uppercase tracking-wider ${statusClasses[record.status] ?? DEFAULT_STATUS_CLASS}`}
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
                        {new Date(record.created_at).toLocaleDateString("en-US", {
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
                    {record.review_remarks ? (
                      <p className="text-xs text-slate-500 mt-1">
                        Review: {record.review_remarks}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </button>
        ))
      )}

      <ProductionRecordDialog
        record={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
