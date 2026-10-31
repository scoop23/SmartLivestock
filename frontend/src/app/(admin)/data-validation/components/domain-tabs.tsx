"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Milk,
  Scissors,
  Tag,
} from "lucide-react";
import { VALIDATION_DOMAINS, ValidationDomain } from "../validation-analytics";

const DOMAIN_CARD_CONFIG: Record<
  ValidationDomain,
  {
    title: string;
    subtitle: string;
    activeIconBg: string;
    activeBorder: string;
  }
> = {
  census: {
    title: "Quarterly Census",
    subtitle: "Barangay Livestock Roster",
    activeIconBg: "bg-emerald-700 text-white shadow-emerald-700/20",
    activeBorder: "data-[state=active]:border-emerald-300 data-[state=active]:ring-1 data-[state=active]:ring-emerald-300/40",
  },
  production: {
    title: "Production Yields",
    subtitle: "Livestock Production Records",
    activeIconBg: "bg-amber-600 text-white shadow-amber-600/20",
    activeBorder: "data-[state=active]:border-amber-300 data-[state=active]:ring-1 data-[state=active]:ring-amber-300/40",
  },
  inventory: {
    title: "Livestock Inventory",
    subtitle: "Individual Tags & Herd Pens",
    activeIconBg: "bg-sky-700 text-white shadow-sky-700/20",
    activeBorder: "data-[state=active]:border-sky-300 data-[state=active]:ring-1 data-[state=active]:ring-sky-300/40",
  },
  incidents: {
    title: "Field Declarations",
    subtitle: "Disease Outbreaks & Mortalities",
    activeIconBg: "bg-rose-700 text-white shadow-rose-700/20",
    activeBorder: "data-[state=active]:border-rose-300 data-[state=active]:ring-1 data-[state=active]:ring-rose-300/40",
  },
};

type DomainCounts = Record<ValidationDomain, number>;

interface DomainTabsProps {
  activeTab: ValidationDomain | "slaughter";
  onTabChange: (tab: ValidationDomain | "slaughter") => void;
  onTabClick?: (tab: ValidationDomain | "slaughter") => void;
  activeDomain: ValidationDomain;
  pendingCounts: DomainCounts;
  verifiedCounts: DomainCounts;
  totalCounts: DomainCounts;
  isOverviewCollapsed?: boolean;
  onToggleOverview?: () => void;
}

