'use client';

import PrescriptiveAnalyticsView from '@/app/components/analytics/prescriptive-analytics-view';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { Workflow } from 'lucide-react';

export default function DecisionSupportPage() {
  return (
    <>
      <PageHeader
        title="Decision Support Workspace"
        subtitle="Quantitative rule triggers, operations queue, and evidence-based municipal actions for Padre Garcia MAO"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Workflow className="size-5 text-amber-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="decision" />

        <div className="w-full">
          <PrescriptiveAnalyticsView />
        </div>
      </div>
    </>
  );
}
