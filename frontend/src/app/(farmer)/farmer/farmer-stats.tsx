"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Milk, ShieldCheck, Activity } from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import {
  formatQty,
  type FarmerDashboardAnalytics,
} from "./farmer-analytics";

interface CardConfig {
  label: string;
  icon: ReactNode;
  variant: KpiVariant;
  value: string;
  sub: string;
  subClass?: string;
  description?: string;
}

export default function FarmerStats({
  data,
  isLoading = false,
}: {
  data?: FarmerDashboardAnalytics;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
  console.log(milkGrowth);

  const livestockSub =
    cattleCount === 0
      ? "No animals registered"
      : pendingCount > 0
        ? `${approvedCount} verified • ${pendingCount} pending`
        : `${approvedCount} verified heads`;

  const milkSub =
    milkLiters === null || milkLiters === 0
      ? "0 L this month"
      : milkGrowth === null
        ? "This month"
        : milkGrowth >= 0
          ? `↑ ${milkGrowth.toFixed(1)}% MoM`
          : `↓ ${Math.abs(milkGrowth).toFixed(1)}% MoM`;

  const allCards: CardConfig[] = [
    {
      label: "My Livestock Herd",
      icon: <Icon iconNode={cowHead} className="size-4.5" />,
      variant: "emerald",
      value: cattleCount.toLocaleString(),
      sub: livestockSub,
      description: "Padre Garcia registry",
    },
    {
      label: "Monthly Dairy Yield",
      icon: <Milk className="size-4.5" />,
      variant: "sky",
      value: milkLiters !== null && milkLiters > 0 ? `${formatQty(milkLiters)} L` : "0 L",
      sub: milkSub,
      subClass:
        milkLiters !== null && milkGrowth !== null
          ? milkGrowth >= 0
            ? "text-emerald-700 bg-emerald-100 border-emerald-200"
            : "text-rose-700 bg-rose-100 border-rose-200"
          : undefined,
      description: "Approved milk output",
    },
    {
      label: "Health & Symptom Alerts",
      icon: <AlertTriangle className="size-4.5" />,
      variant: activeAlerts > 0 ? "rose" : "stone",
      value: activeAlerts.toLocaleString(),
      sub: activeAlerts > 0 ? "Needs inspection" : "All healthy",
      subClass: activeAlerts > 0 ? "text-rose-700 bg-rose-100 border-rose-200" : "text-emerald-700 bg-emerald-50 border-emerald-200",
      description: "Surveillance cases",
    },
    {
      label: "Inspection Compliance",
      icon: <ShieldCheck className="size-4.5" />,
      variant: "amber",
      value: cattleCount > 0 ? `${Math.round((approvedCount / cattleCount) * 100)}%` : "100%",
      sub: pendingCount === 0 ? "Fully certified" : `${pendingCount} awaiting SIBAT`,
      description: "Cooperative verification",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {allCards.map((card) => (
        <KpiCard
          key={card.label}
          title={card.label}
          value={card.value}
          icon={card.icon}
          badge={card.sub}
          badgeClassName={card.subClass}
          variant={card.variant}
          description={card.description}
        />
      ))}
    </div>
  );
}
