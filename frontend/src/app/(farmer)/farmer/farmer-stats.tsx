"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { cowHead } from "@lucide/lab";
import { AlertTriangle, Icon, Milk, ShieldCheck } from "lucide-react";
import React from "react";
import {
  formatQty,
  type FarmerDashboardAnalytics,
} from "./farmer-analytics";

export default function FarmerStats({
  data,
  isLoading = false,
}: {
  data?: FarmerDashboardAnalytics;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCard key={i} title="" value="" isLoading />
        ))}
      </div>
    );
  }

  const cattleCount = data?.cattle_count ?? 0;
  const approvedCount = data?.approved_count ?? 0;
  const verifiedCount = data?.verified_count ?? 0;
  const pendingCount = data?.pending_count ?? 0;
  const revisionCount = data?.revision_count ?? 0;
  const rejectedCount = data?.rejected_count ?? 0;
  const diseaseReportsThisMonth = data?.disease_reports_this_month ?? 0;
  const diseaseReportsAwaitingReview = data?.disease_reports_awaiting_review_this_month ?? 0;
  const milkLiters = data?.milk_production_liters ?? null;
  const milkGrowth = data?.milk_growth_pct ?? null;
  const milkRecordedLiters = data?.milk_recorded_liters ?? 0;

  const livestockBadge =
    cattleCount === 0
      ? "NO ACTIVE ANIMALS"
      : pendingCount > 0
      ? `${approvedCount} APPROVED • ${verifiedCount} VERIFIED • ${pendingCount} PENDING`
      : `${approvedCount} APPROVED • ${verifiedCount} VERIFIED`;

  const milkBadge = (milkLiters ?? 0) === 0
    ? "NO RECORDED YIELD"
    : `${formatQty(milkRecordedLiters)} RECORDED`;

  const reviewPercent = cattleCount > 0
    ? Math.round(((approvedCount + verifiedCount) / cattleCount) * 100)
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
      {/* KPI 1: Current active livestock */}
      <div data-tour="my-livestock-stat" className="h-full">
        <KpiCard
          className="h-full"
          title="Active Livestock"
          variant="emerald"
          icon={<Icon iconNode={cowHead} className="size-5" />}
          badge={livestockBadge}
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
          value={
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {cattleCount.toLocaleString()}
              </span>
              <span className="text-xs font-mono text-emerald-700 font-bold">Heads</span>
            </div>
          }
          description="Animals currently on your farm"
          wrapText
        />
      </div>

      {/* KPI 2: Production This Month */}
      <div data-tour="production-stat" className="h-full">
        <KpiCard
          className="h-full"
          title="Production This Month"
          variant="sky"
          icon={<Milk className="size-5" />}
          badge={milkBadge}
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 tracking-wider"
          value={
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {milkLiters !== null && milkLiters > 0 ? formatQty(milkLiters) : "0"}
              </span>
              <span className="font-display text-xl sm:text-2xl font-black text-sky-700 tracking-tight">
                L
              </span>
            </div>
          }
          description={
            milkGrowth !== null
              ? `${milkGrowth >= 0 ? "↑ +" : "↓ "}${Math.abs(milkGrowth).toFixed(1)}% MOM · Recorded this month`
              : "Milk yield recorded this month"
          }
          wrapText
        />
      </div>

      {/* KPI 3: Animal Health Reports */}
      <div data-tour="health-stat" className="h-full">
        <KpiCard
          className="h-full"
          title="Disease Reports This Month"
          variant={diseaseReportsAwaitingReview > 0 ? "rose" : "stone"}
          icon={<AlertTriangle className="size-5" />}
          badge={diseaseReportsAwaitingReview > 0 ? `${diseaseReportsAwaitingReview} NEED REVIEW` : "THIS MONTH"}
          badgeClassName={
            diseaseReportsAwaitingReview > 0
              ? "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 tracking-wider"
              : "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-emerald-800 border border-slate-200 tracking-wider"
          }
          value={
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {diseaseReportsThisMonth.toLocaleString()}
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  diseaseReportsAwaitingReview > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {diseaseReportsThisMonth === 1 ? "Report" : "Reports"}
              </span>
            </div>
          }
          description={
            diseaseReportsAwaitingReview > 0
              ? `${diseaseReportsAwaitingReview} awaiting SIBAT or MAO review`
              : "0 awaiting SIBAT or MAO review"
          }
          wrapText
        />
      </div>

      {/* KPI 4: Record Status */}
      <div data-tour="record-status-stat" className="h-full">
        <KpiCard
          className="h-full"
          title="Livestock Review Status"
          variant="amber"
          icon={<ShieldCheck className="size-5" />}
          badge={cattleCount === 0 ? "NO ACTIVE HEADS" : pendingCount === 0 ? "NO PENDING HEADS" : `${pendingCount} HEADS PENDING`}
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
          value={
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {reviewPercent === null ? "—" : `${reviewPercent}%`}
              </span>
            </div>
          }
          description={
            cattleCount === 0
              ? "No active livestock heads to review"
              : `${approvedCount + verifiedCount} of ${cattleCount} active heads approved or verified` +
                (revisionCount || rejectedCount
                  ? ` · ${revisionCount} need revision · ${rejectedCount} rejected`
                  : "")
          }
          wrapText
        />
      </div>
    </div>
  );
}
