"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { CheckCircle2, Clock, FileText, RotateCcw } from "lucide-react";
import React from "react";

export type TransferKpiRecord = {
  status: string;
};

export function OwnershipTransferKpis({
  records = [],
  isLoading = false,
}: {
  records: TransferKpiRecord[];
  isLoading: boolean;
}) {
  const totalCount = records.length;
  const awaitingCount = records.filter((r) => ["PENDING", "VERIFIED"].includes(r.status)).length;
  const approvedCount = records.filter((r) => r.status === "APPROVED").length;
  const revisionCount = records.filter((r) => ["SUBJECT_TO_REVISION", "REJECTED"].includes(r.status)).length;

  const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 100;

  return (
    <section aria-label="Ownership transfer summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Total Transfers */}
      <KpiCard
        title="Total Transfers"
        variant="emerald"
        icon={<FileText className="size-5" />}
        badge={totalCount > 0 ? "LIVE BACKEND" : "NO TRANSFERS"}
        badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300 tracking-wider"
        value={
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {totalCount.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-emerald-700 font-bold">Records</span>
          </div>
        }
        description="All recorded transfer certificates"
        isLoading={isLoading}
        wrapText
      />

      {/* KPI 2: Pending MAO Review */}
      <KpiCard
        title="Pending MAO Review"
        variant="amber"
        icon={<Clock className="size-5" />}
        badge={awaitingCount > 0 ? "FOR EVALUATION" : "QUEUE CLEAR"}
        badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100/90 text-amber-900 border border-amber-300 tracking-wider"
        value={
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {awaitingCount.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-amber-700 font-bold">Pending</span>
          </div>
        }
        description="Awaiting official MAO validation"
        isLoading={isLoading}
        wrapText
      />

      {/* KPI 3: Approved Transfers */}
      <KpiCard
        title="Approved Transfers"
        variant="sky"
        icon={<CheckCircle2 className="size-5" />}
        badge={totalCount > 0 ? `${approvalRate}% APPROVED` : "COMPLETED"}
        badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-100/90 text-sky-900 border border-sky-300 tracking-wider"
        value={
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {approvedCount.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-sky-700 font-bold">Completed</span>
          </div>
        }
        description="Approved certificates on official registry"
        isLoading={isLoading}
        wrapText
      />

      {/* KPI 4: Needs Revision */}
      <KpiCard
        title="Needs Revision"
        variant="rose"
        icon={<RotateCcw className="size-5" />}
        badge={revisionCount > 0 ? "ACTION NEEDED" : "NO CORRECTIONS"}
        badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100/90 text-rose-900 border border-rose-300 tracking-wider"
        value={
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {revisionCount.toLocaleString()}
            </span>
            <span className="text-xs font-mono text-rose-700 font-bold">Corrections</span>
          </div>
        }
        description="Returned transfers requiring correction"
        isLoading={isLoading}
        wrapText
      />
    </section>
  );
}
