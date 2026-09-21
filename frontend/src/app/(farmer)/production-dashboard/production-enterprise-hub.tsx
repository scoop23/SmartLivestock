"use client";

import { useMemo } from "react";
import {
  Activity,
  Baby,
  Beef,
  ChevronRight,
  Egg,
  HeartPulse,
  Layers,
  Milk,
  Package,
  Plus,
  Scale,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { LivestockInventoryItem } from "../livestock-inventory/page";
import type { ProductionRecordItem } from "./production-analytics";

export interface SpeciesConfig {
  name: string;
  icon: React.ElementType;
  tagline: string;
  birthingTerm: string;
  primaryYields: string[];
  gradient: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  btnClass: string;
  glowColor: string;
}

export const ENTERPRISE_CONFIGS: Record<string, SpeciesConfig> = {
  Cattle: {
    name: "Cattle",
    icon: Beef,
    tagline: "Dairy Milk, Beef Carcass & Calving Records",
    birthingTerm: "Calving",
    primaryYields: ["Dairy Milk (L)", "Beef Meat (kg)"],
    gradient: "from-emerald-950 via-emerald-900 to-teal-950",
    badgeBg: "bg-emerald-500/20 border-emerald-400/30",
    badgeText: "text-emerald-300",
    borderClass: "border-emerald-800/40 hover:border-emerald-500/60",
    btnClass: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40",
    glowColor: "bg-emerald-500/10",
  },
  Carabao: {
    name: "Carabao",
    icon: Shield,
    tagline: "Carabao Milk, Draft Power & Carabeef Yields",
    birthingTerm: "Calving",
    primaryYields: ["Carabao Milk (L)", "Carabeef (kg)"],
    gradient: "from-teal-950 via-teal-900 to-slate-950",
    badgeBg: "bg-teal-500/20 border-teal-400/30",
    badgeText: "text-teal-300",
    borderClass: "border-teal-800/40 hover:border-teal-500/60",
    btnClass: "bg-teal-600 hover:bg-teal-500 text-white shadow-teal-950/40",
    glowColor: "bg-teal-500/10",
  },
  Goat: {
    name: "Goat",
    icon: Sparkles,
    tagline: "Artisanal Goat Milk, Chevon & Kidding Twins Registry",
    birthingTerm: "Kidding",
    primaryYields: ["Goat Milk (L)", "Chevon (kg)"],
    gradient: "from-amber-950 via-amber-900 to-stone-950",
    badgeBg: "bg-amber-500/20 border-amber-400/30",
    badgeText: "text-amber-300",
    borderClass: "border-amber-800/40 hover:border-amber-500/60",
    btnClass: "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40",
    glowColor: "bg-amber-500/10",
  },
  Sheep: {
    name: "Sheep",
    icon: Package,
    tagline: "Fleece Wool Shearing, Mutton & Lambing Tracker",
    birthingTerm: "Lambing",
    primaryYields: ["Wool / Fleece (kg)", "Mutton (kg)"],
    gradient: "from-violet-950 via-purple-900 to-slate-950",
    badgeBg: "bg-violet-500/20 border-violet-400/30",
    badgeText: "text-violet-300",
    borderClass: "border-violet-800/40 hover:border-violet-500/60",
    btnClass: "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-950/40",
    glowColor: "bg-violet-500/10",
  },
  Swine: {
    name: "Swine",
    icon: Layers,
    tagline: "Pork Carcass, Finishing ADG & Farrowing Litters",
    birthingTerm: "Farrowing",
    primaryYields: ["Pork Meat (kg)", "Liveweight (kg)"],
    gradient: "from-sky-950 via-sky-900 to-slate-950",
    badgeBg: "bg-sky-500/20 border-sky-400/30",
    badgeText: "text-sky-300",
    borderClass: "border-sky-800/40 hover:border-sky-500/60",
    btnClass: "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/40",
    glowColor: "bg-sky-500/10",
  },
  Poultry: {
    name: "Poultry",
    icon: Egg,
    tagline: "Table Egg Trays, Broiler Yields & Hatching Clutches",
    birthingTerm: "Hatching",
    primaryYields: ["Table Eggs (pcs/trays)", "Broiler Meat (kg)"],
    gradient: "from-orange-950 via-amber-900 to-slate-950",
    badgeBg: "bg-orange-500/20 border-orange-400/30",
    badgeText: "text-orange-300",
    borderClass: "border-orange-800/40 hover:border-orange-500/60",
    btnClass: "bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/40",
    glowColor: "bg-orange-500/10",
  },
};

const DEFAULT_CONFIG: SpeciesConfig = {
  name: "Livestock",
  icon: Activity,
  tagline: "Production Yields, Biometrics & Growth Surveillance",
  birthingTerm: "Birthing",
  primaryYields: ["Yields", "Meat (kg)"],
  gradient: "from-slate-950 via-slate-900 to-stone-950",
  badgeBg: "bg-slate-500/20 border-slate-400/30",
  badgeText: "text-slate-300",
  borderClass: "border-slate-800/40 hover:border-slate-500/60",
  btnClass: "bg-slate-700 hover:bg-slate-600 text-white",
  glowColor: "bg-slate-500/10",
};

interface ProductionEnterpriseHubProps {
  inventories: LivestockInventoryItem[];
  productionRecords: ProductionRecordItem[];
  calvingRecords?: any[];
  weightRecords?: any[];
  onSelectSpecies: (species: string | "ALL") => void;
  onOpenQuickLog?: (species: string) => void;
}

export default function ProductionEnterpriseHub({
  inventories,
  productionRecords,
  calvingRecords = [],
  weightRecords = [],
  onSelectSpecies,
  onOpenQuickLog,
}: ProductionEnterpriseHubProps) {
  // Aggregate inventories by species
  const speciesSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        heads: number;
        recordsCount: number;
        batches: number;
        individuals: number;
        approved: number;
        productionLogs: number;
      }
    >();

    // Seed with any species found in inventories
    inventories.forEach((item) => {
      const type = item.livestockTypeName?.trim() || "Cattle";
      const existing = map.get(type) || {
        name: type,
        heads: 0,
        recordsCount: 0,
        batches: 0,
        individuals: 0,
        approved: 0,
        productionLogs: 0,
      };

      existing.heads += item.quantity || 1;
      existing.recordsCount += 1;
      if (item.entryType === "BATCH") existing.batches += 1;
      else existing.individuals += 1;
      if (item.status === "APPROVED") existing.approved += item.quantity || 1;

      map.set(type, existing);
    });

    // If no inventories found, default to Cattle preview
    if (map.size === 0) {
      map.set("Cattle", {
        name: "Cattle",
        heads: 0,
        recordsCount: 0,
        batches: 0,
        individuals: 0,
        approved: 0,
        productionLogs: 0,
      });
    }

    // Attach production logs count
    productionRecords.forEach((rec) => {
      const type = rec.livestockTypeName?.trim();
      if (type && map.has(type)) {
        map.get(type)!.productionLogs += 1;
      }
    });

    return Array.from(map.values());
  }, [inventories, productionRecords]);

  const totalHeadsAll = inventories.reduce((acc, i) => acc + (i.quantity || 1), 0);
  const totalProductionLogs = productionRecords.length;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          PRODUCTION HUB HEADER & TELEMETRY
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white p-6 sm:p-8 border border-emerald-800/40 shadow-xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                Farm Enterprise Production Hub
              </Badge>
              <span className="text-xs font-semibold text-emerald-200/70">
                {speciesSummary.length} Active Livestock Enterprises
              </span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Select a Livestock Enterprise
              </h1>
              <p className="text-sm text-emerald-100/80 font-medium mt-1 leading-relaxed">
                Choose a specific livestock category to access dedicated production yield ledgers,
                species-tailored birthing logs (Calving, Kidding, Lambing), and biometric growth analytics.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => onSelectSpecies("ALL")}
              variant="outline"
              className="gap-2 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl h-12 px-5 backdrop-blur-md transition-all active:scale-95"
            >
              <Activity className="w-4 h-4 text-emerald-300" />
              All-Farm Consolidated View
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          ENTERPRISE SPECIES GRID
      ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Your Registered Farm Enterprises ({speciesSummary.length})
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {speciesSummary.map((item) => {
            const config = ENTERPRISE_CONFIGS[item.name] || DEFAULT_CONFIG;
            const Icon = config.icon;

            return (
              <div
                key={item.name}
                onClick={() => onSelectSpecies(item.name)}
                className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${config.gradient} text-white p-6 border ${config.borderClass} shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between`}
              >
                {/* Ambient glow */}
                <div
                  className={`absolute -top-16 -right-16 size-48 rounded-full ${config.glowColor} blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500`}
                />

                <div className="relative z-10 space-y-4">
                  {/* Top Bar: Icon + Badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md text-white border border-white/10 group-hover:scale-110 transition-transform">
                      <Icon className="size-6 text-white" />
                    </div>
                    <Badge
                      className={`${config.badgeBg} ${config.badgeText} text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md`}
                    >
                      {item.heads} {item.heads === 1 ? "Head" : "Heads"}
                    </Badge>
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h3 className="text-xl font-black tracking-tight text-white group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                      <span>{item.name} Enterprise</span>
                      <ChevronRight className="size-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-xs text-slate-200/80 font-medium mt-1 line-clamp-2">
                      {config.tagline}
                    </p>
                  </div>

                  {/* Enterprise Capabilities Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {config.primaryYields.map((yieldName) => (
                      <span
                        key={yieldName}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/10 text-white/90 border border-white/10 backdrop-blur-xs"
                      >
                        {yieldName}
                      </span>
                    ))}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 border border-white/5">
                      {config.birthingTerm} Logs
                    </span>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Registry Records
                      </span>
                      <span className="text-sm font-black text-white">
                        {item.recordsCount} Entries
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        Yield Logs
                      </span>
                      <span className="text-sm font-black text-white">
                        {item.productionLogs} Recorded
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Launch Button */}
                <div className="relative z-10 pt-5">
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSpecies(item.name);
                    }}
                    className={`w-full ${config.btnClass} font-black rounded-2xl h-11 text-xs transition-all shadow-md active:scale-98`}
                  >
                    Open {item.name} Dashboard
                    <ChevronRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Combined All Farm Ledger Card */}
          <div
            onClick={() => onSelectSpecies("ALL")}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-stone-900 text-white p-6 border border-slate-700/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
          >
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md text-white border border-white/10 group-hover:scale-110 transition-transform">
                  <Activity className="size-6 text-emerald-400" />
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  {totalHeadsAll} Total Heads
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-black tracking-tight text-white group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                  <span>Farm Consolidated Ledger</span>
                  <ChevronRight className="size-5 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-slate-300/80 font-medium mt-1">
                  View full combined financial valuation, total farm volume trends, and consolidated multi-species audit logs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-xs">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    All Species
                  </span>
                  <span className="text-sm font-black text-white">
                    {speciesSummary.length} Enterprises
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Total Output Logs
                  </span>
                  <span className="text-sm font-black text-white">
                    {totalProductionLogs} Logs
                  </span>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-5">
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSpecies("ALL");
                }}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black rounded-2xl h-11 text-xs transition-all shadow-md active:scale-98"
              >
                Open Consolidated Dashboard
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
