"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  LayoutGrid,
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
      isActive: currentSection === "overview" || pathname === "/analysis",
    },
    {
      id: "descriptive",
      href: "/analysis/descriptive",
      label: "Descriptive Analytics",
      shortLabel: "Descriptive",
      icon: BarChart3,
      isActive:
        currentSection === "descriptive" ||
        currentSection === "records" ||
        pathname === "/analysis/descriptive" ||
        pathname === "/analysis/municipal-records",
    },
    {
      id: "predictive",
      href: "/analysis/predictive",
      label: "Predictive Analytics",
      shortLabel: "Predictive",
      badge: "FORECASTS",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      icon: TrendingUp,
      isActive:
        currentSection === "predictive" ||
        currentSection === "forecasts" ||
        pathname === "/analysis/predictive" ||
        pathname === "/analysis/evaluated-forecasts",
    },
    {
      id: "prescriptive",
      href: "/analysis/prescriptive",
      label: "Prescriptive Analytics",
      shortLabel: "Prescriptive",
      badge: "DECISIONS",
      badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
      icon: Lightbulb,
      isActive:
        currentSection === "prescriptive" ||
        currentSection === "decision" ||
        pathname === "/analysis/prescriptive" ||
        pathname === "/analysis/decision-support",
    },
    {
      id: "surveillance",
      href: "/analysis/surveillance-health",
      label: "Surveillance & Health",
      shortLabel: "Surveillance & Health",
      icon: ShieldAlert,
      isActive:
        currentSection === "surveillance" ||
        pathname === "/analysis/surveillance-health",
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      {/* Primary Category Pill Navigation */}
      <nav aria-label="Analytics Categories" className="flex flex-wrap items-center gap-2">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border shadow-2xs ${
                tab.isActive
                  ? "bg-emerald-900 text-white border-emerald-950 font-bold shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-current={tab.isActive ? "page" : undefined}
            >
              <Icon className={`size-4 shrink-0 ${tab.isActive ? "text-emerald-300" : "text-slate-500"}`} />
              <span>{tab.shortLabel}</span>
              {tab.badge && (
                <span className={`text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded border ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
