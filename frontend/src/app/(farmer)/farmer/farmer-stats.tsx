"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import { cowHead } from "@lucide/lab";
import { AlertTriangle, Icon, Milk, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
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
  const pendingCount = data?.pending_count ?? 0;
  const activeAlerts = data?.active_health_alerts ?? 0;
  const milkLiters = data?.milk_production_liters ?? null;
  const milkGrowth = data?.milk_growth_pct ?? null;

  const livestockBadge =
    cattleCount === 0
      ? "NO ANIMALS"
      : pendingCount > 0
      ? `${approvedCount} VERIFIED • ${pendingCount} PENDING`
      : `${approvedCount} VERIFIED`;

  const reviewPercent = cattleCount > 0 ? Math.round((approvedCount / cattleCount) * 100) : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: My Livestock */}
      <div data-tour="my-livestock-stat">
        <KpiCard
          title="My Livestock"
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
          description="Animals on your farm"
          wrapText
        />
      </div>

      {/* KPI 2: Production This Month */}
      <div data-tour="production-stat">
        <KpiCard
          title="Production This Month"
          variant="sky"
          icon={<Milk className="size-5" />}
          badge={
            milkGrowth !== null ? (
              <span className="flex items-center gap-1">
                {milkGrowth >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {milkGrowth >= 0 ? "↑" : "↓"} {Math.abs(milkGrowth).toFixed(1)}% MOM
              </span>
            ) : (
              "THIS MONTH"
            )
          }
          badgeClassName={
            milkGrowth !== null && milkGrowth >= 0
              ? "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tracking-wider"
              : "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 tracking-wider"
          }
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
          description="Milk recorded this month"
          wrapText
        />
      </div>

      {/* KPI 3: Animal Health Reports */}
      <div data-tour="health-stat">
        <KpiCard
          title="Animal Health Reports"
          variant={activeAlerts > 0 ? "rose" : "stone"}
          icon={<AlertTriangle className="size-5" />}
          badge={activeAlerts > 0 ? `${activeAlerts} WAITING REVIEW` : "NO ACTIVE REPORTS"}
          badgeClassName={
            activeAlerts > 0
              ? "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 tracking-wider"
              : "font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-emerald-800 border border-slate-200 tracking-wider"
          }
          value={
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {activeAlerts}
              </span>
              <span
                className={`text-xs font-mono font-bold ${
                  activeAlerts > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {activeAlerts > 0 ? "Review Needed" : "Clear"}
              </span>
            </div>
          }
          description="Reports needing attention"
          wrapText
        />
      </div>

      {/* KPI 4: Record Status */}
      <div data-tour="record-status-stat">
        <KpiCard
          title="Record Status"
          variant="amber"
          icon={<ShieldCheck className="size-5" />}
          badge={pendingCount === 0 ? "ALL REVIEWED" : `${pendingCount} WAITING FOR REVIEW`}
          badgeClassName="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 tracking-wider"
          value={
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {reviewPercent}%
              </span>
            </div>
          }
          description="Your records reviewed by the livestock office"
          wrapText
        />
      </div>
    </div>
  );
}
