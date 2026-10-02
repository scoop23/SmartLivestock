'use client';

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';
import { AskAIBar } from '@/app/components/ask-ai-bar';
import { BarChart3 } from 'lucide-react';
import DescriptiveAnalytics from '@/app/components/analytics/descriptive-analytics';
import PredictiveAnalyticsView from '@/app/components/analytics/predictive-analytics-view';
import PrescriptiveAnalyticsView from '@/app/components/analytics/prescriptive-analytics-view';

export default function AnalyticsPage() {
  const [analyticsView, setAnalyticsView] = useState<'descriptive' | 'predictive' | 'prescriptive'>('descriptive');

  return (
    <>
      <PageHeader
        title="Advanced Analytics"
        subtitle="Authoritative Municipal Yields, Evaluated ML Forecasts, & Evidence-Based Decision Support"
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-slate-800" />}
      />

      {/* AI Search Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 shadow-2xs">
        <div className="w-full">
          <AskAIBar />
        </div>
      </div>

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-4 pb-16 sm:pb-6">
        {/* Analytics Type Selector Tabs */}
        <div className="bg-white p-2 rounded-xl shadow-2xs border border-slate-200">
          <div className="flex flex-wrap gap-1.5">
            {([
              { value: 'descriptive', label: '📊 Descriptive Analytics (Historical Records)' },
              { value: 'predictive', label: '🔮 Predictive Analytics (Evaluated Forecasts)' },
              { value: 'prescriptive', label: '💡 Prescriptive Analytics (Decision Support)' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAnalyticsView(value)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  analyticsView === value
                    ? 'bg-[#2D5A27] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 1. Descriptive Analytics View (Existing Authoritative Aggregates) */}
        {analyticsView === 'descriptive' && <DescriptiveAnalytics />}

        {/* 2. Real Predictive Analytics View (Evaluated ML Models & Forecasting) */}
        {analyticsView === 'predictive' && <PredictiveAnalyticsView />}

        {/* 3. Real Prescriptive Analytics View (Transparent Rule Recommendations) */}
        {analyticsView === 'prescriptive' && <PrescriptiveAnalyticsView />}
      </div>
    </>
  );
}
