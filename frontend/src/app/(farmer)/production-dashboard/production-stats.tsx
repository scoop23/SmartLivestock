"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Egg,
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

type ProductionType = "milk" | "eggs" | "wool";
type ProductionStatus = "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";

// interface ProductionRecord {
//   id: number;
//   livestockId: number;
//   livestockTypeName?: string;
//   productionType: ProductionType;
//   quantity: number;
//   unit: string;
//   recordDate: string;
//   status: ProductionStatus;
//   createdAt: string;
// }

type ProductionStatsRecord = Pick<ProductionRecord,
  | "id"
  | "livestockId"
  | "productionType"
  | "quantity"
  | "unit"
  | "recordDate"
  | "status"
  | "createdAt"> & {
    livestockTypeName?: string;
  }

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
  iconClass: string;
  value: string;
  sub: string;
}

export default function ProductionStats() {
  const { data: productions = [], isLoading } = useQuery<ProductionStatsRecord[]>({
    queryKey: ["production"],
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

  const stats = useMemo(() => {
    const byType = (type: ProductionType) =>
      productions
        .filter((r) => r.productionType === type)
        .reduce((sum, r) => sum + r.quantity, 0);

    const recordValue = (r: ProductionStatsRecord) =>
      r.quantity * (MARKET_PRICES[r.productionType] ?? 0);

    const totalMilk = byType("milk");
    const totalEggs = byType("eggs");
    const totalWool = byType("wool");
    const recordCount = productions.length;
    const estimatedValue = productions.reduce(
      (sum, r) => sum + recordValue(r),
      0,
    );

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const monthValue = (from: Date, to?: Date) =>
      productions
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
    for (const r of productions) {
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
  }, [productions]);

  const cards: CardConfig[] = [
    {
      label: "Total Milk Produced",
      icon: Milk,
      iconClass: "text-blue-600",
      value: stats.hasRecords ? `${formatQty(stats.totalMilk)} L` : "—",
      sub: "All time milk output",
    },
    {
      label: "Total Eggs Produced",
      icon: Egg,
      iconClass: "text-amber-600",
      value: stats.hasRecords ? `${formatQty(stats.totalEggs)} pc` : "—",
      sub: "All time egg output",
    },
    {
      label: "Total Wool Produced",
      icon: Package,
      iconClass: "text-sky-600",
      value: stats.hasRecords ? `${formatQty(stats.totalWool)} kg` : "—",
      sub: "All time wool output",
    },
    {
      label: "Production Growth (MoM)",
      icon: stats.growthPct >= 0 ? TrendingUp : TrendingDown,
      iconClass:
        stats.growthPct >= 0 ? "text-emerald-600" : "text-rose-600",
      value: stats.hasRecords
        ? `${stats.growthPct >= 0 ? "+" : ""}${stats.growthPct.toFixed(1)}%`
        : "—",
      sub: "Value vs last month",
    },
    {
      label: "Production Records",
      icon: ClipboardList,
      iconClass: "text-indigo-600",
      value: stats.hasRecords ? stats.recordCount.toLocaleString() : "0",
      sub: "Submitted production entries",
    },
    {
      label: "Estimated Production Value",
      icon: PhilippinePeso,
      iconClass: "text-emerald-600",
      value: stats.hasRecords ? formatPeso(stats.estimatedValue) : "—",
      sub: "At current market prices",
    },
    {
      label: "Top Producing Livestock Type",
      icon: Trophy,
      iconClass: "text-yellow-500",
      value: stats.topType ?? "—",
      sub: "By production value",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-10 text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Quick Stats
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className="border-slate-200 shadow-sm min-w-0"
            >
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${card.iconClass}`} />
                  {card.label}
                </p>
                <p className="text-2xl font-black text-slate-900 mt-1 truncate">
                  {card.value}
                </p>
                <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
