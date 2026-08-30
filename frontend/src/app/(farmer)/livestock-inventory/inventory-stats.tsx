"use client";

import { CheckCircle2, Clock, Layers, Tag } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import type { LivestockInventoryItem } from "./page";

interface CardConfig {
  label: string;
  icon: typeof Layers;
  variant: KpiVariant;
  value: string;
  sub: string;
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
      variant: "emerald",
      value: hasRecords ? totalHeads.toLocaleString() : "—",
      sub: "All livestock entries",
    },
    {
      label: "Approved Heads",
      icon: CheckCircle2,
      variant: "sky",
      value: hasRecords ? approvedHeads.toLocaleString() : "—",
      sub: "Verified in registry",
    },
    {
      label: "Pending Review",
      icon: Clock,
      variant: pendingRecords > 0 ? "amber" : "stone",
      value: hasRecords ? `${pendingRecords.toLocaleString()} Records` : "—",
      sub: pendingRecords > 0 ? "Awaiting review" : "Up to date",
    },
    {
      label: "Individual Tags",
      icon: Tag,
      variant: "orange",
      value: hasRecords ? individualTags.toLocaleString() : "—",
      sub: "Tagged entries",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCard key={i} title="" value="" isLoading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {allCards.map((card) => {
        const Icon = card.icon;
        return (
          <KpiCard
            key={card.label}
            title={card.label}
            value={card.value}
            icon={<Icon className="size-4.5" />}
            badge={card.sub}
            variant={card.variant}
          />
        );
      })}
    </div>
  );
}
