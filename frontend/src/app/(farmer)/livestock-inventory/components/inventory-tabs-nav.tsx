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
      {/* Tab 1: Livestock Types */}
      <TabsTrigger
        value="types"
        className="group relative grid grid-cols-1 gap-y-2 whitespace-normal rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-200 data-[state=active]:border-emerald-200/80 data-[state=active]:bg-white data-[state=active]:text-emerald-950 data-[state=active]:shadow-sm text-slate-600 hover:bg-white/60 hover:text-slate-900 cursor-pointer h-auto sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-emerald-700 group-data-[state=active]:text-white shadow-2xs">
            <Layers className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="break-words text-sm font-black leading-tight tracking-tight">Livestock Types</p>
            <p className="line-clamp-2 whitespace-normal break-words text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80">
              Choose a type to view your animals
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit max-w-full justify-self-end whitespace-normal break-words rounded-full border border-transparent px-2.5 py-1 text-right text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:border-emerald-200/60 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800">
          {speciesCount > 0 ? `${speciesCount} Species` : "Types"}
        </span>
      </TabsTrigger>

      {/* Tab 2: All Livestock */}
      <TabsTrigger
        value="all"
        className="group relative grid grid-cols-1 gap-y-2 whitespace-normal rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-200 data-[state=active]:border-teal-200/80 data-[state=active]:bg-white data-[state=active]:text-teal-950 data-[state=active]:shadow-sm text-slate-600 hover:bg-white/60 hover:text-slate-900 cursor-pointer h-auto sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-teal-100/80 text-teal-800 group-data-[state=active]:bg-teal-700 group-data-[state=active]:text-white shadow-2xs">
            <Tag className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="break-words text-sm font-black leading-tight tracking-tight">All Livestock</p>
            <p className="line-clamp-2 whitespace-normal break-words text-[10px] font-medium text-slate-400 group-data-[state=active]:text-teal-700/80">
              Animal details and actions
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit max-w-full justify-self-end whitespace-normal break-words rounded-full border border-transparent px-2.5 py-1 text-right text-[10px] font-extrabold transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:border-teal-200/60 group-data-[state=active]:bg-teal-100 group-data-[state=active]:text-teal-800">
          {totalRecords} {totalRecords === 1 ? "Record" : "Records"}
        </span>
      </TabsTrigger>

      {/* Tab 3: Health & Vaccinations Tracker */}
      <TabsTrigger
        value="health"
        className="group relative grid grid-cols-1 gap-y-2 whitespace-normal rounded-xl border border-transparent px-3 py-3 text-left transition-all duration-200 data-[state=active]:border-emerald-200/80 data-[state=active]:bg-white data-[state=active]:text-emerald-950 data-[state=active]:shadow-sm text-slate-600 hover:bg-white/60 hover:text-slate-900 cursor-pointer h-auto sm:px-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-9 rounded-xl flex items-center justify-center shrink-0 transition-all bg-emerald-100/80 text-emerald-800 group-data-[state=active]:bg-[#2D5A27] group-data-[state=active]:text-white shadow-2xs">
            <ShieldCheck className="size-4.5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="break-words text-sm font-black leading-tight tracking-tight">Health & Vaccinations</p>
            <p className="line-clamp-2 whitespace-normal break-words text-[10px] font-medium text-slate-400 group-data-[state=active]:text-emerald-700/80">
              Vaccination and health details
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit max-w-full justify-self-end items-center gap-1.5 whitespace-normal break-words rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-right text-[10px] font-extrabold text-emerald-800">
          <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
          {vaxRate}% vaccinated
        </span>
      </TabsTrigger>
    </TabsList>
  );
}
