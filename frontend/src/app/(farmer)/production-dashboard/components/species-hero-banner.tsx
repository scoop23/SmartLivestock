"use client";

import {
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  Milk,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { ENTERPRISE_CONFIGS } from "../production-enterprise-hub";
import type { BirthingSpeciesTerminology } from "../production-calving-tab";
import type { LivestockInventoryItem } from "../../livestock-inventory/page";
import type { ProductionRecordItem } from "../production-analytics";
import type { CalvingRecordItem } from "../production-calving-tab";

interface SpeciesHeroBannerProps {
  species?: string | null;
  terms: BirthingSpeciesTerminology;
  filteredInventories: LivestockInventoryItem[];
  filteredProductionRecords: ProductionRecordItem[];
  calvingRecords: CalvingRecordItem[];
}

export default function SpeciesHeroBanner({
  species,
  terms,
  filteredInventories,
  filteredProductionRecords,
  calvingRecords,
}: SpeciesHeroBannerProps) {
  const speciesConfig =
    species && species !== "ALL" ? ENTERPRISE_CONFIGS[species] : null;

  const totalHeads = filteredInventories.reduce(
    (a: number, b: LivestockInventoryItem) => a + (b.quantity || 1),
    0
  );

  const breedingDamsCount = filteredInventories
    .filter(
      (i) =>
        i.sex?.toUpperCase().includes("F") ||
        i.sex?.toUpperCase().includes("FEMALE") ||
        i.entryType === "BATCH"
    )
    .reduce((sum, i) => sum + (i.quantity || 1), 0);

  const totalYield = filteredProductionRecords.reduce(
    (sum, r) => sum + Number(r.quantity || 0),
    0
  );

  const unit = (() => {
    const s = (species || "").toUpperCase();
    if (s.includes("POULTRY") || s.includes("CHICKEN")) return "pcs";
    if (s.includes("SWINE") || s.includes("PIG") || s.includes("SHEEP")) return "kg";
    return "L";
  })();

  const totalYieldFormatted =
    totalYield > 0 ? `${totalYield.toLocaleString()} ${unit}` : `0.0 ${unit}`;

  const pendingCount = filteredProductionRecords.filter(
    (r) => r.status === "PENDING"
  ).length;

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${
        speciesConfig?.gradient || "from-emerald-950 via-teal-950 to-slate-950"
      } text-white p-6 sm:p-8 shadow-lg border border-emerald-900/40`}
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Species Telemetry & Context */}
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="size-3.5" />
            {!species || species === "ALL"
              ? "All Farm Production Overview"
              : `${species} Production & Biometric Hub`}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {!species || species === "ALL"
              ? "Farm-Wide Production Performance"
              : `${species} Production & ${terms.eventName} Tracker`}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
            {speciesConfig?.tagline ||
              "Log daily yields, record maternal lineage births, and track growth velocity for municipal verification."}
          </p>

          {/* Quick Telemetry Chips */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Users className="size-4 text-emerald-400" />
              <span>
                <strong>{totalHeads}</strong> Heads in Enterprise
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Milk className="size-4 text-sky-400" />
              <span>
                <strong>{filteredProductionRecords.length}</strong> Yield Logs
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Baby className="size-4 text-amber-400" />
              <span>
                <strong>{calvingRecords.length}</strong> {terms.offspringPlural}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Executive Biosecurity & LGU Compliance Dossier */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 min-w-[280px] lg:max-w-sm shadow-xl shrink-0">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider">
                LGU Biosecurity Active
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-200/80 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
              Padre Garcia
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 py-0.5">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wide text-emerald-200/70 font-semibold">
                Total Output Yield
              </span>
              <p className="text-base sm:text-lg font-black text-white">
                {totalYieldFormatted}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wide text-emerald-200/70 font-semibold">
                LGU Status
              </span>
              <div className="text-xs font-bold text-white flex items-center gap-1 mt-1">
                {pendingCount > 0 ? (
                  <span className="text-amber-300 flex items-center gap-1 font-bold text-[11px]">
                    <Clock className="size-3.5" /> {pendingCount} Pending SIBAT
                  </span>
                ) : (
                  <span className="text-emerald-300 flex items-center gap-1 font-bold text-[11px]">
                    <CheckCircle2 className="size-3.5" /> 100% Certified
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wide text-emerald-200/70 font-semibold">
                Breeding Stock
              </span>
              <p className="text-xs font-bold text-white mt-0.5">
                {breedingDamsCount} Dams • {calvingRecords.length} Offspring
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wide text-emerald-200/70 font-semibold">
                Today
              </span>
              <p className="text-xs font-bold text-emerald-100/90 flex items-center gap-1 mt-0.5">
                <CalendarDays className="size-3 text-emerald-300" />
                {todayFormatted}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-emerald-200/80">
            <span className="flex items-center gap-1.5 font-semibold text-[10px]">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              SIBAT Monitored Holding
            </span>
            <span className="text-[10px] text-emerald-300/70 font-mono">
              MAO Census
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
