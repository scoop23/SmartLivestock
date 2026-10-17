"use client";

import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
} from "@/components/ui/select";
import { TabsList,TabsTrigger } from "@/components/ui/tabs";
import { Layers,ShieldCheck,Tag } from "lucide-react";

interface InventoryTabsNavProps {
  speciesCount: number;
  totalRecords: number;
  vaxRate: number;
  activeTab?: "types" | "all" | "health";
  onTabChange?: (val: "types" | "all" | "health") => void;
}

export function InventoryTabsNav({
  speciesCount,
  totalRecords,
  vaxRate,
  activeTab = "types",
  onTabChange,
}: InventoryTabsNavProps) {
  return (
    <div className="w-full">
      {/* ── Mobile Adaptive Selector (< 640px) ── */}
      <div className="sm:hidden w-full pt-1 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
          Navigation View
        </div>
        <Select
          value={activeTab}
          onValueChange={(val) => onTabChange?.(val as "types" | "all" | "health")}
        >
          <SelectTrigger className="w-full h-13 rounded-2xl border border-slate-200/90 bg-white px-3.5 shadow-2xs font-semibold text-slate-800 focus:ring-emerald-500/20 focus:border-emerald-500">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {activeTab === "all" ? (
                <div className="size-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                  <Tag className="size-4" />
                </div>
              ) : activeTab === "health" ? (
                <div className="size-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                  <ShieldCheck className="size-4" />
                </div>
              ) : (
                <div className="size-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                  <Layers className="size-4" />
                </div>
              )}
              <span className="font-black text-sm text-slate-900 truncate">
                {activeTab === "all"
                  ? "All Livestock"
                  : activeTab === "health"
                  ? "Health & Vaccinations"
                  : "Livestock Types"}
              </span>
              <span className="ml-auto mr-1 inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-1 text-[11px] font-black text-emerald-800 border border-emerald-200/70">
                {activeTab === "health" && (
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                )}
                {activeTab === "all"
                  ? `${totalRecords} Records`
                  : activeTab === "health"
                  ? `${vaxRate}% Vax`
                  : `${speciesCount} Species`}
              </span>
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border border-slate-200 shadow-xl p-2 min-w-[var(--radix-select-trigger-width)]">
            <SelectItem value="types" className="rounded-xl py-2.5 px-3 pr-8 cursor-pointer">
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700 shrink-0">
                    <Layers className="size-3.5" />
                  </div>
                  <span className="font-bold text-sm text-slate-800">Livestock Types</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600">
                  {speciesCount} Species
                </span>
              </div>
            </SelectItem>
            <SelectItem value="all" className="rounded-xl py-2.5 px-3 pr-8 cursor-pointer">
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700 shrink-0">
                    <Tag className="size-3.5" />
                  </div>
                  <span className="font-bold text-sm text-slate-800">All Livestock</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black text-slate-600">
                  {totalRecords} Records
                </span>
              </div>
            </SelectItem>
            <SelectItem value="health" className="rounded-xl py-2.5 px-3 pr-8 cursor-pointer">
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-emerald-100/80 flex items-center justify-center text-emerald-700 shrink-0">
                    <ShieldCheck className="size-3.5" />
                  </div>
                  <span className="font-bold text-sm text-slate-800">Health & Vaccinations</span>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200/70">
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {vaxRate}%
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Desktop Tab Bar (≥ 640px) ── */}
      <div className="hidden sm:block w-full">
        <TabsList className="w-full grid grid-cols-3 gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs h-auto">
          {/* Tab 1: Livestock Types */}
          <TabsTrigger
            value="types"
            className="group relative flex items-center justify-between gap-2.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-emerald-950 data-[state=active]:shadow-xs data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/20 hover:bg-white/60 hover:text-slate-900 cursor-pointer h-auto"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-slate-200/70 text-slate-600 group-data-[state=active]:bg-emerald-600 group-data-[state=active]:text-white shadow-2xs">
                <Layers className="size-4" />
              </div>
              <span className="truncate">Livestock Types</span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-black transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800 group-data-[state=active]:border group-data-[state=active]:border-emerald-200/70">
              {speciesCount}
            </span>
          </TabsTrigger>

          {/* Tab 2: All Livestock */}
          <TabsTrigger
            value="all"
            className="group relative flex items-center justify-between gap-2.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-emerald-950 data-[state=active]:shadow-xs data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/20 hover:bg-white/60 hover:text-slate-900 cursor-pointer h-auto"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-slate-200/70 text-slate-600 group-data-[state=active]:bg-emerald-600 group-data-[state=active]:text-white shadow-2xs">
                <Tag className="size-4" />
              </div>
              <span className="truncate">All Livestock</span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-black transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800 group-data-[state=active]:border group-data-[state=active]:border-emerald-200/70">
              {totalRecords}
            </span>
          </TabsTrigger>

          {/* Tab 3: Health & Vaccinations */}
          <TabsTrigger
            value="health"
            className="group relative flex items-center justify-between gap-2.5 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-emerald-950 data-[state=active]:shadow-xs data-[state=active]:ring-1 data-[state=active]:ring-emerald-500/20 hover:bg-white/60 hover:text-slate-900 cursor-pointer h-auto"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors bg-slate-200/70 text-slate-600 group-data-[state=active]:bg-emerald-600 group-data-[state=active]:text-white shadow-2xs">
                <ShieldCheck className="size-4" />
              </div>
              <span className="truncate">Health & Vax</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black transition-colors bg-slate-200/70 text-slate-700 group-data-[state=active]:bg-emerald-100 group-data-[state=active]:text-emerald-800 group-data-[state=active]:border group-data-[state=active]:border-emerald-200/70">
              <span className="size-1.5 rounded-full bg-emerald-600 group-data-[state=active]:animate-pulse" />
              {vaxRate}%
            </span>
          </TabsTrigger>
        </TabsList>
      </div>
    </div>
  );
}
