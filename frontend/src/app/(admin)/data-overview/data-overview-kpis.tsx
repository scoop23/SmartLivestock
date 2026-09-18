"use client";

import React from "react";
import { KpiCard } from "@/components/ui/kpi-card";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import {
  Milk,
  TrendingUp,
  AlertTriangle,
  Users,
  Layers,
  Scale,
} from "lucide-react";

interface DataOverviewKpisProps {
  totalLivestock: number;
  totalMilkVolume: number;
  totalAuctionValue: number;
  activeIncidents: number;
  totalFarmers: number;
  totalSlaughterKg?: number;
  isLoading?: boolean;
}

export function DataOverviewKpis({
  totalLivestock,
  totalMilkVolume,
  totalAuctionValue,
  activeIncidents,
  totalFarmers,
  totalSlaughterKg = 34500,
  isLoading = false,
}: DataOverviewKpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
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

      {/* 2. Monthly Milk Yield */}
      <KpiCard
        title="Monthly Dairy Yield"
        value={`${totalMilkVolume.toLocaleString()} L`}
        icon={<Milk className="size-5" />}
        description="Average 18.5 L/day"
        badge="+4.2% MoM"
        variant="sky"
        isLoading={isLoading}
      />

      {/* 3. Auction & Market Value */}
      <KpiCard
        title="Auction & Sales Value"
        value={`₱${(totalAuctionValue / 1000).toFixed(1)}k`}
        icon={<TrendingUp className="size-5" />}
        description="Trading Center volume"
        badge="Active Market"
        variant="amber"
        isLoading={isLoading}
      />

      {/* 4. Active Biosecurity Alerts */}
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

      {/* 5. Registered Raisers */}
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
  );
}
