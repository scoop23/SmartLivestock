'use client';

import DescriptiveAnalytics from '@/app/components/analytics/descriptive-analytics';
import PredictiveAnalyticsView from '@/app/components/analytics/predictive-analytics-view';
import PrescriptiveAnalyticsView from '@/app/components/analytics/prescriptive-analytics-view';
import SurveillanceAnalytics from '@/app/components/analytics/surveillance-analytics';
import { AskSmartLivestock } from '@/app/components/ask-smartlivestock';
import { PageHeader } from '@/app/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAccessibilitySettings } from '@/contexts/accessibility-settings-context';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type AnalyticsTabKey = 'descriptive' | 'predictive' | 'prescriptive' | 'surveillance';

interface AnalyticsTabConfig {
  value: AnalyticsTabKey;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ANALYTICS_TABS: AnalyticsTabConfig[] = [
  {
    value: 'descriptive',
    title: 'Municipal Records',
    badge: 'Historical & Current',
    description: 'Approved head counts, monthly production yields, and barangay aggregates',
    icon: BarChart3,
  },
  {
    value: 'predictive',
    title: 'Evaluated Forecasts',
    badge: '1–6 Month Horizons',
    description: 'Empirical model projections with historical baseline validation and weather context',
    icon: TrendingUp,
  },
  {
    value: 'prescriptive',
    title: 'Decision Support',
    badge: 'Actionable Rules',
    description: 'Quantitative evidence triggers and recommended municipal administrative actions',
    icon: Lightbulb,
  },
  {
    value: 'surveillance',
    title: 'Surveillance & Health',
    badge: 'Early Warning Signals',
    description: 'Approved disease reports, mortality trends, and linked herd event tracking',
    icon: ShieldAlert,
  },
];

export default function AnalyticsPage() {
  const { fontScale } = useAccessibilitySettings();
  const [analyticsView, setAnalyticsView] = useState<AnalyticsTabKey>('descriptive');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const activeTabConfig = ANALYTICS_TABS.find((t) => t.value === analyticsView) || ANALYTICS_TABS[0];

  return (
    <>
      <PageHeader
        title="Analytics & Decision Support"
        subtitle="Authoritative municipal livestock records, evaluated ML forecasts, and evidence-based decision guidance for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-emerald-800" />}
      />

      {/* Main Page Workspace */}
      <div className="p-3 sm:p-4 md:p-5 w-full space-y-4 pb-16 sm:pb-6">
        {/* Compact Collapsible Municipal Assistant Panel (Ask SmartLivestock) */}
        <section
          aria-label="Natural Language Query Assistant"
          className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 sm:p-4 bg-gradient-to-r from-slate-50 via-white to-emerald-50/30">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200/60 shadow-2xs">
                <Sparkles className="size-4.5 sm:size-5 text-emerald-700" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    Ask Municipal Data Assistant
                  </h2>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold">
                    Rule-Based NLP
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-snug">
                  Ask questions in English or Tagalog about head counts, monthly production, disease cases, or pending approvals.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-50">
                <Link href="/admin/analytics/nlp-example-review">
                  <FileSearch className="mr-1.5 size-3.5 text-slate-500" />
                  NLP Examples
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAssistantOpen((prev) => !prev)}
                className={`h-8 text-xs font-bold transition-colors ${
                  isAssistantOpen
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
                aria-expanded={isAssistantOpen}
                aria-controls="ask-smartlivestock-content"
              >
                {isAssistantOpen ? (
                  <>
                    <span>Hide Assistant</span>
                    <ChevronUp className="ml-1.5 size-3.5" />
                  </>
                ) : (
                  <>
                    <span>Open Assistant</span>
                    <ChevronDown className="ml-1.5 size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Collapsible Assistant Content */}
          {isAssistantOpen && (
            <div
              id="ask-smartlivestock-content"
              className="border-t border-slate-200 p-4 sm:p-5 bg-white space-y-4"
            >
              <AskSmartLivestock />
            </div>
          )}
        </section>

        {/* Section Navigation: 4 Cohesive Decision-Support Cards */}
        <nav
          aria-label="Analytics Sections"
          role="tablist"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
        >
          {ANALYTICS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = analyticsView === tab.value;
            return (
              <button
                key={tab.value}
                role="tab"
                id={`tab-${tab.value}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.value}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setAnalyticsView(tab.value)}
                className={`group relative flex flex-col justify-between text-left rounded-2xl p-3.5 sm:p-4 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isActive
                    ? "border-2 border-emerald-600 bg-emerald-50/70 shadow-sm"
                    : "border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`flex size-8.5 items-center justify-center rounded-xl transition-colors ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      <Icon className="size-4.5 shrink-0" />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        isActive
                          ? "bg-white text-emerald-800 border-emerald-300 font-bold"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {tab.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3
                      className={`text-sm sm:text-base font-bold transition-colors ${
                        isActive ? "text-emerald-950" : "text-slate-800 group-hover:text-slate-900"
                      }`}
                    >
                      {tab.title}
                    </h3>
                    <p
                      className={`text-xs mt-1 leading-snug line-clamp-2 ${
                        isActive ? "text-emerald-900/90 font-medium" : "text-slate-500"
                      }`}
                    >
                      {tab.description}
                    </p>
                  </div>
                </div>

                {/* Active Indicator Bar */}
                {isActive && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-200/80 flex items-center justify-between text-xs font-bold text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-600" />
                      Active Section
                    </span>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-700">View Active</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Section Content Container */}
        <div
          id={`panel-${analyticsView}`}
          role="tabpanel"
          aria-labelledby={`tab-${analyticsView}`}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {analyticsView === 'descriptive' && <DescriptiveAnalytics />}
          {analyticsView === 'predictive' && <PredictiveAnalyticsView />}
          {analyticsView === 'prescriptive' && <PrescriptiveAnalyticsView />}
          {analyticsView === 'surveillance' && <SurveillanceAnalytics />}
        </div>
      </div>
    </>
  );
}
