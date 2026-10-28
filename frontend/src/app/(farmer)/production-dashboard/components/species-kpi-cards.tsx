"use client";

import { KpiCard } from "@/components/ui/kpi-card";
import {
Baby,
Beef,
ClipboardList,
Egg,
Milk,
Package,
Scale,
TrendingUp,
Users
} from "lucide-react";
import { useMemo } from "react";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";
import type { ProductionRecordItem, ProductionType } from "../production-analytics";
import type { CalvingRecordItem } from "../production-calving-tab";

interface SpeciesKpiCardsProps {
  species?: string | null;
  activity?: string | null;
  productionType?: ProductionType | null;
  inventories: LivestockInventoryItem[];
  productionRecords: ProductionRecordItem[];
  calvingRecords: CalvingRecordItem[];
  weightRecords?: Array<{ weight: number; weighing_date: string; livestock: number }>;
}

export default function SpeciesKpiCards({
  species,
  activity,
  productionType,
  inventories,
  productionRecords,
  calvingRecords,
  weightRecords = [],
}: SpeciesKpiCardsProps) {
  const normSpecies = (species || "ALL").toUpperCase();
  const effectiveType = (activity || productionType)?.toLowerCase();

  const metrics = useMemo(() => {
    const eligibleProductionRecords = productionRecords.filter((record) =>
      (record.status || "").toUpperCase() === "RECORDED"
    );
    const totalHeads = inventories.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );
    const totalRecords = eligibleProductionRecords.length;
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
    const milkRecords = eligibleProductionRecords.filter((r) => r.productionType === "milk");
    const meatRecords = eligibleProductionRecords.filter((r) => r.productionType === "meat");
    const eggRecords = eligibleProductionRecords.filter((r) => r.productionType === "eggs");
    const woolRecords = eligibleProductionRecords.filter((r) => r.productionType === "wool");

    const totalMilk = milkRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalMeat = meatRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalEggs = eggRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
    const totalWool = woolRecords.reduce((sum, r) => sum + Number(r.quantity || 0), 0);

    const verifiedMilk = totalMilk;
    const pendingMilk = 0;

    const verifiedMeat = totalMeat;
    const pendingMeat = 0;
    const meatRecordCount = meatRecords.length;
    const avgMeatPerRecord =
      meatRecordCount > 0 ? (totalMeat / meatRecordCount).toFixed(1) : null;
    const approvedMeatCount = meatRecordCount;

    const verifiedEggs = totalEggs;
    const pendingEggs = 0;

    const verifiedWool = totalWool;
    const pendingWool = 0;

    const eggRecordCount = eggRecords.length;
    const avgEggsPerRecord =
      eggRecordCount > 0 ? (totalEggs / eggRecordCount).toFixed(0) : null;
    const approvedEggCount = eggRecordCount;

    const woolRecordCount = woolRecords.length;
    const avgWoolPerRecord =
      woolRecordCount > 0 ? (totalWool / woolRecordCount).toFixed(1) : null;
    const approvedWoolCount = woolRecordCount;

    const milkRecordCount = milkRecords.length;
    const avgMilkPerRecord =
      milkRecordCount > 0 ? (totalMilk / milkRecordCount).toFixed(1) : null;
    const approvedMilkCount = milkRecordCount;

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
        : null;

    // Old review states remain visible in history, but are not routine production analytics.
    const legacyReviewCount = productionRecords.filter(
      (record) => !["RECORDED", "APPROVED"].includes((record.status || "").toUpperCase())
    ).length;

    return {
      totalHeads,
      totalRecords,
      totalOffspring,
      breedingFemalesCount,
      totalMilk,
      totalMeat,
      totalEggs,
      totalWool,
      verifiedMilk,
      pendingMilk,
      verifiedMeat,
      pendingMeat,
      meatRecordCount,
      avgMeatPerRecord,
      approvedMeatCount,
      verifiedEggs,
      pendingEggs,
      eggRecordCount,
      avgEggsPerRecord,
      approvedEggCount,
      verifiedWool,
      pendingWool,
      woolRecordCount,
      avgWoolPerRecord,
      approvedWoolCount,
      milkRecordCount,
      avgMilkPerRecord,
      approvedMilkCount,
      legacyReviewCount,
      avgBirthWeight,
      femaleOffspringCount,
      maleOffspringCount,
      avgWeight: avgWeight !== "0.0" && avgWeight !== "NaN" ? avgWeight : null,
    };
  }, [inventories, productionRecords, calvingRecords, weightRecords]);

  // Responsive grid container class for KPI cards
  const gridClassName = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4";

  // ── MEAT-SPECIFIC VIEWS ──
  if (effectiveType === "meat") {
    // Cattle / Carabao (Beef / Carabeef)
    if (normSpecies.includes("CATTLE") || normSpecies.includes("CARABAO") || normSpecies.includes("BAKA") || normSpecies.includes("KALABAW")) {
      const isCarabao = normSpecies.includes("CARABAO") || normSpecies.includes("KALABAW");
      const meatTitle = isCarabao ? "Recorded Carabeef Output" : "Recorded Beef Output";
      const herdTitle = isCarabao ? "Carabao Herd Inventory" : "Cattle Herd Inventory";

      return (
        <div className={gridClassName}>
          <KpiCard
            title={meatTitle}
            value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
            icon={<Beef className="size-4.5" />}
            badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
            variant="rose"
          />
          <KpiCard
            title="Average Yield / Entry"
            value={metrics.avgMeatPerRecord ? `${metrics.avgMeatPerRecord} kg` : "—"}
            icon={<TrendingUp className="size-4.5" />}
            badge={`${metrics.meatRecordCount} recorded ${metrics.meatRecordCount === 1 ? "entry" : "entries"}`}
            variant="emerald"
          />
          <KpiCard
            title="Herd Finishing Weight"
            value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
            icon={<Scale className="size-4.5" />}
            badge="Liveweight tracking"
            variant="amber"
          />
          <KpiCard
            title={herdTitle}
            value={`${metrics.totalHeads} Heads`}
            icon={<Users className="size-4.5" />}
            badge={`${species || "Cattle"} registered herd`}
            variant="stone"
          />
        </div>
      );
    }

    // Swine
    if (normSpecies.includes("SWINE") || normSpecies.includes("PIG") || normSpecies.includes("BABOY")) {
      return (
        <div className={gridClassName}>
          <KpiCard
            title="Pork & Carcass Yield"
            value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
            icon={<Beef className="size-4.5" />}
            badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
            variant="rose"
          />
          <KpiCard
            title="Average Yield / Entry"
            value={metrics.avgMeatPerRecord ? `${metrics.avgMeatPerRecord} kg` : "—"}
            icon={<TrendingUp className="size-4.5" />}
            badge={`${metrics.meatRecordCount} recorded ${metrics.meatRecordCount === 1 ? "entry" : "entries"}`}
            variant="emerald"
          />
          <KpiCard
            title="Avg Grower Weight"
            value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
            icon={<Scale className="size-4.5" />}
            badge="Fattening velocity"
            variant="amber"
          />
          <KpiCard
            title="Swine Inventory"
            value={`${metrics.totalHeads} Heads`}
            icon={<Users className="size-4.5" />}
            badge="Total active swine"
            variant="stone"
          />
        </div>
      );
    }

    // Goat (Chevon)
    if (normSpecies.includes("GOAT") || normSpecies.includes("KAMBING")) {
      return (
        <div className={gridClassName}>
          <KpiCard
            title="Chevon & Meat Output"
            value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
            icon={<Beef className="size-4.5" />}
            badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
            variant="rose"
          />
          <KpiCard
            title="Average Yield / Entry"
            value={metrics.avgMeatPerRecord ? `${metrics.avgMeatPerRecord} kg` : "—"}
            icon={<TrendingUp className="size-4.5" />}
            badge={`${metrics.meatRecordCount} recorded ${metrics.meatRecordCount === 1 ? "entry" : "entries"}`}
            variant="emerald"
          />
          <KpiCard
            title="Average Herd Weight"
            value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
            icon={<Scale className="size-4.5" />}
            badge="Liveweight tracking"
            variant="amber"
          />
          <KpiCard
            title="Total Goat Herd"
            value={`${metrics.totalHeads} Heads`}
            icon={<Users className="size-4.5" />}
            badge="Active goat herd"
            variant="stone"
          />
        </div>
      );
    }

    // Sheep (Mutton)
    if (normSpecies.includes("SHEEP") || normSpecies.includes("TUPA")) {
      return (
        <div className={gridClassName}>
          <KpiCard
            title="Mutton & Meat Output"
            value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
            icon={<Beef className="size-4.5" />}
            badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
            variant="rose"
          />
          <KpiCard
            title="Average Yield / Entry"
            value={metrics.avgMeatPerRecord ? `${metrics.avgMeatPerRecord} kg` : "—"}
            icon={<TrendingUp className="size-4.5" />}
            badge={`${metrics.meatRecordCount} recorded ${metrics.meatRecordCount === 1 ? "entry" : "entries"}`}
            variant="emerald"
          />
          <KpiCard
            title="Average Flock Weight"
            value={metrics.avgWeight ? `${metrics.avgWeight} kg` : "—"}
            icon={<Scale className="size-4.5" />}
            badge="Liveweight tracking"
            variant="amber"
          />
          <KpiCard
            title="Total Flock Size"
            value={`${metrics.totalHeads} Heads`}
            icon={<Users className="size-4.5" />}
            badge="Active sheep flock"
            variant="stone"
          />
        </div>
      );
    }

    // Poultry
    if (normSpecies.includes("POULTRY") || normSpecies.includes("CHICKEN") || normSpecies.includes("MANOK") || normSpecies.includes("DUCK")) {
      return (
        <div className={gridClassName}>
          <KpiCard
            title="Broiler Meat Harvest"
            value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
            icon={<Beef className="size-4.5" />}
            badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
            variant="rose"
          />
          <KpiCard
            title="Average Yield / Entry"
            value={metrics.avgMeatPerRecord ? `${metrics.avgMeatPerRecord} kg` : "—"}
            icon={<TrendingUp className="size-4.5" />}
            badge={`${metrics.meatRecordCount} recorded ${metrics.meatRecordCount === 1 ? "entry" : "entries"}`}
            variant="emerald"
          />
          <KpiCard
            title="Total Flock Size"
            value={`${metrics.totalHeads} Birds`}
            icon={<Users className="size-4.5" />}
            badge="Active flock inventory"
            variant="sky"
          />
          <KpiCard
            title="Meat Output Logs"
            value={`${metrics.meatRecordCount} Logs`}
            icon={<ClipboardList className="size-4.5" />}
            badge={`${metrics.approvedMeatCount} recorded`}
            variant="stone"
          />
        </div>
      );
    }

    // Consolidated / ALL with activity=meat
    return (
      <div className={gridClassName}>
        <KpiCard
          title="Total Meat Output"
          value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
          icon={<Beef className="size-4.5" />}
          badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
          variant="rose"
        />
        <KpiCard
          title="Average Yield / Entry"
          value={metrics.avgMeatPerRecord ? `${metrics.avgMeatPerRecord} kg` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge={`Across ${metrics.meatRecordCount} meat ${metrics.meatRecordCount === 1 ? "entry" : "entries"}`}
          variant="emerald"
        />
        <KpiCard
          title="Meat Output Logs"
          value={`${metrics.meatRecordCount} Logs`}
          icon={<ClipboardList className="size-4.5" />}
          badge={`${metrics.approvedMeatCount} recorded`}
          variant="amber"
        />
        <KpiCard
          title="Total Farm Inventory"
          value={`${metrics.totalHeads} Heads`}
          icon={<Users className="size-4.5" />}
          badge="Across active enterprises"
          variant="stone"
        />
      </div>
    );
  }

  // ── EGGS-SPECIFIC VIEWS ──
  if (effectiveType === "eggs") {
    const layingRate =
      metrics.breedingFemalesCount > 0 && metrics.totalEggs > 0
        ? Math.min(100, Math.round((metrics.totalEggs / metrics.breedingFemalesCount) * 100))
        : 0;

    return (
      <div className={gridClassName}>
        <KpiCard
          title="Daily Egg Harvest"
          value={metrics.totalEggs > 0 ? `${metrics.totalEggs.toLocaleString()} pcs` : "0 pcs"}
          icon={<Egg className="size-4.5" />}
          badge={metrics.pendingEggs > 0 ? `${metrics.verifiedEggs.toLocaleString()} pcs recorded · ${metrics.pendingEggs.toLocaleString()} pcs in legacy statuses` : `${metrics.totalEggs.toLocaleString()} pcs recorded`}
          variant="amber"
        />
        <KpiCard
          title="Average Yield / Collection"
          value={metrics.avgEggsPerRecord ? `${metrics.avgEggsPerRecord} pcs` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge={`${metrics.eggRecordCount} recorded ${metrics.eggRecordCount === 1 ? "collection" : "collections"}`}
          variant="emerald"
        />
        <KpiCard
          title="Egg Collection Logs"
          value={`${metrics.eggRecordCount} Logs`}
          icon={<ClipboardList className="size-4.5" />}
          badge={`${metrics.approvedEggCount} recorded`}
          variant="sky"
        />
        <KpiCard
          title="Flock Laying Efficiency"
          value={layingRate > 0 ? `${layingRate}%` : "—"}
          icon={<Users className="size-4.5" />}
          badge={`${metrics.totalHeads} total birds`}
          variant="stone"
        />
      </div>
    );
  }

  // ── WOOL-SPECIFIC VIEWS ──
  if (effectiveType === "wool") {
    return (
      <div className={gridClassName}>
        <KpiCard
          title="Wool & Fleece Harvest"
          value={metrics.totalWool > 0 ? `${metrics.totalWool.toLocaleString()} kg` : "0.0 kg"}
          icon={<Package className="size-4.5" />}
          badge={metrics.pendingWool > 0 ? `${metrics.verifiedWool.toLocaleString()} kg recorded · ${metrics.pendingWool.toLocaleString()} kg in legacy statuses` : `${metrics.totalWool.toLocaleString()} kg recorded`}
          variant="stone"
        />
        <KpiCard
          title="Average Yield / Shearing"
          value={metrics.avgWoolPerRecord ? `${metrics.avgWoolPerRecord} kg` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge={`${metrics.woolRecordCount} recorded ${metrics.woolRecordCount === 1 ? "shearing" : "shearings"}`}
          variant="emerald"
        />
        <KpiCard
          title="Wool Shearing Logs"
          value={`${metrics.woolRecordCount} Logs`}
          icon={<ClipboardList className="size-4.5" />}
          badge={`${metrics.approvedWoolCount} recorded`}
          variant="amber"
        />
        <KpiCard
          title="Wool-Bearing Flock"
          value={`${metrics.totalHeads} Heads`}
          icon={<Users className="size-4.5" />}
          badge="Active sheep flock"
          variant="sky"
        />
      </div>
    );
  }

  // ── MILK-SPECIFIC GENERAL / ALL VIEW ──
  if (effectiveType === "milk" && (normSpecies === "ALL" || !normSpecies.includes("GOAT"))) {
    const perCowYield =
      metrics.breedingFemalesCount > 0 && metrics.totalMilk > 0
        ? (metrics.totalMilk / metrics.breedingFemalesCount).toFixed(1)
        : null;

    return (
      <div className={gridClassName}>
        <KpiCard
          title="Dairy Milk Output"
          value={metrics.totalMilk > 0 ? `${metrics.totalMilk.toLocaleString()} L` : "0.0 L"}
          icon={<Milk className="size-4.5" />}
          badge={metrics.pendingMilk > 0 ? `${metrics.verifiedMilk.toLocaleString()} L recorded · ${metrics.pendingMilk.toLocaleString()} L in legacy statuses` : `${metrics.totalMilk.toLocaleString()} L recorded`}
          variant="sky"
        />
        <KpiCard
          title="Milking Yield / Dam"
          value={perCowYield ? `${perCowYield} L/head` : metrics.avgMilkPerRecord ? `${metrics.avgMilkPerRecord} L/entry` : "—"}
          icon={<TrendingUp className="size-4.5" />}
          badge={`${metrics.breedingFemalesCount} breeding dams`}
          variant="emerald"
        />
        <KpiCard
          title="Milking Output Logs"
          value={`${metrics.milkRecordCount} Logs`}
          icon={<ClipboardList className="size-4.5" />}
          badge={`${metrics.approvedMilkCount} recorded`}
          variant="amber"
        />
        <KpiCard
          title="Active Dairy Herd"
          value={`${metrics.totalHeads} Heads`}
          icon={<Users className="size-4.5" />}
          badge="Active herd inventory"
          variant="stone"
        />
      </div>
    );
  }

  // ── NON-MEAT SPECIES VIEWS ──

  // GOAT
  if (normSpecies.includes("GOAT") || normSpecies.includes("KAMBING")) {
    return (
      <div className={gridClassName}>
        <KpiCard
          title="Goat Milk Yield"
          value={metrics.totalMilk > 0 ? `${metrics.totalMilk.toLocaleString()} L` : "0.0 L"}
          icon={<Milk className="size-4.5" />}
          badge={metrics.pendingMilk > 0 ? `${metrics.verifiedMilk.toLocaleString()} L recorded · ${metrics.pendingMilk.toLocaleString()} L in legacy statuses` : `${metrics.totalMilk.toLocaleString()} L recorded`}
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

  // SHEEP
  if (normSpecies.includes("SHEEP") || normSpecies.includes("TUPA")) {
    return (
      <div className={gridClassName}>
        <KpiCard
          title="Wool & Fleece Harvest"
          value={metrics.totalWool > 0 ? `${metrics.totalWool.toLocaleString()} kg` : "0.0 kg"}
          icon={<Package className="size-4.5" />}
          badge={metrics.pendingWool > 0 ? `${metrics.verifiedWool.toLocaleString()} kg recorded · ${metrics.pendingWool.toLocaleString()} kg in legacy statuses` : `${metrics.totalWool.toLocaleString()} kg recorded`}
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

  // SWINE
  if (normSpecies.includes("SWINE") || normSpecies.includes("PIG") || normSpecies.includes("BABOY")) {
    return (
      <div className={gridClassName}>
        <KpiCard
          title="Pork / Carcass Yield"
          value={metrics.totalMeat > 0 ? `${metrics.totalMeat.toLocaleString()} kg` : "0.0 kg"}
          icon={<Beef className="size-4.5" />}
          badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
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

  // POULTRY
  if (normSpecies.includes("POULTRY") || normSpecies.includes("CHICKEN") || normSpecies.includes("MANOK") || normSpecies.includes("DUCK")) {
    const layingRate =
      metrics.breedingFemalesCount > 0
        ? Math.min(100, Math.round((metrics.totalEggs / metrics.breedingFemalesCount) * 100))
        : 0;

    return (
      <div className={gridClassName}>
        <KpiCard
          title="Daily Egg Harvest"
          value={metrics.totalEggs > 0 ? `${metrics.totalEggs.toLocaleString()} pcs` : "0 pcs"}
          icon={<Egg className="size-4.5" />}
          badge={metrics.pendingEggs > 0 ? `${metrics.verifiedEggs.toLocaleString()} pcs recorded · ${metrics.pendingEggs.toLocaleString()} pcs in legacy statuses` : `${metrics.totalEggs.toLocaleString()} pcs recorded`}
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
          badge={metrics.pendingMeat > 0 ? `${metrics.verifiedMeat.toLocaleString()} kg recorded · ${metrics.pendingMeat.toLocaleString()} kg in legacy statuses` : `${metrics.totalMeat.toLocaleString()} kg recorded`}
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

  // Default CATTLE / CARABAO (Dairy Yield)
  if (normSpecies.includes("CATTLE") || normSpecies.includes("CARABAO") || normSpecies.includes("BAKA") || normSpecies.includes("KALABAW")) {
    const perCowYield =
      metrics.breedingFemalesCount > 0 && metrics.totalMilk > 0
        ? (metrics.totalMilk / metrics.breedingFemalesCount).toFixed(1)
        : "—";

    return (
      <div className={gridClassName}>
        <KpiCard
          title="Dairy Milk Output"
          value={metrics.totalMilk > 0 ? `${metrics.totalMilk.toLocaleString()} L` : "0.0 L"}
          icon={<Milk className="size-4.5" />}
          badge={metrics.pendingMilk > 0 ? `${metrics.verifiedMilk.toLocaleString()} L recorded · ${metrics.pendingMilk.toLocaleString()} L in legacy statuses` : `${metrics.totalMilk.toLocaleString()} L recorded`}
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
    <div className={gridClassName}>
      <KpiCard
        title="Total Output Logs"
        value={metrics.totalRecords.toString()}
        icon={<ClipboardList className="size-4.5" />}
        badge={`${metrics.totalRecords} eligible logs · ${metrics.legacyReviewCount} legacy statuses`}
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
        title="Legacy Review Statuses"
        value={metrics.legacyReviewCount.toString()}
        icon={<ClipboardList className="size-4.5" />}
        badge="Historical entries outside production analytics"
        variant="stone"
      />
    </div>
  );
}
