"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Droplets } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  showViewMore = false,
  onEdit,
}: {
  records: ProductionRecordItem[];
  showViewMore?: boolean;
  onEdit?: (record: ProductionRecordItem) => void;
}) {
  const [selected, setSelected] = useState<ProductionRecordItem | null>(null);
  const recentRecords = [...records]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-100/80">
              <Droplets className="w-4 h-4 text-sky-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Production</h3>
              <p className="text-xs text-slate-500">Latest submitted production records</p>
            </div>
          </div>

          {showViewMore ? (
            <Link
              href="/production-dashboard/history"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline mt-0.5"
            >
              View more production
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>

        {recentRecords.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No production records yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelected(record)}
                className="w-full flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 text-left hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0 flex items-center justify-center size-9 rounded-lg bg-slate-50 border border-slate-200">
                    <CalendarDays className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {formatRecordDate(record.record_date)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {PRODUCTION_TYPE_LABELS[record.production_type]} •{" "}
                      {record.quantity.toLocaleString()} {formatUnit(record.unit)}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`uppercase tracking-wider ${statusClasses[record.status] ?? DEFAULT_STATUS_CLASS}`}
                >
                  {record.status}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <ProductionRecordDialog
        record={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onEdit={onEdit}
      />
    </Card>
  );
}
