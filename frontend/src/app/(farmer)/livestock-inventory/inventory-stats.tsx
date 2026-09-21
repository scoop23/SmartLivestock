"use client";

import { CheckCircle2, Clock, Layers, ShieldCheck, Tag } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import type { LivestockInventoryItem } from "./page";

export interface InventoryCardConfig {
  label: string;
  icon: React.ReactNode;
  variant: KpiVariant;
  value: string;
  sub: string;
  subClass?: string;
}

export default function InventoryStats({
  inventories,
  isLoading = false,
  layout = "horizontal",
}: {
  inventories: LivestockInventoryItem[];
  isLoading?: boolean;
  layout?: "vertical" | "horizontal";
}) {
  const hasRecords = inventories.length > 0;
  const totalHeads = inventories.reduce((acc, curr) => acc + curr.quantity, 0);
  const approvedHeads = inventories
    .filter((i) => i.status === "APPROVED")
    .reduce((acc, curr) => acc + curr.quantity, 0);
  const pendingRecords = inventories.filter((i) => i.status === "PENDING").length;
  const individualTags = inventories.filter((i) => i.entryType === "INDIVIDUAL").length;
  const vaccinatedHeads = inventories
    .filter((i) => Boolean(i.lastVaccinationDate))
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const approvalRate = totalHeads > 0 ? Math.round((approvedHeads / totalHeads) * 100) : 0;
  const vaxRate = totalHeads > 0 ? Math.round((vaccinatedHeads / totalHeads) * 100) : 0;

  const allCards: InventoryCardConfig[] = [
    {
      label: "Total Head Count",
      icon: <Layers className="size-4.5" />,
      variant: "emerald",
      value: hasRecords ? `${totalHeads.toLocaleString()} heads` : "—",
      sub: `${inventories.length} entries`,
    },
    {
      label: "Approved in Registry",
      icon: <CheckCircle2 className="size-4.5" />,
      variant: "sky",
      value: hasRecords ? `${approvedHeads.toLocaleString()} heads` : "—",
      sub: `${approvalRate}% verified`,
      subClass: "text-sky-700 bg-sky-100/70 border-sky-200",
    },
    {
      label: "Pending Review",
      icon: <Clock className="size-4.5" />,
      variant: pendingRecords > 0 ? "amber" : "stone",
      value: hasRecords ? `${pendingRecords.toLocaleString()} records` : "—",
      sub: pendingRecords > 0 ? "Awaiting review" : "Up to date",
      subClass:
        pendingRecords > 0
          ? "text-amber-700 bg-amber-100/70 border-amber-200"
          : "text-stone-600 bg-stone-100 border-stone-200",
    },
    {
      label: "Individual Tags",
      icon: <Tag className="size-4.5" />,
      variant: "orange",
      value: hasRecords ? `${individualTags.toLocaleString()} tags` : "—",
      sub: "Ear tagged",
      subClass: "text-orange-700 bg-orange-100/70 border-orange-200",
    },
    {
      label: "Herd Vaccination",
      icon: <ShieldCheck className="size-4.5" />,
      variant: "emerald",
      value: hasRecords ? `${vaxRate}%` : "—",
      sub: `${vaccinatedHeads} protected`,
      subClass: "text-emerald-700 bg-emerald-100/70 border-emerald-200",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCard key={i} title="" value="" isLoading layout={layout} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {allCards.map((card) => (
        <KpiCard
          key={card.label}
          title={card.label}
          value={card.value}
          icon={card.icon}
          badge={card.sub}
          badgeClassName={card.subClass}
          variant={card.variant}
          layout={layout}
        />
      ))}
    </div>
  );
}