export function DomainTabs({
  activeTab,
  onTabChange,
  onTabClick,
  activeDomain,
  pendingCounts,
  verifiedCounts,
  totalCounts,
  isOverviewCollapsed = false,
  onToggleOverview,
}: DomainTabsProps) {
  return (
    <div className="w-full space-y-2.5">
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          const tab = val as ValidationDomain | "slaughter";
          onTabChange(tab);
        }}
        className="w-full space-y-2.5"
      >
        <TabsList
          className={`w-full grid transition-all duration-200 ${
            isOverviewCollapsed
              ? "grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/90 shadow-2xs h-auto"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-2 bg-slate-100/90 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs h-auto"
          }`}
        >
          {VALIDATION_DOMAINS.filter((domain) => domain.id !== "production").map((domain) => {
            const config = DOMAIN_CARD_CONFIG[domain.id];
            const pendingCount = pendingCounts[domain.id];
            const verifiedCount = verifiedCounts[domain.id];
            const totalCount = totalCounts[domain.id];
            const isActive = activeDomain === domain.id && activeTab !== "slaughter";

            return (
              <TabsTrigger
                key={domain.id}
                value={domain.id}
                onClick={() => onTabClick?.(domain.id)}
                className={`group relative flex transition-all duration-200 text-left border border-slate-200/70 bg-white/70 hover:bg-white hover:border-slate-300 data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer h-auto ${config.activeBorder} ${
                  isOverviewCollapsed
                    ? "flex-row items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl min-h-[46px]"
                    : "flex-col items-stretch gap-2.5 p-3 sm:p-3.5 rounded-2xl"
                }`}
              >
                <div className={`flex items-center min-w-0 ${isOverviewCollapsed ? "gap-2 sm:gap-2.5 flex-1" : "gap-3"}`}>
                  <div
                    className={`rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs ${
                      isOverviewCollapsed ? "size-7 sm:size-8" : "size-10"
                    } ${
                      isActive
                        ? `${config.activeIconBg} shadow-xs`
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800"
                    }`}
                  >
                    {domain.id === "census" && <FileSpreadsheet className={isOverviewCollapsed ? "size-3.5 sm:size-4" : "size-4.5"} />}
                    {domain.id === "production" && <Milk className={isOverviewCollapsed ? "size-3.5 sm:size-4" : "size-4.5"} />}
                    {domain.id === "inventory" && <Tag className={isOverviewCollapsed ? "size-3.5 sm:size-4" : "size-4.5"} />}
                    {domain.id === "incidents" && <Activity className={isOverviewCollapsed ? "size-3.5 sm:size-4" : "size-4.5"} />}
                  </div>

                  <div className="text-left min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-black tracking-tight leading-tight text-slate-900 truncate">
                      {config.title}
                    </p>
                    {!isOverviewCollapsed && (
                      <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-slate-500 whitespace-normal break-words mt-0.5">
                        {config.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className={`flex items-center shrink-0 ${
                    isOverviewCollapsed
                      ? "gap-1"
                      : "flex-row items-center justify-between gap-1 flex-wrap w-full"
                  }`}
                >
                  {pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300/80 font-mono shadow-2xs">
                      <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                      <span>{pendingCount}</span>
                      <span className={isOverviewCollapsed ? "hidden xl:inline" : "inline"}>
                        Pending
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
                      {totalCount} {isOverviewCollapsed ? "" : "Total"}
                    </span>
                  )}

                  {!isOverviewCollapsed && verifiedCount > 0 && (
                    <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded-md font-mono">
                      {verifiedCount} Verified
                    </span>
                  )}
                </div>
              </TabsTrigger>
            );
          })}
          <TabsTrigger
            value="slaughter"
            onClick={() => onTabClick?.("slaughter")}
            className={`group relative flex transition-all duration-200 text-left border border-slate-200/70 bg-white/70 hover:bg-white hover:border-slate-300 data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer h-auto data-[state=active]:border-slate-300 data-[state=active]:ring-1 data-[state=active]:ring-slate-300/50 ${
              isOverviewCollapsed
                ? "flex-row items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl min-h-[46px]"
                : "flex-col items-stretch gap-2.5 p-3 sm:p-3.5 rounded-2xl"
            }`}
          >
            <div className={`flex items-center min-w-0 ${isOverviewCollapsed ? "gap-2 sm:gap-2.5 flex-1" : "gap-3"}`}>
              <div
                className={`rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs ${
                  isOverviewCollapsed ? "size-7 sm:size-8" : "size-10"
                } ${
                  activeTab === "slaughter"
                    ? "bg-slate-800 text-white shadow-slate-800/20 shadow-xs"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800"
                }`}
              >
                <Scissors className={isOverviewCollapsed ? "size-3.5 sm:size-4" : "size-4.5"} />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-black tracking-tight leading-tight text-slate-900 truncate">
                  Slaughter Review
                </p>
                {!isOverviewCollapsed && (
                  <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-slate-500 whitespace-normal break-words mt-0.5">
                    Farmer &amp; Facility Reports
                  </p>
                )}
              </div>
            </div>
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono shrink-0">
              {isOverviewCollapsed ? "MAO" : "MAO Queue"}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Contextual Active Queue Telemetry Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`size-2 rounded-full ${
              activeTab === "slaughter" ? "bg-slate-800" : "bg-emerald-500"
            } animate-pulse shrink-0`}
          />
          <span className="font-black text-slate-900 truncate">
            {activeTab === "slaughter"
              ? "Slaughterhouse Review Queue"
              : `${DOMAIN_CARD_CONFIG[activeDomain].title} Validation Queue`}
          </span>
          <span className="text-slate-300 hidden sm:inline">&bull;</span>
          <span className="text-slate-500 font-medium truncate hidden sm:inline">
            {activeTab === "slaughter"
              ? "Farmer declarations and facility slaughter logs awaiting MAO certification"
              : VALIDATION_DOMAINS.find((d) => d.id === activeDomain)?.description}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {activeTab !== "slaughter" && (
            <>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                Queue:
              </span>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] font-mono font-bold">
                {totalCounts[activeDomain]} Total Records
              </Badge>
              {pendingCounts[activeDomain] > 0 && (
                <Badge className="bg-amber-100 text-amber-900 border-amber-200 text-[10px] font-mono font-bold">
                  {pendingCounts[activeDomain]} Awaiting SIBAT
                </Badge>
              )}
              {verifiedCounts[activeDomain] > 0 && (
                <Badge className="bg-sky-100 text-sky-900 border-sky-200 text-[10px] font-mono font-bold">
                  {verifiedCounts[activeDomain]} Ready for MAO
                </Badge>
              )}
            </>
          )}

          {onToggleOverview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleOverview}
              className="h-7 px-2.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 gap-1.5 rounded-xl hover:bg-slate-100 border border-slate-200/80 cursor-pointer shadow-2xs ml-auto sm:ml-1"
              title={isOverviewCollapsed ? "Expand KPIs and Municipal Herd" : "Collapse KPIs and Municipal Herd"}
            >
              {isOverviewCollapsed ? (
                <>
                  <ChevronDown className="size-3.5 text-emerald-600" />
                  <span>Show KPIs & Herds</span>
                </>
              ) : (
                <>
                  <ChevronUp className="size-3.5 text-slate-500" />
                  <span>Collapse Overview</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
