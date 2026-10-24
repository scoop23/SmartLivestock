'use client';

import DescriptiveAnalytics from '@/app/components/analytics/descriptive-analytics';
import PredictiveAnalyticsView from '@/app/components/analytics/predictive-analytics-view';
import PrescriptiveAnalyticsView from '@/app/components/analytics/prescriptive-analytics-view';
import SurveillanceAnalytics from '@/app/components/analytics/surveillance-analytics';
import { AskSmartLivestock } from '@/app/components/ask-smartlivestock';
import { PageHeader } from '@/app/components/page-header';
import { Button } from '@/components/ui/button';
import { useAccessibilitySettings } from '@/contexts/accessibility-settings-context';
import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function AnalyticsPage() {
  const { fontScale } = useAccessibilitySettings();
  const [analyticsView, setAnalyticsView] = useState<'descriptive' | 'predictive' | 'prescriptive' | 'surveillance'>('descriptive');

  return (
    <>
      <PageHeader
        title="Advanced Analytics"
        subtitle="Authoritative Municipal Yields, Evaluated ML Forecasts, & Evidence-Based Decision Support"
        variant="admin"
        maxWidthClass="w-full"
        icon={<BarChart3 className="size-5 text-slate-800" />}
      />

      {/* Rule-based analytics assistant */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 shadow-2xs">
        <div className="w-full">
          <AskSmartLivestock />
          <div className="mx-auto mt-2 flex max-w-6xl justify-end">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/analytics/nlp-example-review">NLP examples & evaluation</Link>
            </Button>
          </div>
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
              { value: 'surveillance', label: 'Disease & Mortality Surveillance' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setAnalyticsView(value)}
                className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
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
        {analyticsView === 'surveillance' && <SurveillanceAnalytics />}
      </div>
    </>
  );
}
