"use client";

import { CheckCircle2, Clock, Layers, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LivestockInventoryItem } from "./page";

interface CardConfig {
  label: string;
  icon: typeof Layers;
  iconBg: string;
  iconClass: string;
  value: string;
  sub: string;
  accentBar: string;
}

export default function InventoryStats({
  inventories,
  isLoading = false,
}: {
  inventories: LivestockInventoryItem[];
  isLoading?: boolean;
}) {
  const hasRecords = inventories.length > 0;
  const totalHeads = inventories.reduce((acc, curr) => acc + curr.quantity, 0);
  const approvedHeads = inventories
    .filter((i) => i.status === "APPROVED")
    .reduce((acc, curr) => acc + curr.quantity, 0);
  const pendingRecords = inventories.filter((i) => i.status === "PENDING").length;
  const individualTags = inventories.filter((i) => i.entryType === "INDIVIDUAL").length;

  const allCards: CardConfig[] = [
    {
      label: "Total Head Count",
      icon: Layers,
      iconBg: "bg-emerald-100/80",
      iconClass: "text-emerald-800",
      value: hasRecords ? totalHeads.toLocaleString() : "—",
      sub: "All livestock entries",
      accentBar: "bg-emerald-600",
    },
    {
      label: "Approved",
      icon: CheckCircle2,
      iconBg: "bg-sky-100/80",
      iconClass: "text-sky-700",
      value: hasRecords ? approvedHeads.toLocaleString() : "—",
      sub: "Approved heads",
      accentBar: "bg-sky-500",
    },
    {
      label: "Pending Review",
      icon: Clock,
      iconBg: "bg-amber-100/80",
      iconClass: "text-amber-800",
      value: hasRecords ? `${pendingRecords.toLocaleString()} Records` : "—",
      sub: "Awaiting review",
      accentBar: "bg-amber-500",
    },
    {
      label: "Individual Tags",
      icon: Tag,
      iconBg: "bg-orange-100/80",
      iconClass: "text-orange-800",
      value: hasRecords ? individualTags.toLocaleString() : "—",
      sub: "Tagged entries",
      accentBar: "bg-orange-500",
    },
  ];

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
