"use client";

import {
  ClipboardList,
  Egg,
  Milk,
  Package,
  PhilippinePeso,
  TrendingDown,
  TrendingUp,
  Beef,
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
  meat: {
    icon: Beef,
    variant: "rose",
    sub: "Meat output",
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
  const growthPct = summary?.growth_pct ?? null;
  const unit = PRODUCTION_TYPE_UNITS[type];
  const meta = TYPE_META[type];
  const MainIcon = meta.icon;

  const hasValuation =
    summary?.estimated_value != null && (summary?.valued_record_count ?? 0) > 0;

  const allCards: CardConfig[] = [
    {
      label: `Recorded ${meta.sub.split(" ")[0]} Output`,
      icon: <MainIcon className="size-4.5" />,
      variant: meta.variant,
      value: hasRecords ? `${formatQty(summary!.total)} ${unit}` : "—",
      sub: (summary?.pending_total ?? 0) > 0
        ? `${formatQty(summary!.verified_total ?? 0)} ${unit} verified · ${formatQty(summary!.pending_total ?? 0)} ${unit} awaiting`
        : meta.sub,
    },
    {
      label: "Recorded Output Change",
      icon: (growthPct ?? 0) >= 0 ? <TrendingUp className="size-4.5" /> : <TrendingDown className="size-4.5" />,
      variant: (growthPct ?? 0) >= 0 ? "emerald" : "rose",
      value: hasRecords && growthPct !== null
        ? `${(growthPct ?? 0) >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`
        : "—",
      sub: "Current partial month vs. last month",
      subClass:
        (growthPct ?? 0) >= 0
          ? "text-emerald-700 bg-emerald-100 border-emerald-200"
          : "text-rose-700 bg-rose-100 border-rose-200",
    },
    {
      label: "Production Records",
      icon: <ClipboardList className="size-4.5" />,
      variant: "orange",
      value: hasRecords ? (summary!.record_count ?? 0).toLocaleString() : "—",
      sub: (summary?.pending_record_count ?? 0) > 0
        ? `${summary!.verified_record_count ?? 0} verified · ${summary!.pending_record_count ?? 0} awaiting`
        : "Submitted entries",
    },
  ];

  if (hasValuation) {
    allCards.push({
      label: "Estimated Reference Value",
      icon: <PhilippinePeso className="size-4.5" />,
      variant: "emerald",
      value: formatPeso(summary!.estimated_value!),
      sub: (summary?.pending_estimated_value ?? 0) > 0
        ? `${formatPeso(summary!.verified_estimated_value ?? 0)} verified · ${formatPeso(summary!.pending_estimated_value ?? 0)} indicative`
        : "Official PSA benchmark; not cash sales",
    });
  }

  return (
    <div
      className={`grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 ${
        hasValuation ? "lg:grid-cols-4" : ""
      }`}
    >
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
