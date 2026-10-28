'use client';

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { FuturisticPredictiveDashboard } from '@/app/components/analytics/futuristic-predictive-dashboard';
import PredictiveAnalyticsView from '@/app/components/analytics/predictive-analytics-view';
import { Cpu, TrendingUp, Workflow } from 'lucide-react';

export default function PredictiveAnalyticsLandingPage() {
  const [activeTab, setActiveTab] = useState<'evaluated' | 'explorer'>('evaluated');

  return (
    <>
      <PageHeader
        title="Predictive Intelligence"
        subtitle="Explore future livestock activity using historical records and evaluated forecasting models for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<TrendingUp className="size-5 text-cyan-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="predictive" />

        {/* Predictive Perspective View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="px-2 py-0.5">
            <span className="text-xs font-bold text-slate-900">Analysis Perspectives</span>
            <p className="text-[11px] text-slate-500">
              {activeTab === 'evaluated'
                ? 'Empirical holdout validation, baseline comparisons, and commodity projections'
                : 'Interactive domain explorer for disease surveillance, mortality, weather sensitivity, and livestock milk'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-end sm:self-center shrink-0">
            <button
              onClick={() => setActiveTab('evaluated')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'evaluated'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Cpu className="size-3.5" />
              <span>Evaluated Models & Readiness</span>
            </button>
            <button
              onClick={() => setActiveTab('explorer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'explorer'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Workflow className="size-3.5" />
              <span>Multi-Domain Explorer</span>
            </button>
          </div>
        </div>

        <div className="w-full">
          {activeTab === 'evaluated' ? (
            <FuturisticPredictiveDashboard />
          ) : (
            <PredictiveAnalyticsView />
          )}
        </div>
      </div>
    </>
  );
}
