"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Milk, Weight } from "lucide-react";
import { Icon } from "lucide-react";
import { cowHead } from "@lucide/lab";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatQty,
  type FarmerDashboardAnalytics,
} from "./farmer-analytics";

interface CardConfig {
  label: string;
  icon: ReactNode;
  iconBg: string;
  iconClass: string;
  value: string;
  sub: string;
  subClass?: string;
  accentBar: string;
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
          <Card
            key={i}
            className="border-2 border-amber-900/10 bg-amber-50/30 shadow-sm rounded-2xl"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="size-9 rounded-xl" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
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
      icon: <Icon iconNode={cowHead} className="w-4 h-4" />,
      iconBg: "bg-emerald-100/80",
      iconClass: "text-emerald-800",
      value: cattleCount.toLocaleString(),
      sub: "Heads in your farm",
      accentBar: "bg-emerald-600",
    },
    {
      label: "Avg. Carcass Weight",
      icon: <Weight className="w-4 h-4" />,
      iconBg: "bg-sky-100/80",
      iconClass: "text-sky-700",
      value: avgCarcassKg !== null ? `${formatQty(avgCarcassKg)} kg` : "—",
      sub: avgCarcassKg !== null ? "Avg. per slaughter" : "No slaughter data",
      accentBar: "bg-sky-500",
    },
    {
      label: "Active Health Alerts",
      icon: <AlertTriangle className="w-4 h-4" />,
      iconBg: "bg-rose-100/80",
      iconClass: "text-rose-800",
      value: activeAlerts.toLocaleString(),
      sub: activeAlerts > 0 ? "Needs attention" : "No active alerts",
      accentBar: "bg-rose-500",
    },
    {
      label: "Milk Production This Month",
      icon: <Milk className="w-4 h-4" />,
      iconBg: "bg-amber-100/80",
      iconClass: "text-amber-800",
      value: milkLiters !== null ? `${formatQty(milkLiters)} L` : "—",
      sub: milkSub,
      subClass:
        milkLiters !== null && milkGrowth !== null
          ? milkGrowth >= 0
            ? "text-emerald-700 bg-emerald-100/70"
            : "text-rose-700 bg-rose-100/70"
          : undefined,
      accentBar: "bg-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {allCards.map((card) => (
        <Card
          key={card.label}
          className="relative overflow-hidden border-2 border-amber-900/10 bg-amber-50/30 hover:bg-amber-50/60 shadow-sm hover:shadow rounded-2xl transition-all duration-200"
        >
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div>
              {/* Header Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl ${card.iconBg} shrink-0`}>
                  <span className={`block ${card.iconClass}`}>{card.icon}</span>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap ${
                    card.subClass ?? "text-amber-900/60 bg-amber-900/5"
                  }`}
                >
                  {card.sub}
                </span>
              </div>

              {/* Main Stat */}
              <p className="text-[11px] font-semibold text-stone-600 truncate">
                {card.label}
              </p>
              <p className="text-2xl font-black text-amber-950 tracking-tight mt-0.5 truncate">
                {card.value}
              </p>
            </div>

            {/* Decorative bottom bar */}
            <div className={`h-1 w-12 rounded-full mt-3 ${card.accentBar}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
