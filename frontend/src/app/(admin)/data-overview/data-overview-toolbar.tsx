"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Boxes,
  Milk,
  TrendingUp,
  AlertTriangle,
  Skull,
  Scale,
  FileSpreadsheet,
  X,
  Filter,
  SlidersHorizontal,
  ChevronRight,
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

// 4 Strategic Domain Pillars
type DomainPillarId = "overview" | "registry" | "commerce" | "biosecurity";

interface DomainPillar {
  id: DomainPillarId;
  label: string;
  shortLabel: string;
  emoji: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultTab: DataTab;
  activeColorClass: string;
  tabs: {
    id: DataTab;
    label: string;
    emoji: string;
    icon: React.ComponentType<{ className?: string }>;
    activeColorClass: string;
  }[];
}

const DOMAIN_PILLARS: DomainPillar[] = [
  {
    id: "overview",
    label: "Executive Overview",
    shortLabel: "Overview",
    emoji: "📊",
    icon: Sparkles,
    defaultTab: "overall",
    activeColorClass: "bg-[#2D5A27] text-white border-[#2D5A27] shadow-sm ring-2 ring-[#2D5A27]/25",
    tabs: [
      {
        id: "overall",
        label: "Master Matrix",
        emoji: "📊",
        icon: Sparkles,
        activeColorClass: "bg-[#2D5A27] text-white shadow-xs",
      },
    ],
  },
  {
    id: "registry",
    label: "Herd Registry",
    shortLabel: "Herd Registry",
    emoji: "🐄",
    icon: Layers,
    defaultTab: "livestock",
    activeColorClass: "bg-[#205225] text-white border-[#205225] shadow-sm ring-2 ring-[#205225]/25",
    tabs: [
      {
        id: "livestock",
        label: "Individual Animals",
        emoji: "🏷️",
        icon: Layers,
        activeColorClass: "bg-emerald-700 text-white shadow-xs",
      },
      {
        id: "batches",
        label: "Herds",
        emoji: "📦",
        icon: Boxes,
        activeColorClass: "bg-[#2D5A27] text-white shadow-xs",
      },
    ],
  },
  {
    id: "commerce",
    label: "Production & Trade",
    shortLabel: "Production",
    emoji: "📈",
    icon: TrendingUp,
    defaultTab: "production",
    activeColorClass: "bg-[#184860] text-white border-[#184860] shadow-sm ring-2 ring-[#184860]/25",
    tabs: [
      {
        id: "production",
        label: "Dairy & Milk Yields",
        emoji: "🥛",
        icon: Milk,
        activeColorClass: "bg-sky-700 text-white shadow-xs",
      },
      {
        id: "sales",
        label: "Auction & Trade",
        emoji: "💰",
        icon: TrendingUp,
        activeColorClass: "bg-amber-700 text-white shadow-xs",
      },
      {
        id: "slaughter",
        label: "Slaughterhouse",
        emoji: "⚖️",
        icon: Scale,
        activeColorClass: "bg-indigo-700 text-white shadow-xs",
      },
    ],
  },
  {
    id: "biosecurity",
    label: "Surveillance & Census",
    shortLabel: "Biosecurity",
    emoji: "🛡️",
    icon: AlertTriangle,
    defaultTab: "disease",
    activeColorClass: "bg-[#802626] text-white border-[#802626] shadow-sm ring-2 ring-[#802626]/25",
    tabs: [
      {
        id: "disease",
        label: "Disease Surveillance",
        emoji: "⚠️",
        icon: AlertTriangle,
        activeColorClass: "bg-rose-700 text-white shadow-xs",
      },
      {
        id: "mortality",
        label: "Mortality Audits",
        emoji: "☠️",
        icon: Skull,
        activeColorClass: "bg-rose-800 text-white shadow-xs",
      },
      {
        id: "census",
        label: "Barangay Census",
        emoji: "📋",
        icon: FileSpreadsheet,
        activeColorClass: "bg-teal-700 text-white shadow-xs",
      },
    ],
  },
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
  // Find current pillar from activeTab
  const currentPillar =
    DOMAIN_PILLARS.find((pillar) =>
      pillar.tabs.some((t) => t.id === activeTab)
    ) || DOMAIN_PILLARS[0];

  // Filter drawer collapsible state (auto-expanded if any filter is active)
  const isFiltered =
    searchQuery !== "" ||
    filterBarangay !== "all" ||
    filterSpecie !== "all" ||
    filterStatus !== "all";

  const [filtersOpen, setFiltersOpen] = useState(isFiltered);

  // Active filters count
  const activeFiltersCount =
    (filterBarangay !== "all" ? 1 : 0) +
    (filterSpecie !== "all" ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (searchQuery.trim() !== "" ? 1 : 0);

  const handlePillarClick = (pillar: DomainPillar) => {
    // If the active tab is already in this pillar, stay on it. Otherwise switch to default tab of this pillar
    const isAlreadyInPillar = pillar.tabs.some((t) => t.id === activeTab);
    if (!isAlreadyInPillar) {
      onTabChange(pillar.defaultTab);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xs border border-slate-200/90 transition-all overflow-hidden w-full max-w-full min-w-0">
      {/* ── Top Row: 4 Domain Pillars Navigation & Quick Actions ── */}
      <div className="p-3 sm:p-3.5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/60 via-white to-slate-50/40 w-full max-w-full min-w-0">
        {/* Domain Pillars (Primary Hierarchy) - Vertical full-width on Mobile, Horizontal on Desktop */}
        <div className="w-full xl:w-auto">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap lg:flex-nowrap sm:items-center gap-2 w-full">
            {DOMAIN_PILLARS.map((pillar) => {
              const isPillarActive = currentPillar.id === pillar.id;

              // Sum counts for pillar tabs
              const pillarCount = pillar.tabs.reduce(
                (acc, t) => acc + (t.id === "overall" ? 0 : counts[t.id] || 0),
                0
              );

              return (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => handlePillarClick(pillar)}
                  className={`flex items-center justify-between sm:justify-start gap-2.5 px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer w-full sm:w-auto border select-none ${
                    isPillarActive
                      ? pillar.activeColorClass
                      : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm shrink-0">{pillar.emoji}</span>
                    <span>{pillar.label}</span>
                  </div>
                  {pillarCount > 0 && (
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full font-mono transition-colors ${
                        isPillarActive
                          ? "bg-white/25 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {pillarCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Controls: View Switcher & Export */}
        <div className="flex items-center justify-between xl:justify-end gap-2 shrink-0 w-full xl:w-auto pt-1 xl:pt-0 border-t xl:border-t-0 border-slate-100">
          {/* Table / Card View Toggle */}
          {activeTab !== "overall" && (
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/60"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                className={`p-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-slate-900 shadow-2xs ring-1 ring-slate-200/60"
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
            className="bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold px-3.5 py-1.5 h-8.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer text-xs shrink-0 active:scale-98 ml-auto xl:ml-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* ── Sub-Navigation Pill Strip (Secondary Hierarchy) ── */}
      {currentPillar.tabs.length > 1 && (
        <div className="w-full px-3 sm:px-4 py-2.5 sm:py-2 bg-slate-50/70 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 shrink-0 flex items-center gap-1">
              <span>{currentPillar.shortLabel} Views:</span>
              <ChevronRight className="size-3 text-slate-400" />
            </span>

            <div className="grid grid-cols-1 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
              {currentPillar.tabs.map((tab) => {
                const isTabActive = activeTab === tab.id;
                const count = counts[tab.id] || 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={`flex items-center justify-between sm:justify-start gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer border select-none w-full sm:w-auto ${
                      isTabActive
                        ? `${tab.activeColorClass} border-transparent font-black shadow-xs`
                        : "bg-white text-slate-600 border-slate-200/70 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm">{tab.emoji}</span>
                      <span>{tab.label}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-mono px-1.5 py-0.1 ml-0.5 border-0 ${
                        isTabActive
                          ? "bg-white/25 text-white font-black"
                          : "bg-slate-200/70 text-slate-700"
                      }`}
                    >
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Search & Filter Control Bar ── */}
      <div className="p-3 sm:p-3.5 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Universal Search Bar */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <Input
              type="text"
              placeholder={
                activeTab === "overall"
                  ? "Search across all barangays, raisers, or metrics..."
                  : activeTab === "batches"
                  ? "Search batches by name, code, housing pen, feed type, or raiser..."
                  : `Search ${activeTab} by ID, raiser, tag, or keyword...`
              }
              className="w-full pl-9 pr-8 py-1.5 h-8.5 bg-slate-50/80 border-slate-200/80 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-xs font-medium placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Drawer Toggle & Reset Button */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`h-8.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                filtersOpen || activeFiltersCount > 0
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-200"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="size-3.5 text-emerald-700" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="size-4 rounded-full bg-[#2D5A27] text-white text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown
                className={`size-3 text-slate-400 transition-transform ${
                  filtersOpen ? "rotate-180" : ""
                }`}
              />
            </Button>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg h-8.5 px-2.5 flex items-center gap-1.5 cursor-pointer border border-dashed border-slate-200"
                title="Reset all active filters"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── Collapsible Multi-Filter Panel ── */}
        {filtersOpen && (
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 animate-in fade-in-50 duration-200">
            {/* Barangay Filter */}
            <div className="relative w-full sm:w-auto sm:min-w-[160px] sm:flex-initial">
              <MapPin
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={13}
              />
              <select
                className="w-full pl-7 pr-7 py-2 sm:py-1.5 h-9 sm:h-8.5 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer appearance-none shadow-2xs"
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

            {/* Specie Filter (Livestock, Batches, Sales, Disease, Slaughter) */}
            {activeTab !== "overall" &&
              activeTab !== "census" &&
              activeTab !== "production" && (
                <div className="relative w-full sm:w-auto sm:min-w-[130px] sm:flex-initial">
                  <select
                    className="w-full px-2.5 py-2 sm:py-1.5 h-9 sm:h-8.5 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer shadow-2xs appearance-none pr-7"
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
                  <ChevronDown
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    size={13}
                  />
                </div>
              )}

            {/* Status Filter */}
            {activeTab !== "overall" && (
              <div className="relative w-full sm:w-auto sm:min-w-[150px] sm:flex-initial">
                <select
                  className="w-full px-2.5 py-2 sm:py-1.5 h-9 sm:h-8.5 bg-slate-50/80 border border-slate-200/80 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all cursor-pointer shadow-2xs appearance-none pr-7"
                  value={filterStatus}
                  onChange={(e) => onStatusChange(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="APPROVED">MAO Approved</option>
                  <option value="VERIFIED">SIBAT Verified</option>
                  <option value="PENDING">Awaiting SIBAT</option>
                  <option value="SUBJECT_TO_REVISION">Revision Required</option>
                  <option value="Healthy">Healthy / Passed</option>
                  <option value="Under Treatment">Under Treatment</option>
                  <option value="Quarantined">Quarantined</option>
                  <option value="Completed">Completed</option>
                </select>
                <ChevronDown
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  size={13}
                />
              </div>
            )}

            {/* Active Filter Badges */}
            {(filterBarangay !== "all" || filterSpecie !== "all" || filterStatus !== "all") && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0 w-full sm:w-auto">
                {filterBarangay !== "all" && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold px-2 py-1 flex items-center gap-1 cursor-pointer hover:bg-emerald-100"
                    onClick={() => onBarangayChange("all")}
                    title="Click to remove barangay filter"
                  >
                    <span>Brgy: {filterBarangay}</span>
                    <X className="size-3" />
                  </Badge>
                )}

                {filterSpecie !== "all" && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold px-2 py-1 flex items-center gap-1 cursor-pointer hover:bg-emerald-100"
                    onClick={() => onSpecieChange("all")}
                    title="Click to remove specie filter"
                  >
                    <span>Specie: {filterSpecie}</span>
                    <X className="size-3" />
                  </Badge>
                )}

                {filterStatus !== "all" && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold px-2 py-1 flex items-center gap-1 cursor-pointer hover:bg-emerald-100"
                    onClick={() => onStatusChange("all")}
                    title="Click to remove status filter"
                  >
                    <span>Status: {filterStatus}</span>
                    <X className="size-3" />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
