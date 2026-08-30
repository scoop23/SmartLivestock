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
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import {
  formatPeso,
  formatQty,
  PRODUCTION_TYPE_UNITS,
  type ProductionAnalyticsSummary,
  type ProductionType,
} from "./production-analytics";

const TYPE_META: Record<
  ProductionType,
  { icon: typeof Milk; variant: KpiVariant; sub: string }
> = {
  milk: {
    icon: Milk,
    variant: "sky",
    sub: "Milk output",
  },
  eggs: {
    icon: Egg,
    variant: "amber",
    sub: "Egg output",
  },
  wool: {
    icon: Package,
    variant: "stone",
    sub: "Wool output",
  },
};

interface CardConfig {
  label: string;
  icon: React.ReactNode;
  variant: KpiVariant;
  value: string;
  sub: string;
  subClass?: string;
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
  const MainIcon = meta.icon;

  const allCards: CardConfig[] = [
    {
      label: `Total ${meta.sub.split(" ")[0]} Produced`,
      icon: <MainIcon className="size-4.5" />,
      variant: meta.variant,
      value: hasRecords ? `${formatQty(summary!.total)} ${unit}` : "—",
      sub: meta.sub,
    },
    {
      label: "Production Growth",
      icon: growthPct >= 0 ? <TrendingUp className="size-4.5" /> : <TrendingDown className="size-4.5" />,
      variant: growthPct >= 0 ? "emerald" : "rose",
      value: hasRecords
        ? `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`
        : "—",
      sub: "vs. last month",
      subClass:
        growthPct >= 0
          ? "text-emerald-700 bg-emerald-100 border-emerald-200"
          : "text-rose-700 bg-rose-100 border-rose-200",
    },
    {
      label: "Production Records",
      icon: <ClipboardList className="size-4.5" />,
      variant: "orange",
      value: hasRecords ? (summary!.record_count ?? 0).toLocaleString() : "—",
      sub: "Submitted entries",
    },
    {
      label: "Estimated Value",
      icon: <PhilippinePeso className="size-4.5" />,
      variant: "emerald",
      value: hasRecords ? formatPeso(summary!.estimated_value) : "—",
      sub: "At market prices",
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
