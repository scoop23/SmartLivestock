"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  LayoutGrid,
  FileSpreadsheet,
  Cpu,
  Workflow,
  ChevronRight,
} from "lucide-react";

export interface AnalyticsNavProps {
  currentSection?: "overview" | "descriptive" | "predictive" | "prescriptive" | "surveillance" | "records" | "forecasts" | "decision";
  className?: string;
}

export function AnalyticsNav({ currentSection, className = "" }: AnalyticsNavProps) {
  const pathname = usePathname();

  const primaryTabs = [
    {
      id: "overview",
      href: "/analysis",
      label: "Overview",
      shortLabel: "Overview",
      icon: LayoutGrid,
      isActive: pathname === "/analysis",
    },
    {
      id: "descriptive",
      href: "/analysis/descriptive",
      label: "Descriptive Analytics",
      shortLabel: "Descriptive",
      badge: "What Happened",
      icon: BarChart3,
      isActive: pathname === "/analysis/descriptive" || pathname === "/analysis/municipal-records",
    },
    {
      id: "predictive",
      href: "/analysis/predictive",
      label: "Predictive Analytics",
      shortLabel: "Predictive",
      badge: "Forecasts",
      icon: TrendingUp,
      isActive: pathname === "/analysis/predictive" || pathname === "/analysis/evaluated-forecasts",
    },
    {
      id: "prescriptive",
      href: "/analysis/prescriptive",
      label: "Prescriptive Analytics",
      shortLabel: "Prescriptive",
      badge: "Decisions",
      icon: Lightbulb,
      isActive: pathname === "/analysis/prescriptive" || pathname === "/analysis/decision-support",
    },
    {
      id: "surveillance",
      href: "/analysis/surveillance-health",
      label: "Surveillance & Health",
      shortLabel: "Surveillance",
      badge: "Early Warning",
      icon: ShieldAlert,
      isActive: pathname === "/analysis/surveillance-health",
    },
  ];

  const dedicatedModules = [
    {
      href: "/analysis/municipal-records",
      label: "Municipal Records",
      icon: FileSpreadsheet,
      category: "Descriptive",
      isActive: pathname === "/analysis/municipal-records",
    },
    {
      href: "/analysis/evaluated-forecasts",
      label: "Evaluated Forecasts",
      icon: Cpu,
      category: "Predictive",
      isActive: pathname === "/analysis/evaluated-forecasts",
    },
    {
      href: "/analysis/decision-support",
      label: "Decision Support",
      icon: Workflow,
      category: "Prescriptive",
      isActive: pathname === "/analysis/decision-support",
    },
    {
      href: "/analysis/surveillance-health",
      label: "Surveillance & Health",
      icon: ShieldAlert,
      category: "Monitoring",
      isActive: pathname === "/analysis/surveillance-health",
    },
  ];

  return (
    <div className={`w-full space-y-2.5 ${className}`}>
      {/* Primary Category Pill Navigation */}
      <nav
        aria-label="Analytics Categories"
        className="w-full"
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-2xs w-full">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`relative flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  tab.isActive
                    ? "bg-white text-emerald-950 shadow-xs border border-slate-200/60 font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                } ${tab.id === 'surveillance' ? 'col-span-2 sm:col-span-1' : ''}`}
                aria-current={tab.isActive ? "page" : undefined}
              >
                <Icon
                  className={`size-4 shrink-0 transition-colors ${
                    tab.isActive ? "text-emerald-700" : "text-slate-400"
                  }`}
                />
                <span className="truncate">{tab.shortLabel}</span>
                {tab.badge && (
                  <span
                    className={`hidden xl:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      tab.isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200/60"
                        : "bg-slate-200/60 text-slate-500"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
                {tab.isActive && (
                  <span className="absolute -bottom-1 left-3 right-3 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Contextual Sub-links for Active Category */}
      {(pathname !== "/analysis") && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
              Direct Modules:
            </span>
            {dedicatedModules.map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors ${
                  mod.isActive
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300 font-bold"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <mod.icon className="size-3 text-slate-400 shrink-0" />
                <span>{mod.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>Scope:</span>
            <span className="font-semibold text-slate-700">Official Padre Garcia Records</span>
          </div>
        </div>
      )}
    </div>
  );
}
