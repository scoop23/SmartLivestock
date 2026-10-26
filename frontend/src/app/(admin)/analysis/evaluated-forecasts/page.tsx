'use client';

import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { FuturisticPredictiveDashboard } from '@/app/components/analytics/futuristic-predictive-dashboard';
import { Cpu } from 'lucide-react';

export default function EvaluatedForecastsPage() {
  return (
    <>
      <PageHeader
        title="Evaluated Forecasts"
        subtitle="Empirical model projections, holdout baseline validation, and data readiness diagnostics for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Cpu className="size-5 text-cyan-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="forecasts" />

        <div className="w-full">
          <FuturisticPredictiveDashboard />
        </div>
      </div>
    </>
  );
}
