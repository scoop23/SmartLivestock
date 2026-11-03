'use client';

import { Suspense } from 'react';
import SurveillanceAnalytics from '@/app/components/analytics/surveillance-analytics';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { Plus } from 'lucide-react';

export default function SurveillanceHealthPage() {
  return (
    <>
      <PageHeader
        title="Disease Reports & Deaths"
        subtitle="View approved disease reports, death trends, and animal health notes in Padre Garcia."
        variant="admin"
        maxWidthClass="w-full"
        icon={
          <div className="size-9 rounded-xl bg-emerald-100 border border-emerald-300/80 flex items-center justify-center text-emerald-800 font-black shadow-2xs">
            <Plus className="size-5 stroke-[2.75]" />
          </div>
        }
      />

      <div className="relative isolate px-3 sm:px-4 md:px-6 py-2.5 sm:py-3.5 w-full space-y-3 sm:space-y-3.5 pb-16 sm:pb-8">
        {/* Subtle futuristic grid background pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(rgba(16,185,129,0.12)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_30%,#000_40%,transparent_100%)] opacity-70"
        />

        <AnalyticsNav currentSection="surveillance" />

        <div className="w-full">
          <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-2xl bg-slate-100" />}>
            <SurveillanceAnalytics />
          </Suspense>
        </div>
      </div>
    </>
  );
}
