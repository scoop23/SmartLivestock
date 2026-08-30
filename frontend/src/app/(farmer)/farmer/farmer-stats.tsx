"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Milk, Weight } from "lucide-react";
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
  const avgCarcassKg = data?.avg_carcass_weight_kg ?? null;
  const activeAlerts = data?.active_health_alerts ?? 0;
  const milkLiters = data?.milk_production_liters ?? null;
  const milkGrowth = data?.milk_growth_pct ?? null;

  const milkSub =
    milkLiters === null
      ? "No production data"
      : milkGrowth === null
        ? "This month"
        : milkGrowth >= 0
          ? `↑ ${milkGrowth.toFixed(1)}% vs last month`
          : `↓ ${Math.abs(milkGrowth).toFixed(1)}% vs last month`;

  const allCards: CardConfig[] = [
    {
      label: "My Livestock",
      icon: <Icon iconNode={cowHead} className="size-4.5" />,
      variant: "emerald",
      value: cattleCount.toLocaleString(),
      sub: "Heads in your farm",
    },
    {
      label: "Avg. Carcass Weight",
      icon: <Weight className="size-4.5" />,
      variant: "sky",
      value: avgCarcassKg !== null ? `${formatQty(avgCarcassKg)} kg` : "—",
      sub: avgCarcassKg !== null ? "Avg. per slaughter" : "No slaughter data",
    },
    {
      label: "Active Health Alerts",
      icon: <AlertTriangle className="size-4.5" />,
      variant: activeAlerts > 0 ? "rose" : "stone",
      value: activeAlerts.toLocaleString(),
      sub: activeAlerts > 0 ? "Needs attention" : "No active alerts",
      subClass: activeAlerts > 0 ? "text-rose-700 bg-rose-100 border-rose-200" : undefined,
    },
    {
      label: "Milk Production This Month",
      icon: <Milk className="size-4.5" />,
      variant: "amber",
      value: milkLiters !== null ? `${formatQty(milkLiters)} L` : "—",
      sub: milkSub,
      subClass:
        milkLiters !== null && milkGrowth !== null
          ? milkGrowth >= 0
            ? "text-emerald-700 bg-emerald-100 border-emerald-200"
            : "text-rose-700 bg-rose-100 border-rose-200"
          : undefined,
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
        />
      ))}
    </div>
  );
}
