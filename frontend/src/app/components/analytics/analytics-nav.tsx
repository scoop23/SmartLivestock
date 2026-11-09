"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import {
  LayoutGrid,
  ArrowLeft,
} from "lucide-react";

export interface AnalyticsNavProps {
  currentSection?: "overview" | "descriptive" | "predictive" | "prescriptive" | "surveillance" | "records" | "forecasts" | "decision";
  className?: string;
}

function AnalyticsNavContent({ currentSection, className = "" }: AnalyticsNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const domainParam = searchParams?.get("domain");

  const isOverview = currentSection === "overview" || pathname === "/analysis";
  const overviewHref = useMemo(() => {
    const params = new URLSearchParams();
    if (domainParam) {
      params.set("domain", domainParam);
    }
    if (
      currentSection === "decision" ||
      currentSection === "prescriptive" ||
      pathname === "/analysis/decision-support" ||
      pathname === "/analysis/prescriptive"
    ) {
      params.set("tab", "prescriptive");
    } else if (
      currentSection === "forecasts" ||
      currentSection === "predictive" ||
      pathname === "/analysis/evaluated-forecasts" ||
      pathname === "/analysis/predictive"
    ) {
      params.set("tab", "predictive");
    } else if (
      currentSection === "surveillance" ||
      pathname === "/analysis/surveillance-health"
    ) {
      params.set("tab", "surveillance");
    } else if (
      currentSection === "records" ||
      currentSection === "descriptive" ||
      pathname === "/analysis/municipal-records" ||
      pathname === "/analysis/descriptive"
    ) {
      params.set("tab", "descriptive");
    }
    const qs = params.toString();
    return qs ? `/analysis?${qs}` : "/analysis";
  }, [domainParam, currentSection, pathname]);

  const primaryTabs = [
    {
      id: "overview",
      href: overviewHref,
      label: isOverview ? "Overview" : "Back to Overview",
      shortLabel: isOverview ? "Overview" : "Back to Overview",
      icon: isOverview ? LayoutGrid : ArrowLeft,
      isActive: isOverview,
      badge: undefined as string | undefined,
      badgeColor: undefined as string | undefined,
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      {/* Primary Category Pill Navigation */}
      <nav aria-label="Analytics Categories" className="flex flex-wrap items-center gap-2">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isBackButton = tab.id === "overview" && !isOverview;

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all border shadow-2xs ${
                tab.isActive
                  ? "bg-emerald-900 text-white border-emerald-950 font-bold shadow-xs"
                  : isBackButton
                  ? "bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 font-bold"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-current={tab.isActive ? "page" : undefined}
            >
              <Icon
                className={`size-4 shrink-0 ${
                  tab.isActive
                    ? "text-emerald-300"
                    : isBackButton
                    ? "text-emerald-700"
                    : "text-slate-500"
                }`}
              />
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

export function AnalyticsNav(props: AnalyticsNavProps) {
  return (
    <Suspense fallback={<div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />}>
      <AnalyticsNavContent {...props} />
    </Suspense>
  );
}
