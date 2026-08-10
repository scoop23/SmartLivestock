"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Droplets } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatRecordDate,
  type ProductionStatus,
  type RecentProductionRecord,
} from "./production-analytics";

const statusClasses: Record<ProductionStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  VERIFIED: "bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200",
  PENDING: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  REJECTED: "bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200",
};

const formatUnit = (unit: string) =>
  unit === "LITERS" ? "L" : unit === "KILOGRAMS" ? "kg" : unit === "PIECES" ? "pc" : unit;

export default function ProductionRecent({
  records,
  showViewMore = false,
}: {
  records: RecentProductionRecord[];
  showViewMore?: boolean;
}) {
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

        {records.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No production records yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {records.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
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
                      {record.quantity.toLocaleString()} {formatUnit(record.unit)}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`uppercase tracking-wider ${statusClasses[record.status]}`}
                >
                  {record.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
