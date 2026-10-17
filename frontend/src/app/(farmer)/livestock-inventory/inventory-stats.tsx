"use client";

import { KpiCard,type KpiVariant } from "@/components/ui/kpi-card";
import { Beef,Layers,Mars,ShieldCheck,Venus } from "lucide-react";
import type { LivestockBatchItem,LivestockInventoryItem } from "./livestock-inventory";

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
  batches = [],
}: {
  inventories: LivestockInventoryItem[];
  batches?: LivestockBatchItem[];
  isLoading?: boolean;
  layout?: "vertical" | "horizontal";
}) {
  const isCattle = (name: string) => /cattle|bovine|cow/i.test(name);
  const cattle = inventories.filter((item) => isCattle(item.livestockTypeName));
  const totalCattleHeads = cattle.reduce((total, item) => total + item.quantity, 0);
  const femaleHeads = cattle
    .filter((item) => ["F", "FEMALE"].includes((item.sex?.trim().toUpperCase() ?? "")))
    .reduce((total, item) => total + item.quantity, 0);
  const maleHeads = cattle
    .filter((item) => ["M", "MALE", "CASTRATED"].includes((item.sex?.trim().toUpperCase() ?? "")))
    .reduce((total, item) => total + item.quantity, 0);
  const vaccinatedCattleHeads = cattle
    .filter((item) => Boolean(item.lastVaccinationDate))
    .reduce((total, item) => total + item.quantity, 0);
  const vaccinationRate = totalCattleHeads > 0
    ? Math.round((vaccinatedCattleHeads / totalCattleHeads) * 100)
    : 0;
  const activeCattleHerds = batches.filter(
    (batch) => isCattle(batch.livestockTypeName) && batch.status === "ACTIVE" && batch.totalAnimals > 0,
  ).length;

  const allCards: InventoryCardConfig[] = [
    {
      label: "Total Cattle Heads",
      icon: <Beef className="size-4.5" />,
      variant: "emerald",
      value: `${totalCattleHeads.toLocaleString()} heads`,
      sub: "Current inventory records",
    },
    {
      label: "Female Cattle",
      icon: <Venus className="size-4.5" />,
      variant: "rose",
      value: `${femaleHeads.toLocaleString()} heads`,
      sub: "Recorded female head count",
    },
    {
      label: "Male Cattle",
      icon: <Mars className="size-4.5" />,
      variant: "sky",
      value: `${maleHeads.toLocaleString()} heads`,
      sub: "Includes castrated cattle",
    },
    {
      label: "Total Herds",
      icon: <Layers className="size-4.5" />,
      variant: "orange",
      value: activeCattleHerds.toLocaleString(),
      sub: "Active cattle herd groups",
    },
    {
      label: "Herd Vaccination",
      icon: <ShieldCheck className="size-4.5" />,
      variant: "emerald",
      value: totalCattleHeads > 0 ? `${vaccinationRate}%` : "—",
      sub: totalCattleHeads > 0
        ? `${vaccinatedCattleHeads.toLocaleString()} of ${totalCattleHeads.toLocaleString()} cattle have a vaccination date recorded`
        : "No cattle recorded",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCard key={i} title="" value="" isLoading layout={layout} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {allCards.map((card) => (
        <KpiCard
          key={card.label}
          title={card.label}
          value={card.value}
          icon={card.icon}
          description={card.sub}
          variant={card.variant}
          layout={layout}
        />
      ))}
    </div>
  );
}
