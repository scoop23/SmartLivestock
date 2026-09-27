"use client";

import React, { useState } from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import {
  Milk,
  TrendingUp,
  AlertTriangle,
  Users,
  Boxes,
  Minimize2,
  Maximize2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DataOverviewKpisProps {
  totalLivestock: number;
  totalBatches?: number;
  totalMilkVolume: number;
  totalAuctionValue: number;
  activeIncidents: number;
  totalFarmers: number;
  totalSlaughterKg?: number;
  isLoading?: boolean;
}

export function DataOverviewKpis({
  totalLivestock,
  totalBatches = 0,
  totalMilkVolume,
  totalAuctionValue,
  activeIncidents,
  totalFarmers,
  totalSlaughterKg = 34500,
  isLoading = false,
}: DataOverviewKpisProps) {
  const [isCompact, setIsCompact] = useState(false);

  if (isCompact) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl px-3.5 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3 transition-all animate-in fade-in-50 duration-200">
        {/* Compact Horizontal Executive Ticker */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 md:gap-6 text-xs divide-x divide-slate-100">
          {/* 1. Livestock */}
          <div className="flex items-center gap-1.5 pl-1 first:pl-0">
            <div className="p-1 rounded-md bg-emerald-100 text-emerald-800">
              <Icon iconNode={cowHead} className="size-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                Livestock
              </span>
              <span className="font-black text-slate-900 leading-none">
                {totalLivestock.toLocaleString()}
              </span>
            </div>
          </div>

          {/* 2. Batches */}
          <div className="flex items-center gap-1.5 pl-3 sm:pl-4">
            <div className="p-1 rounded-md bg-purple-100 text-purple-800">
              <Boxes className="size-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                Batches
              </span>
              <span className="font-black text-purple-700 leading-none">
                {totalBatches} Cohorts
              </span>
            </div>
          </div>

          {/* 3. Dairy */}
          <div className="flex items-center gap-1.5 pl-3 sm:pl-4">
            <div className="p-1 rounded-md bg-sky-100 text-sky-800">
              <Milk className="size-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                Dairy
              </span>
              <span className="font-black text-sky-700 leading-none">
                {totalMilkVolume.toLocaleString()} L
              </span>
            </div>
          </div>

          {/* 4. Trade */}
          <div className="flex items-center gap-1.5 pl-3 sm:pl-4">
            <div className="p-1 rounded-md bg-amber-100 text-amber-800">
              <TrendingUp className="size-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                Auction
              </span>
              <span className="font-black text-amber-700 leading-none">
                ₱{(totalAuctionValue / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* 5. Biosecurity */}
          <div className="flex items-center gap-1.5 pl-3 sm:pl-4">
            <div
              className={`p-1 rounded-md ${
                activeIncidents > 0
                  ? "bg-rose-100 text-rose-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              <AlertTriangle className="size-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                Biosecurity
              </span>
              <span
                className={`font-black leading-none ${
                  activeIncidents > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                {activeIncidents > 0
                  ? `${activeIncidents} Active Alerts`
                  : "All Clear"}
              </span>
            </div>
          </div>

          {/* 6. Raisers */}
          <div className="flex items-center gap-1.5 pl-3 sm:pl-4">
            <div className="p-1 rounded-md bg-slate-100 text-slate-700">
              <Users className="size-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                Raisers
              </span>
              <span className="font-black text-slate-900 leading-none">
                {totalFarmers.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Expand Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCompact(false)}
          className="h-7 px-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg gap-1.5 ml-auto"
          title="Expand KPI Cards"
        >
          <Maximize2 className="size-3 text-slate-500" />
          <span className="hidden sm:inline">Expand KPIs</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <span>Municipal Operational Metrics</span>
          <Badge
            variant="outline"
            className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border-emerald-200 py-0"
          >
            Live Sync
          </Badge>
        </span>

        {/* Compact Toggle Button */}
        <button
          type="button"
          onClick={() => setIsCompact(true)}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          title="Switch to compact metric ticker"
        >
          <Minimize2 className="size-3 text-slate-600" />
          <span>Compact View</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {/* 1. Total Registered Livestock */}
        <KpiCard
          title="Total Livestock Heads"
          value={totalLivestock.toLocaleString()}
          icon={<Icon iconNode={cowHead} className="size-5" />}
          description="Across 17 Barangays"
          badge="Live Count"
          variant="emerald"
          isLoading={isLoading}
        />

        {/* 2. Active Cohorts & Batches */}
        <KpiCard
          title="Cohorts & Batches"
          value={totalBatches.toLocaleString()}
          icon={<Boxes className="size-5" />}
          description="Housing pens & lots"
          badge="Cohort Master"
          variant="default"
          isLoading={isLoading}
        />

        {/* 3. Monthly Milk Yield */}
        <KpiCard
          title="Monthly Dairy Yield"
          value={`${totalMilkVolume.toLocaleString()} L`}
          icon={<Milk className="size-5" />}
          description="Average 18.5 L/day"
          badge="+4.2% MoM"
          variant="sky"
          isLoading={isLoading}
        />

        {/* 4. Auction & Market Value */}
        <KpiCard
          title="Auction & Sales Value"
          value={`₱${(totalAuctionValue / 1000).toFixed(1)}k`}
          icon={<TrendingUp className="size-5" />}
          description="Trading Center volume"
          badge="Active Market"
          variant="amber"
          isLoading={isLoading}
        />

        {/* 5. Active Biosecurity Alerts */}
        <KpiCard
          title="Biosecurity Alerts"
          value={activeIncidents}
          icon={<AlertTriangle className="size-5" />}
          description={
            activeIncidents > 0
              ? `${activeIncidents} under quarantine`
              : "No active outbreaks"
          }
          badge={activeIncidents > 0 ? "Needs Monitoring" : "All Clear"}
          variant={activeIncidents > 0 ? "rose" : "emerald"}
          isLoading={isLoading}
        />

        {/* 6. Registered Raisers */}
        <KpiCard
          title="Registered Raisers"
          value={totalFarmers.toLocaleString()}
          icon={<Users className="size-5" />}
          description="Verified MAO farmers"
          badge="Padre Garcia"
          variant="default"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
