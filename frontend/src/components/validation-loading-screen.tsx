"use client";

import React from "react";
import {
  ShieldCheck,
  FileSpreadsheet,
  Milk,
  Tag,
  Activity,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export interface SyncStreamItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  loaded: boolean;
}

export interface ValidationLoadingScreenProps {
  title?: string;
  subtitle?: string;
  badgeLabel?: string;
  authorityText?: string;
  icon?: React.ReactNode;
  items?: SyncStreamItem[];
  // Convenience flags for standard validation ledger sync
  censusLoaded?: boolean;
  productionLoaded?: boolean;
  inventoryLoaded?: boolean;
  incidentLoaded?: boolean;
}

export function ValidationLoadingScreen({
  title = "Synchronizing Municipal Validation Ledger",
  subtitle = "Retrieving official barangay census records, farmer production yields, individual livestock passports, and health surveillance reports...",
  badgeLabel = "Secure Ledger Sync",
  authorityText = "Municipal Agriculture Office • Padre Garcia, Batangas",
  icon,
  items,
  censusLoaded = false,
  productionLoaded = false,
  inventoryLoaded = false,
  incidentLoaded = false,
}: ValidationLoadingScreenProps) {
  // Use custom items if supplied, else build the default ledger streams
  const streamItems: SyncStreamItem[] = items ?? [
    {
      id: "census",
      label: "Barangay Census",
      sublabel: "Household livestock surveys",
      icon: <FileSpreadsheet className="size-4 shrink-0" />,
      loaded: censusLoaded,
    },
    {
      id: "production",
      label: "Production Yields",
      sublabel: "Milk, eggs & periodic logs",
      icon: <Milk className="size-4 shrink-0" />,
      loaded: productionLoaded,
    },
    {
      id: "inventory",
      label: "Livestock Inventory",
      sublabel: "Individual tags & herd pens",
      icon: <Tag className="size-4 shrink-0" />,
      loaded: inventoryLoaded,
    },
    {
      id: "incidents",
      label: "Field Declarations",
      sublabel: "Health outbreaks & disposals",
      icon: <Activity className="size-4 shrink-0" />,
      loaded: incidentLoaded,
    },
  ];

  const loadedCount = streamItems.filter((i) => i.loaded).length;
  const progressPercent = streamItems.length > 0 
    ? Math.round((loadedCount / streamItems.length) * 100) 
    : 0;

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[58vh] px-3 sm:px-4 py-4 sm:py-8 animate-in fade-in-50 duration-300">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-md p-5 sm:p-8 md:p-9 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 text-center space-y-4 sm:space-y-6 relative overflow-hidden">
        {/* Ambient Top Accent Gradient */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        {/* Central Animated Beacon */}
        <div className="relative mx-auto size-16 sm:size-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-100 via-emerald-50 to-emerald-200/70 border border-emerald-200 flex items-center justify-center shadow-inner">
          {icon ? (
            icon
          ) : (
            <ShieldCheck className="size-8 sm:size-10 text-[#2D5A27] animate-pulse" />
          )}
          <div className="absolute -bottom-1 -right-1 size-6 sm:size-7 rounded-full bg-[#2D5A27] text-white flex items-center justify-center shadow-md ring-2 ring-white">
            <Loader2 className="size-3.5 sm:size-4 animate-spin text-white" />
          </div>
        </div>

        {/* Header Titles */}
        <div className="space-y-1 sm:space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-black uppercase tracking-wider mb-0.5">
            <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>
              {badgeLabel} ({progressPercent}%)
            </span>
          </div>
          <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {/* Mobile-Friendly Stream Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full text-left pt-1">
          {streamItems.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-300 flex items-center justify-between gap-2.5 ${
                item.loaded
                  ? "bg-emerald-50/80 border-emerald-200/90 text-emerald-950 shadow-2xs"
                  : "bg-slate-50/90 border-slate-200/70 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    item.loaded
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {item.icon ?? <Tag className="size-4 shrink-0" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black truncate">{item.label}</p>
                  {item.sublabel && (
                    <p className="text-[10px] text-slate-400 truncate hidden xs:block sm:block">
                      {item.sublabel}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {item.loaded ? (
                  <span className="size-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center animate-in zoom-in-50 duration-200">
                    <CheckCircle2 className="size-3.5" />
                  </span>
                ) : (
                  <span className="size-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Loader2 className="size-3 animate-spin text-slate-400" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Live Authority Footer */}
        {authorityText && (
          <div className="flex items-center justify-center gap-2 text-[10px] sm:text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider pt-1 sm:pt-2 border-t border-slate-100">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>{authorityText}</span>
          </div>
        )}
      </div>
    </div>
  );
}
