"use client";

import { Layers, Tag, ShieldCheck } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InventoryTabsNavProps {
  speciesCount: number;
  totalRecords: number;
  vaxRate: number;
}

export function InventoryTabsNav({
  speciesCount,
  totalRecords,
  vaxRate,
}: InventoryTabsNavProps) {
  return (
    <TabsList className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs h-auto">
      {/* Tab 1: Species Breakdown */}
      <TabsTrigger
        value="types"
        className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-emerald-200/80 data-[state=active]:shadow-sm data-[state=active]:text-emerald-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-emerald-700 group-data-[state=active]:text-white shadow-2xs">
            <Layers className="size-4.5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-black tracking-tight leading-tight">Species Breakdown</p>
            <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80 truncate">
              Herd Categories & Distribution
            </p>
          </div>
        </div>
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800 shrink-0 border border-transparent group-data-[state=active]:border-emerald-200/60">
          {speciesCount > 0 ? `${speciesCount} Species` : "Species"}
        </span>
      </TabsTrigger>

      {/* Tab 2: Complete Herd Registry */}
      <TabsTrigger
        value="all"
        className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-teal-200/80 data-[state=active]:shadow-sm data-[state=active]:text-teal-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-teal-100/80 text-teal-800 group-data-[state=active]:bg-teal-700 group-data-[state=active]:text-white shadow-2xs">
            <Tag className="size-4.5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-black tracking-tight leading-tight">Complete Herd Registry</p>
            <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-teal-700/80 truncate">
              Ear Tags, Biometrics & Actions
            </p>
          </div>
        </div>
        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-teal-100 group-data-[state=active]:text-teal-800 shrink-0 border border-transparent group-data-[state=active]:border-teal-200/60">
          {totalRecords} {totalRecords === 1 ? "Record" : "Records"}
        </span>
      </TabsTrigger>

      {/* Tab 3: Health & Immunization Tracker */}
      <TabsTrigger
        value="health"
        className="group relative flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left border border-transparent data-[state=active]:bg-white data-[state=active]:border-emerald-200/80 data-[state=active]:shadow-sm data-[state=active]:text-emerald-950 text-slate-600 hover:text-slate-900 hover:bg-white/60 cursor-pointer h-auto"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-[#2D5A27] group-data-[state=active]:text-white shadow-2xs">
            <ShieldCheck className="size-4.5" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-black tracking-tight leading-tight">Health & Immunization</p>
            <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80 truncate">
              Surveillance & Biosecurity
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-colors bg-emerald-50 text-emerald-800 shrink-0 border border-emerald-200/60">
          <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
          {vaxRate}% Vax
        </span>
      </TabsTrigger>
    </TabsList>
  );
}
