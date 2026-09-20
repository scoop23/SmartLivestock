"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Droplets,
  Edit2,
  Filter,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PRODUCTION_TYPE_LABELS,
  formatRecordDate,
  type ProductionRecordItem,
  type ProductionStatus,
} from "./production-analytics";
import ProductionRecordDialog from "./production-record-dialog";

const statusClasses: Record<ProductionStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  REJECTED: "bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200",
};

const DEFAULT_STATUS_CLASS =
  "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200";

const formatUnit = (unit: string) =>
  unit === "LITERS" ? "L" : unit === "KILOGRAMS" ? "kg" : unit === "PIECES" ? "pc" : unit;

export default function ProductionRecent({
  records,
  showViewMore = true,
  onEdit,
  onDelete,
}: {
  records: ProductionRecordItem[];
  showViewMore?: boolean;
  onEdit?: (record: ProductionRecordItem) => void;
  onDelete?: (record: ProductionRecordItem) => void;
}) {
  const [selected, setSelected] = useState<ProductionRecordItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProductionStatus>("ALL");
  const [query, setQuery] = useState("");

  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
        const q = query.toLowerCase().trim();
        const matchesQuery =
          !q ||
          r.productionType.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q) ||
          (r.livestockTypeName || "").toLowerCase().includes(q) ||
          r.recordDate.includes(q);
        return matchesStatus && matchesQuery;
      })
      .slice(0, 7);
  }, [records, statusFilter, query]);

  const found = records.find((item) => item.id === selected?.id);

  return (
    <Card className="border-slate-200 shadow-sm rounded-3xl overflow-hidden bg-white">
      <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-100 text-sky-700">
              <Droplets className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Recent Production Output Feed
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Latest submitted yields awaiting municipal validation or verified
              </CardDescription>
            </div>
          </div>

          {showViewMore && (
            <Link
              href="/production-dashboard/history"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto"
            >
              Full Production History
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 mt-1">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <Input
              placeholder="Search notes, date, or livestock..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8.5 pl-8 text-xs bg-slate-50/70 border-slate-200 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {(["ALL", "APPROVED", "PENDING", "REJECTED"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All Status" : st}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <Droplets className="size-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No records found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {query || statusFilter !== "ALL"
                ? "Try clearing filters to see more results."
                : "Record your first daily yield to start logging."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map((record) => {
              const isPending = record.status === "PENDING";
              return (
                <div
                  key={record.id}
                  onClick={() => setSelected(record)}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="size-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700 shrink-0 font-bold text-xs">
                      {record.quantity}
                      <span className="text-[9px] font-normal ml-0.5">{formatUnit(record.unit)}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          {PRODUCTION_TYPE_LABELS[record.productionType] ?? "Yield"}
                        </span>
                        <Badge
                          className={`text-[10px] font-bold uppercase tracking-wider ${
                            statusClasses[record.status] ?? DEFAULT_STATUS_CLASS
                          }`}
                        >
                          {record.status}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          • {formatRecordDate(record.recordDate)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">
                        {record.notes ? `"${record.notes}"` : "No notes logged for this batch"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {isPending && onEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(record);
                        }}
                        className="h-8 px-2.5 text-xs text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl"
                      >
                        <Edit2 className="size-3.5 mr-1 text-slate-400" />
                        Edit
                      </Button>
                    )}
                    {isPending && onDelete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(record);
                        }}
                        className="h-8 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                    <span className="text-xs font-semibold text-emerald-800 group-hover:underline flex items-center gap-1">
                      Details <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <ProductionRecordDialog
        record={found ?? null}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onEdit={onEdit}
        onDelete={(record) => {
          setSelected(null);
          onDelete?.(record);
        }}
      />
    </Card>
  );
}

