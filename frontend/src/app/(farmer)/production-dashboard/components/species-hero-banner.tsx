"use client";

import { Baby, CalendarDays, Milk, Plus, Scale, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onOpenWizard: () => void;
  onOpenBirthing?: () => void;
  quickLogLabel: string;
}

export default function SpeciesHeroBanner({
  species,
  terms,
  filteredInventories,
  filteredProductionRecords,
  calvingRecords,
  onOpenWizard,
  onOpenBirthing,
  quickLogLabel,
}: SpeciesHeroBannerProps) {
  const speciesConfig =
    species && species !== "ALL" ? ENTERPRISE_CONFIGS[species] : null;

  const totalHeads = filteredInventories.reduce(
    (a: number, b: LivestockInventoryItem) => a + (b.quantity || 1),
    0
  );

  return (
    <div
      className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${
        speciesConfig?.gradient || "from-emerald-950 via-teal-950 to-slate-950"
      } text-white p-6 sm:p-8 shadow-lg border border-emerald-900/40`}
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Users className="size-4 text-emerald-400" />
              <span>
                <strong>{totalHeads}</strong> Heads in Enterprise
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
              <Milk className="size-4 text-sky-400" />
              <span>
                <strong>{filteredProductionRecords.length}</strong> Yield Records
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

        {/* Quick Action Logging Trigger */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
          <Button
            onClick={onOpenWizard}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40 rounded-xl gap-2 h-11 transition-all hover:scale-[1.02]"
          >
            <Plus className="size-4" />
            <span>{quickLogLabel}</span>
          </Button>

          {onOpenBirthing && (
            <Button
              onClick={onOpenBirthing}
              variant="outline"
              className="w-full bg-white/10 hover:bg-white/20 border-white/20 text-white font-semibold rounded-xl gap-2 h-10 backdrop-blur-sm"
            >
              <Baby className="size-4 text-amber-300" />
              <span>Record New {terms.eventName}</span>
            </Button>
          )}

          <div className="flex items-center justify-center gap-2 text-[11px] text-emerald-200/80 pt-1">
            <CalendarDays className="size-3.5" />
            <span>Today: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
