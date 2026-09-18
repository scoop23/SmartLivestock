"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Download,
  MapPin,
  ChevronDown,
  LayoutGrid,
  List,
  RotateCcw,
  Sparkles,
  Layers,
  Milk,
  TrendingUp,
  AlertTriangle,
  Skull,
  Scale,
  FileSpreadsheet,
} from "lucide-react";
import { DataTab, PADRE_GARCIA_BARANGAYS } from "./data-overview-types";

interface DataOverviewToolbarProps {
  activeTab: DataTab;
  onTabChange: (tab: DataTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterBarangay: string;
  onBarangayChange: (b: string) => void;
  filterSpecie: string;
  onSpecieChange: (s: string) => void;
  filterStatus: string;
  onStatusChange: (s: string) => void;
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  onExportCsv: () => void;
  onResetFilters: () => void;
  counts: Record<DataTab, number>;
}

const TAB_CONFIGS: {
  id: DataTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "overall", label: "Overall Data", icon: Sparkles },
  { id: "livestock", label: "Livestock", icon: Layers },
  { id: "production", label: "Milk & Yields", icon: Milk },
  { id: "sales", label: "Auction & Trade", icon: TrendingUp },
  { id: "disease", label: "Disease Reports", icon: AlertTriangle },
  { id: "mortality", label: "Mortality", icon: Skull },
  { id: "slaughter", label: "Slaughterhouse", icon: Scale },
  { id: "census", label: "Barangay Census", icon: FileSpreadsheet },
];

export function DataOverviewToolbar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filterBarangay,
  onBarangayChange,
  filterSpecie,
  onSpecieChange,
  filterStatus,
  onStatusChange,
  viewMode,
  onViewModeChange,
  onExportCsv,
  onResetFilters,
  counts,
}: DataOverviewToolbarProps) {
  const isFiltered =
    searchQuery !== "" ||
    filterBarangay !== "all" ||
    filterSpecie !== "all" ||
    filterStatus !== "all";

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl shadow-xs border border-slate-200/80 space-y-2.5">
      {/* Top Bar: Tabs & Action Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        {/* Domain Tabs List */}
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <Tabs
            value={activeTab}
            onValueChange={(v) => onTabChange(v as DataTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-slate-100/80 p-0.5 rounded-xl h-auto flex flex-wrap sm:flex-nowrap gap-0.5 border border-slate-200/60">
              {TAB_CONFIGS.map(({ id, label, icon: IconComponent }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 shrink-0"
                >
                  <IconComponent className="w-3.5 h-3.5 shrink-0 text-slate-400 group-data-[state=active]:text-emerald-700" />
                  <span>{label}</span>
                  {id !== "overall" && (
                    <span className="ml-0.5 text-[10px] font-black px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700">
                      {counts[id] || 0}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Right Actions: View Switcher & Export */}
        <div className="flex items-center gap-2 shrink-0 self-end xl:self-auto">
          {/* Table / Card View Toggle */}
          {activeTab !== "overall" && (
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={`p-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                className={`p-1.5 rounded-md text-xs font-bold transition-all ${
                  viewMode === "cards"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Export CSV Button */}
          <Button
            onClick={onExportCsv}
            className="bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold px-3.5 py-1.5 h-8 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer text-xs shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Bottom Bar: Search & Multi-Filters */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between pt-2.5 border-t border-slate-100">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={14}
          />
          <Input
            type="text"
            placeholder={
              activeTab === "overall"
                ? "Search across all barangays, farmers, or metrics..."
                : `Search in ${activeTab} by ID, farmer, tag, or keyword...`
            }
            className="w-full pl-9 pr-3 py-1.5 h-8 bg-slate-50/80 border-slate-200/80 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-xs font-medium"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Barangay Filter */}
          <div className="relative min-w-[150px] flex-1 sm:flex-initial">
            <MapPin
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={13}
            />
            <select
              className="w-full pl-7 pr-7 py-1.5 h-8 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer appearance-none"
              value={filterBarangay}
              onChange={(e) => onBarangayChange(e.target.value)}
            >
              {PADRE_GARCIA_BARANGAYS.map((b) => (
                <option key={b} value={b === "All Barangays" ? "all" : b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={13}
            />
          </div>

          {/* Specie Filter (if applicable) */}
          {activeTab !== "overall" && activeTab !== "census" && (
            <div className="relative min-w-[120px] flex-1 sm:flex-initial">
              <select
                className="w-full px-2.5 py-1.5 h-8 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer"
                value={filterSpecie}
                onChange={(e) => onSpecieChange(e.target.value)}
              >
                <option value="all">All Species</option>
                <option value="Cattle">Cattle</option>
                <option value="Carabao">Carabao</option>
                <option value="Swine">Swine</option>
                <option value="Goat">Goat</option>
                <option value="Poultry">Poultry</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          {activeTab !== "overall" && (
            <div className="relative min-w-[120px] flex-1 sm:flex-initial">
              <select
                className="w-full px-2.5 py-1.5 h-8 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer"
                value={filterStatus}
                onChange={(e) => onStatusChange(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Healthy">Healthy / Passed</option>
                <option value="Vaccinated">Vaccinated</option>
                <option value="Under Treatment">Under Treatment</option>
                <option value="Quarantined">Quarantined</option>
                <option value="Certified">Certified</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          )}

          {/* Reset Filters */}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg h-8 px-2 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
