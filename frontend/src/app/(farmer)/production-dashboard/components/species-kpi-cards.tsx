"use client";

import { useMemo } from "react";
import {
  Baby,
  Beef,
  ClipboardList,
  Egg,
  HeartPulse,
  Milk,
  Package,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/ui/kpi-card";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";
import type { ProductionRecordItem } from "../production-analytics";
import type { CalvingRecordItem } from "../production-calving-tab";

interface SpeciesKpiCardsProps {
  species?: string | null;
  inventories: LivestockInventoryItem[];
  productionRecords: ProductionRecordItem[];
  calvingRecords: CalvingRecordItem[];
  weightRecords?: Array<{ weight: number; weighing_date: string; livestock: number }>;
}

export default function SpeciesKpiCards({
  species,
  inventories,
  productionRecords,
  calvingRecords,
  weightRecords = [],
}: SpeciesKpiCardsProps) {
  const normSpecies = (species || "ALL").toUpperCase();

  const metrics = useMemo(() => {
    const totalHeads = inventories.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );
    const totalRecords = productionRecords.length;
    const totalOffspring = calvingRecords.length;
    const femaleInventories = inventories.filter(
      (i) =>
        i.sex?.toUpperCase().includes("F") ||
        i.sex?.toUpperCase().includes("FEMALE") ||
        i.entryType === "BATCH"
    );
    const breedingFemalesCount = femaleInventories.reduce(
      (sum, i) => sum + (i.quantity || 1),
      0
    );

    // Yield aggregation
    const milkRecords = productionRecords.filter((r) => r.productionType === "milk");
    const meatRecords = productionRecords.filter((r) => r.productionType === "meat");
    const eggRecords = productionRecords.filter((r) => r.productionType === "eggs");
    const woolRecords = productionRecords.filter((r) => r.productionType === "wool");

    const totalMilk = milkRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalMeat = meatRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalEggs = eggRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalWool = woolRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

    // Average birth weight
    const validBirthWeights = calvingRecords
      .map((c) => Number(c.birth_weight))
      .filter((w) => !isNaN(w) && w > 0);
    const avgBirthWeight =
      validBirthWeights.length > 0
        ? (validBirthWeights.reduce((a, b) => a + b, 0) / validBirthWeights.length).toFixed(1)
        : null;

    // Female offspring
    const femaleOffspringCount = calvingRecords.filter((c) => c.calf_sex === "FEMALE").length;
    const maleOffspringCount = calvingRecords.filter((c) => c.calf_sex === "MALE").length;

    // ADG or Avg Weight
    const validWeights = weightRecords
      .map((w) => Number(w.weight))
      .filter((w) => !isNaN(w) && w > 0);
    const avgWeight =
      validWeights.length > 0
        ? (validWeights.reduce((a, b) => a + b, 0) / validWeights.length).toFixed(1)
        : inventories.length > 0
          ? (
              inventories
                .map((i) => Number(i.weight || 0))
                .filter((w) => w > 0)
                .reduce((a, b) => a + b, 0) /
              (inventories.filter((i) => Number(i.weight || 0) > 0).length || 1)
            ).toFixed(1)
          : null;

    // Approved percentage
    const approvedCount = productionRecords.filter((r) => r.status === "APPROVED").length;
    const approvalRate =
      totalRecords > 0 ? Math.round((approvedCount / totalRecords) * 100) : 100;

    return {
      totalHeads,
      totalRecords,
      totalOffspring,
      breedingFemalesCount,
      totalMilk,
      totalMeat,
      totalEggs,
      totalWool,
      avgBirthWeight,
      femaleOffspringCount,
      maleOffspringCount,
      avgWeight: avgWeight !== "0.0" && avgWeight !== "NaN" ? avgWeight : null,
      approvalRate,
    };
  }, [inventories, productionRecords, calvingRecords, weightRecords]);

  // Render cards according to species
  if (normSpecies.includes("GOAT") || normSpecies.includes("KAMBING")) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Goat Milk Yield"
          value={metrics.totalMilk > 0 ? `${metrics.totalMilk.toLocaleString()} L` : "0.0 L"}
          icon={<Milk className="size-4.5" />}
          badge="Daily dairy collection"
          variant="sky"
        />
        <KpiCard
          title="Kidding Crop"
          value={metrics.totalOffspring.toString()}
          icon={<Baby className="size-4.5" />}
          badge={`${metrics.femaleOffspringCount} doelings / ${metrics.maleOffspringCount} bucklings`}
          variant="emerald"
        />
        <KpiCard
          title="Active Breeding Does"
          value={metrics.breedingFemalesCount.toString()}
          icon={<Users className="size-4.5" />}
          badge={`${metrics.totalHeads} total herd heads`}
          variant="amber"
        />
        <KpiCard
          title="Chevon / Liveweight"
          value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Average herd bodyweight"
          variant="stone"
        />
      </div>
    );
  }

  if (normSpecies.includes("SHEEP") || normSpecies.includes("TUPA")) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Wool & Fleece Harvest"
          value={metrics.totalWool > 0 ? `${metrics.totalWool.toLocaleString()} kg` : "0.0 kg"}
          icon={<Package className="size-4.5" />}
          badge="Sheared fleece total"
          variant="stone"
        />
        <KpiCard
          title="Lambing Crop"
          value={metrics.totalOffspring.toString()}
          icon={<Baby className="size-4.5" />}
          badge={`${metrics.femaleOffspringCount} ewe lambs / ${metrics.maleOffspringCount} ram lambs`}
          variant="emerald"
        />
        <KpiCard
          title="Breeding Ewes"
          value={metrics.breedingFemalesCount.toString()}
          icon={<Users className="size-4.5" />}
          badge={`${metrics.totalHeads} total flock heads`}
          variant="sky"
        />
        <KpiCard
          title="Mutton Liveweight"
          value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Avg bodyweight"
          variant="amber"
        />
      </div>
    );
  }

  if (normSpecies.includes("SWINE") || normSpecies.includes("PIG") || normSpecies.includes("BABOY")) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pork / Carcass Yield"
          value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
          icon={<Beef className="size-4.5" />}
          badge="Finishing liveweight / meat"
          variant="rose"
        />
        <KpiCard
          title="Farrowing Offspring"
          value={metrics.totalOffspring.toString()}
          icon={<Baby className="size-4.5" />}
          badge={`${metrics.femaleOffspringCount} gilts / ${metrics.maleOffspringCount} boars`}
          variant="emerald"
        />
        <KpiCard
          title="Breeding Sows"
          value={metrics.breedingFemalesCount.toString()}
          icon={<Users className="size-4.5" />}
          badge={`${metrics.totalHeads} total swine inventory`}
          variant="amber"
        />
        <KpiCard
          title="Avg Grower Weight"
          value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Fattening velocity"
          variant="stone"
        />
      </div>
    );
  }

  if (normSpecies.includes("POULTRY") || normSpecies.includes("CHICKEN") || normSpecies.includes("MANOK") || normSpecies.includes("DUCK")) {
    const layingRate =
      metrics.breedingFemalesCount > 0
        ? Math.min(100, Math.round((metrics.totalEggs / metrics.breedingFemalesCount) * 100))
        : 0;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Daily Egg Harvest"
          value={metrics.totalEggs > 0 ? `${metrics.totalEggs.toLocaleString()} pcs` : "0 pcs"}
          icon={<Egg className="size-4.5" />}
          badge="Table eggs collected"
          variant="amber"
        />
        <KpiCard
          title="Flock Laying Efficiency"
          value={layingRate > 0 ? `${layingRate}%` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge="Yield per layer hen"
          variant="emerald"
        />
        <KpiCard
          title="Broiler Meat Harvest"
          value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
          icon={<Beef className="size-4.5" />}
          badge="Dressed poultry output"
          variant="rose"
        />
        <KpiCard
          title="Chicks Hatched"
          value={metrics.totalOffspring.toString()}
          icon={<Baby className="size-4.5" />}
          badge={`${metrics.totalHeads} total flock size`}
          variant="sky"
        />
      </div>
    );
  }

  // Default CATTLE / CARABAO
  if (normSpecies.includes("CATTLE") || normSpecies.includes("CARABAO") || normSpecies.includes("BAKA") || normSpecies.includes("KALABAW")) {
    const perCowYield =
      metrics.breedingFemalesCount > 0 && metrics.totalMilk > 0
        ? (metrics.totalMilk / metrics.breedingFemalesCount).toFixed(1)
        : "—";

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Dairy Milk Output"
          value={metrics.totalMilk > 0 ? `${metrics.totalMilk.toLocaleString()} L` : "0.0 L"}
          icon={<Milk className="size-4.5" />}
          badge="Liters recorded"
          variant="sky"
        />
        <KpiCard
          title="Milking Yield / Dam"
          value={perCowYield !== "—" ? `${perCowYield} L/head` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge={`${metrics.breedingFemalesCount} breeding dams`}
          variant="emerald"
        />
        <KpiCard
          title="Calving Crop"
          value={metrics.totalOffspring.toString()}
          icon={<Baby className="size-4.5" />}
          badge={`${metrics.femaleOffspringCount} heifers / ${metrics.maleOffspringCount} bulls`}
          variant="amber"
        />
        <KpiCard
          title="Average Herd Weight"
          value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
          icon={<Scale className="size-4.5" />}
          badge="Liveweight tracking"
          variant="stone"
        />
      </div>
    );
  }

  // Consolidated / ALL
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Total Output Logs"
        value={metrics.totalRecords.toString()}
        icon={<ClipboardList className="size-4.5" />}
        badge="Submitted yield entries"
        variant="emerald"
      />
      <KpiCard
        title="Total Farm Inventory"
        value={`${metrics.totalHeads} Heads`}
        icon={<Users className="size-4.5" />}
        badge="Across all active species"
        variant="sky"
      />
      <KpiCard
        title="Farm-Wide Offspring"
        value={metrics.totalOffspring.toString()}
        icon={<Baby className="size-4.5" />}
        badge="Registered births & hatchings"
        variant="amber"
      />
      <KpiCard
        title="LGU Validation Rate"
        value={`${metrics.approvalRate}%`}
        icon={<ShieldCheck className="size-4.5" />}
        badge="MAO / SIBAT verified"
        variant="stone"
      />
    </div>
  );
}
