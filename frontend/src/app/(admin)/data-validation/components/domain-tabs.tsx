"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, FileSpreadsheet, Milk, Scissors, Tag } from "lucide-react";
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
  activeDomain: ValidationDomain;
  pendingCounts: DomainCounts;
  verifiedCounts: DomainCounts;
  totalCounts: DomainCounts;
}

export function DomainTabs({
  activeTab,
  onTabChange,
  activeDomain,
  pendingCounts,
  verifiedCounts,
  totalCounts,
}: DomainTabsProps) {
  return (
    <div className="w-full space-y-2.5">
      <Tabs
        value={activeTab}
        onValueChange={(val) => onTabChange(val as ValidationDomain | "slaughter")}
        className="w-full space-y-2.5"
      >
        <TabsList className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5 gap-2.5 p-2 bg-slate-100/90 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs h-auto">
          {VALIDATION_DOMAINS.map((domain) => {
            const config = DOMAIN_CARD_CONFIG[domain.id];
            const pendingCount = pendingCounts[domain.id];
            const verifiedCount = verifiedCounts[domain.id];
            const totalCount = totalCounts[domain.id];
            const isActive = activeDomain === domain.id;

            return (
              <TabsTrigger
                key={domain.id}
                value={domain.id}
                className={`group relative flex flex-col items-stretch gap-2.5 p-3 sm:p-3.5 rounded-2xl transition-all duration-200 text-left border border-slate-200/70 bg-white/70 hover:bg-white hover:border-slate-300 data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer h-auto ${config.activeBorder}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`size-10 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs ${
                      isActive
                        ? `${config.activeIconBg} shadow-xs`
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800"
                    }`}
                  >
                    {domain.id === "census" && <FileSpreadsheet className="size-4.5" />}
                    {domain.id === "production" && <Milk className="size-4.5" />}
                    {domain.id === "inventory" && <Tag className="size-4.5" />}
                    {domain.id === "incidents" && <Activity className="size-4.5" />}
                  </div>

                  <div className="text-left min-w-0">
                    <p className="text-xs sm:text-sm font-black tracking-tight leading-tight text-slate-900 whitespace-normal break-words">
                      {config.title}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-slate-500 whitespace-normal break-words mt-0.5">
                      {config.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between gap-1 flex-wrap">
                  {pendingCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300/80 font-mono shadow-2xs">
                      <span className="size-1.5 rounded-full bg-amber-600 animate-pulse" />
                      {pendingCount} Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
                      {totalCount} Total
                    </span>
                  )}

                  {verifiedCount > 0 && (
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
            className="group relative flex flex-col items-stretch gap-2.5 p-3 sm:p-3.5 rounded-2xl transition-all duration-200 text-left border border-slate-200/70 bg-white/70 hover:bg-white hover:border-slate-300 data-[state=active]:bg-white data-[state=active]:shadow-sm cursor-pointer h-auto data-[state=active]:border-slate-300 data-[state=active]:ring-1 data-[state=active]:ring-slate-300/50"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`size-10 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-200 shadow-2xs ${activeTab === "slaughter" ? "bg-slate-800 text-white shadow-slate-800/20 shadow-xs" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800"}`}>
                <Scissors className="size-4.5" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-xs sm:text-sm font-black tracking-tight leading-tight text-slate-900 whitespace-normal break-words">Slaughter Review</p>
                <p className="text-[10px] font-medium text-slate-400 group-data-[state=active]:text-slate-500 whitespace-normal break-words mt-0.5">Facility Totals & Weights</p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono shrink-0">MAO Queue</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Contextual Active Queue Telemetry Strip */}
      {activeTab !== "slaughter" ? <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-black text-slate-900 truncate">
            {DOMAIN_CARD_CONFIG[activeDomain].title} Validation Queue
          </span>
          <span className="text-slate-300 hidden sm:inline">&bull;</span>
          <span className="text-slate-500 font-medium truncate hidden sm:inline">
            {VALIDATION_DOMAINS.find((d) => d.id === activeDomain)?.description}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Queue Telemetry:
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
        </div>
      </div> : null}
    </div>
  );
}