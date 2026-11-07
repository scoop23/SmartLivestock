'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { PopulationForecastPanel } from '@/app/components/analytics/population-forecast-panel';
import { FuturisticPredictiveDashboard, PredictiveLoadingScreen } from '@/app/components/analytics/futuristic-predictive-dashboard';
import { TrendingUp } from 'lucide-react';

export default function PredictiveAnalyticsLandingPage() {
  return (
    <>
      <PageHeader
        title="Forecasts & Trends"
        subtitle="Review population forecasts and estimates for animal health, deaths, slaughter, livestock sales, and cattle prices in Padre Garcia."
        variant="admin"
        maxWidthClass="w-full"
        icon={<TrendingUp className="size-5 text-cyan-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="predictive" />
        <PopulationForecastPanel />

        <div className="w-full">
          <Suspense fallback={<PredictiveLoadingScreen />}>
            <FuturisticPredictiveDashboard />
          </Suspense>
        </div>
      </div>
    </>
  );
}
