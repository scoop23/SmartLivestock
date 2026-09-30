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
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2.5 transition-all animate-in fade-in-50 duration-200">
        {/* Header row: Status Title & Expand Button */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2D5A27]"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
              Municipal Data Ledger
            </span>
            <Badge
              variant="outline"
              className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 border-emerald-200 py-0 px-1.5 hidden xs:inline-flex"
            >
              Live Pulse
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCompact(false)}
            className="h-7 px-2.5 text-xs font-bold text-[#2D5A27] hover:text-[#1E3D1A] hover:bg-emerald-50 rounded-lg gap-1.5 cursor-pointer border border-emerald-200/80 shadow-2xs"
            title="Expand to Full KPI Cards"
          >
            <Maximize2 className="size-3 text-[#2D5A27]" />
            <span>Expand Cards</span>
          </Button>
        </div>

        {/* Responsive Grid of Mobile-Friendly Stat Capsules */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* 1. Livestock */}
          <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/70 hover:bg-emerald-50 transition-colors shadow-2xs">
            <div className="p-1.5 rounded-lg bg-emerald-700 text-white shrink-0 shadow-2xs">
              <Icon iconNode={cowHead} className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-emerald-800/80 block leading-tight truncate">
                Livestock
              </span>
              <p className="text-xs sm:text-sm font-black text-emerald-950 leading-tight tabular-nums truncate">
                {totalLivestock.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 2. Batches */}
          <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/70 hover:bg-emerald-50 transition-colors shadow-2xs">
            <div className="p-1.5 rounded-lg bg-[#2D5A27] text-white shrink-0 shadow-2xs">
              <Boxes className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-emerald-800/80 block leading-tight truncate">
                Batches
              </span>
              <p className="text-xs sm:text-sm font-black text-emerald-950 leading-tight tabular-nums truncate">
                {totalBatches}{" "}
                <span className="text-[10px] font-bold text-[#2D5A27] hidden sm:inline">
                  Herds
                </span>
              </p>
            </div>
          </div>

          {/* 3. Dairy */}
          <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-sky-50/80 border border-sky-200/70 hover:bg-sky-50 transition-colors shadow-2xs">
            <div className="p-1.5 rounded-lg bg-sky-700 text-white shrink-0 shadow-2xs">
              <Milk className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-sky-800/80 block leading-tight truncate">
                Dairy
              </span>
              <p className="text-xs sm:text-sm font-black text-sky-950 leading-tight tabular-nums truncate">
                {totalMilkVolume.toLocaleString()}{" "}
                <span className="text-[10px] font-bold text-sky-700">L</span>
              </p>
            </div>
          </div>

          {/* 4. Trade */}
          <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 hover:bg-amber-50 transition-colors shadow-2xs">
            <div className="p-1.5 rounded-lg bg-amber-700 text-white shrink-0 shadow-2xs">
              <TrendingUp className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-amber-800/80 block leading-tight truncate">
                Auction
              </span>
              <p className="text-xs sm:text-sm font-black text-amber-950 leading-tight tabular-nums truncate">
                ₱{(totalAuctionValue / 1000).toFixed(1)}k
              </p>
            </div>
          </div>

          {/* 5. Biosecurity */}
          <div
            className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border transition-colors shadow-2xs ${
              activeIncidents > 0
                ? "bg-rose-50/80 border-rose-300 text-rose-900"
                : "bg-emerald-50/80 border-emerald-200/70 text-emerald-950"
            }`}
          >
            <div
              className={`p-1.5 rounded-lg text-white shrink-0 shadow-2xs ${
                activeIncidents > 0 ? "bg-rose-600" : "bg-[#2D5A27]"
              }`}
            >
              <AlertTriangle className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span
                className={`text-[9px] uppercase font-extrabold block leading-tight truncate ${
                  activeIncidents > 0 ? "text-rose-700" : "text-emerald-800/80"
                }`}
              >
                Health
              </span>
              <p
                className={`text-xs sm:text-sm font-black leading-tight truncate ${
                  activeIncidents > 0 ? "text-rose-900" : "text-emerald-950"
                }`}
              >
                {activeIncidents > 0 ? `${activeIncidents} Alerts` : "All Clear"}
              </p>
            </div>
          </div>

          {/* 6. Raisers */}
          <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/90 hover:bg-slate-100/70 transition-colors shadow-2xs">
            <div className="p-1.5 rounded-lg bg-slate-700 text-white shrink-0 shadow-2xs">
              <Users className="size-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] uppercase font-extrabold text-slate-500 block leading-tight truncate">
                Raisers
              </span>
              <p className="text-xs sm:text-sm font-black text-slate-900 leading-tight tabular-nums truncate">
                {totalFarmers.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCompact(true)}
          className="h-7 px-2.5 text-xs font-bold text-[#2D5A27] hover:text-[#1E3D1A] hover:bg-emerald-50 rounded-lg gap-1.5 cursor-pointer border border-emerald-200/80 shadow-2xs"
          title="Switch to compact metric capsules"
        >
          <Minimize2 className="size-3 text-[#2D5A27]" />
          <span>Compact View</span>
        </Button>
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

        {/* 2. Active Herds */}
        <KpiCard
          title="Herds"
          value={totalBatches.toLocaleString()}
          icon={<Boxes className="size-5" />}
          description="Housing pens & lots"
          badge="Herd Master"
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
