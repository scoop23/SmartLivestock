"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Egg,
  Filter,
  Milk,
  Package,
  PhilippinePeso,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import api from "@/lib/axios";
import type { ProductionRecord } from "./production-history";
import type { UnitType } from "./production-history";

import type { ProductionType } from "./production-form-fields";
type FilterType = "all" | ProductionType;
type ProductionStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

type ProductionStatsRecord = Pick<
  ProductionRecord,
  | "id"
  | "livestockId"
  | "productionType"
  | "quantity"
  | "unit"
  | "recordDate"
  | "status"
  | "createdAt"
> & {
  livestockTypeName?: string;
};

interface ProductionRecordResponse {
  id: number;
  livestock: number;
  livestock_type_name?: string | null;
  production_type: string;
  quantity: string | number;
  unit: string;
  record_date: string;
  status: ProductionStatus;
  created_at: string;
}

const MARKET_PRICES: Record<ProductionType, number> = {
  milk: 65,
  eggs: 9,
  wool: 150,
};

const parseDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Number(y), (Number(m) || 1) - 1, Number(d) || 1);
};

const formatQty = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 1 });

const formatPeso = (n: number) =>
  `₱${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

interface CardConfig {
  label: string;
  icon: typeof Milk;
  iconBg: string;
  iconClass: string;
  value: string;
  sub: string;
  accentBorder: string;
}

export default function ProductionStats() {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");

  const { data: productions = [], isLoading } = useQuery<
    ProductionStatsRecord[]
  >({
    queryKey: ["production_stats"],
    queryFn: async () => {
      const response = await api.get("production/view_records/");
      return (response.data as ProductionRecordResponse[]).map((item) => ({
        id: item.id,
        livestockId: item.livestock,
        livestockTypeName: item.livestock_type_name ?? undefined,
        productionType: item.production_type.toLowerCase() as ProductionType,
        quantity: Number(item.quantity),
        unit: item.unit as UnitType,
        recordDate: item.record_date,
        status: item.status,
        createdAt: item.created_at,
      }));
    },
  });

  // Filter production records according to the selected tab
  const filteredProductions = useMemo(() => {
    if (selectedFilter === "all") return productions;
    return productions.filter((r) => r.productionType === selectedFilter);
  }, [productions, selectedFilter]);

  // TODO: compute this in the backend.
  const stats = useMemo(() => {
    const byType = (type: ProductionType) =>
      filteredProductions
        .filter((r) => r.productionType === type)
        .reduce((sum, r) => sum + r.quantity, 0);

    const recordValue = (r: ProductionStatsRecord) =>
      r.quantity * (MARKET_PRICES[r.productionType] ?? 0);

    const totalMilk = byType("milk");
    const totalEggs = byType("eggs");
    const totalWool = byType("wool");
    const recordCount = filteredProductions.length;
    const estimatedValue = filteredProductions.reduce(
      (sum, r) => sum + recordValue(r),
      0,
    );

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const monthValue = (from: Date, to?: Date) =>
      filteredProductions
        .filter((r) => {
          const d = parseDate(r.recordDate);
          return d >= from && (!to || d < to);
        })
        .reduce((sum, r) => sum + recordValue(r), 0);

    const thisMonthValue = monthValue(thisMonthStart);
    const lastMonthValue = monthValue(lastMonthStart, thisMonthStart);

    const growthPct =
      lastMonthValue === 0
        ? thisMonthValue > 0
          ? 100
          : 0
        : ((thisMonthValue - lastMonthValue) / lastMonthValue) * 100;

    const byLivestockType: Record<string, number> = {};
    for (const r of filteredProductions) {
      const name = r.livestockTypeName || "Unspecified";
      byLivestockType[name] = (byLivestockType[name] ?? 0) + recordValue(r);
    }
    const topType =
      Object.entries(byLivestockType).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    return {
      totalMilk,
      totalEggs,
      totalWool,
      recordCount,
      estimatedValue,
      growthPct,
      hasRecords: recordCount > 0,
      topType,
    };
  }, [filteredProductions]);

  // Build card set dynamically depending on filter
  const allCards: CardConfig[] = [
    ...(selectedFilter === "all" || selectedFilter === "milk"
      ? [
        {
          label: "Total Milk Produced",
          icon: Milk,
          iconBg: "bg-sky-100/80",
          iconClass: "text-sky-700",
          value: stats.hasRecords ? `${formatQty(stats.totalMilk)} L` : "—",
          sub: "Milk output",
          accentBorder: "border-l-sky-500",
        },
      ]
      : []),
    ...(selectedFilter === "all" || selectedFilter === "eggs"
      ? [
        {
          label: "Total Eggs Produced",
          icon: Egg,
          iconBg: "bg-amber-100/80",
          iconClass: "text-amber-800",
          value: stats.hasRecords ? `${formatQty(stats.totalEggs)} pc` : "—",
          sub: "Egg output",
          accentBorder: "border-l-amber-500",
        },
      ]
      : []),
    ...(selectedFilter === "all" || selectedFilter === "wool"
      ? [
        {
          label: "Total Wool Produced",
          icon: Package,
          iconBg: "bg-stone-200/80",
          iconClass: "text-stone-700",
          value: stats.hasRecords ? `${formatQty(stats.totalWool)} kg` : "—",
          sub: "Wool output",
          accentBorder: "border-l-stone-500",
        },
      ]
      : []),
    {
      label: "Production Growth (MoM)",
      icon: stats.growthPct >= 0 ? TrendingUp : TrendingDown,
      iconBg: stats.growthPct >= 0 ? "bg-emerald-100/80" : "bg-rose-100/80",
      iconClass: stats.growthPct >= 0 ? "text-emerald-800" : "text-rose-800",
      value: stats.hasRecords
        ? `${stats.growthPct >= 0 ? "+" : ""}${stats.growthPct.toFixed(1)}%`
        : "—",
      sub: "Value vs last month",
      accentBorder:
        stats.growthPct >= 0 ? "border-l-emerald-600" : "border-l-rose-500",
    },
    {
      label: "Production Records",
      icon: ClipboardList,
      iconBg: "bg-orange-100/80",
      iconClass: "text-orange-800",
      value: stats.hasRecords ? stats.recordCount.toLocaleString() : "0",
      sub: "Submitted entries",
      accentBorder: "border-l-orange-500",
    },
    {
      label: "Estimated Value",
      icon: PhilippinePeso,
      iconBg: "bg-emerald-100/80",
      iconClass: "text-emerald-800",
      value: stats.hasRecords ? formatPeso(stats.estimatedValue) : "—",
      sub: "At market prices",
      accentBorder: "border-l-emerald-600",
    },
    {
      label: "Top Livestock Type",
      icon: Trophy,
      iconBg: "bg-yellow-100/80",
      iconClass: "text-yellow-800",
      value: stats.topType ?? "—",
      sub: "By production value",
      accentBorder: "border-l-yellow-500",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-emerald-800">
        <Spinner className="size-10 text-emerald-700" />
        <span className="text-sm font-medium text-emerald-800/80">
          Gathering farm statistics...
        </span>
      </div>
    );
  }

  const filters: { id: FilterType; label: string; icon?: typeof Milk }[] = [
    { id: "all", label: "All Production" },
    { id: "milk", label: "Milk", icon: Milk },
    { id: "eggs", label: "Eggs", icon: Egg },
    { id: "wool", label: "Wool", icon: Package },
  ];

  return (
    <div className="space-y-4">
      {/* Header and Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-900/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-700" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-amber-950/80">
            Farm Production Overview
          </h2>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-amber-900/5 p-1 rounded-xl border border-amber-900/10">
          <span className="text-amber-900/50 pl-2 pr-1 flex items-center">
            <Filter className="w-3.5 h-3.5" />
          </span>
          {filters.map((f) => {
            const Icon = f.icon;
            const isActive = selectedFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap ${isActive
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-stone-600 hover:text-amber-950 hover:bg-amber-900/10"
                  }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
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
                <div className={`h-1 w-12 rounded-full mt-3 ${card.accentBorder.replace('border-l-', 'bg-')}`} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
