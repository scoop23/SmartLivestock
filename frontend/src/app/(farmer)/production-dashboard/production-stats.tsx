"use client";

import {
  ClipboardList,
  Egg,
  Milk,
  Package,
  PhilippinePeso,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatPeso,
  formatQty,
  PRODUCTION_TYPE_UNITS,
  type ProductionAnalyticsSummary,
  type ProductionType,
} from "./production-analytics";

const TYPE_META: Record<
  ProductionType,
  { icon: typeof Milk; iconBg: string; iconClass: string; accent: string; accentBar: string; sub: string }
> = {
  milk: {
    icon: Milk,
    iconBg: "bg-sky-100/80",
    iconClass: "text-sky-700",
    accent: "border-l-sky-500",
    accentBar: "bg-sky-500",
    sub: "Milk output",
  },
  eggs: {
    icon: Egg,
    iconBg: "bg-amber-100/80",
    iconClass: "text-amber-800",
    accent: "border-l-amber-500",
    accentBar: "bg-amber-500",
    sub: "Egg output",
  },
  wool: {
    icon: Package,
    iconBg: "bg-stone-200/80",
    iconClass: "text-stone-700",
    accent: "border-l-stone-500",
    accentBar: "bg-stone-500",
    sub: "Wool output",
  },
};

interface CardConfig {
  label: string;
  icon: typeof Milk;
  iconBg: string;
  iconClass: string;
  value: string;
  sub: string;
  accentBar: string;
}

export default function ProductionStats({
  type,
  summary,
}: {
  type: ProductionType;
  summary?: ProductionAnalyticsSummary;
}) {
  const hasRecords = summary?.has_records ?? false;
  const growthPct = summary?.growth_pct ?? 0;
  const unit = PRODUCTION_TYPE_UNITS[type];
  const meta = TYPE_META[type];

  const allCards: CardConfig[] = [
    {
      label: `Total ${meta.sub.split(" ")[0]} Produced`,
      icon: meta.icon,
      iconBg: meta.iconBg,
      iconClass: meta.iconClass,
      value: hasRecords ? `${formatQty(summary!.total)} ${unit}` : "—",
      sub: meta.sub,
      accentBar: meta.accentBar,
    },
    {
      label: "Production Growth",
      icon: growthPct >= 0 ? TrendingUp : TrendingDown,
      iconBg: growthPct >= 0 ? "bg-emerald-100/80" : "bg-rose-100/80",
      iconClass: growthPct >= 0 ? "text-emerald-800" : "text-rose-800",
      value: hasRecords
        ? `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`
        : "—",
      sub: "Compared with last month",
      accentBar:
        growthPct > 0
          ? "bg-emerald-600"
          : growthPct < 0
            ? "bg-rose-500"
            : "bg-slate-400",
    },
    {
      label: "Production Records",
      icon: ClipboardList,
      iconBg: "bg-orange-100/80",
      iconClass: "text-orange-800",
      value: hasRecords ? (summary!.record_count ?? 0).toLocaleString() : "—",
      sub: "Submitted entries",
      accentBar: "bg-orange-500",
    },
    {
      label: "Estimated Value",
      icon: PhilippinePeso,
      iconBg: "bg-emerald-100/80",
      iconClass: "text-emerald-800",
      value: hasRecords ? formatPeso(summary!.estimated_value) : "—",
      sub: "At market prices",
      accentBar: "bg-emerald-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {allCards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="relative overflow-hidden border-2 border-amber-900/10 bg-amber-50/30 hover:bg-amber-50/60 shadow-sm hover:shadow rounded-2xl transition-all duration-200"
          >
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${card.iconBg} shrink-0`}>
                    <Icon className={`w-4 h-4 ${card.iconClass}`} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/60 bg-amber-900/5 px-2.5 py-1 rounded-full">
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
        );
      })}
    </div>
  );
}
