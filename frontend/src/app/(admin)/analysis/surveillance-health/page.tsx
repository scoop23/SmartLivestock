'use client';

import SurveillanceAnalytics from '@/app/components/analytics/surveillance-analytics';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { ShieldAlert } from 'lucide-react';

export default function SurveillanceHealthPage() {
  return (
    <>
      <PageHeader
        title="Surveillance & Health"
        subtitle="Approved disease reports, mortality trends, early-warning alert levels, and linked herd event tracking for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<ShieldAlert className="size-5 text-rose-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8 max-w-7xl mx-auto">
        <AnalyticsNav currentSection="surveillance" />

        <div className="w-full">
          <SurveillanceAnalytics />
        </div>
      </div>
    </>
  );
}
