'use client';

import DescriptiveAnalytics from '@/app/components/analytics/descriptive-analytics';
import { PageHeader } from '@/app/components/page-header';
import { AnalyticsNav } from '@/app/components/analytics/analytics-nav';
import { FileSpreadsheet } from 'lucide-react';

export default function MunicipalRecordsPage() {
  return (
    <>
      <PageHeader
        title="Municipal Records"
        subtitle="Authoritative approved head counts, monthly production yields, and barangay-level reports for Padre Garcia"
        variant="admin"
        maxWidthClass="w-full"
        icon={<FileSpreadsheet className="size-5 text-emerald-800" />}
      />

      <div className="p-3 sm:p-4 md:p-6 w-full space-y-6 pb-20 sm:pb-8">
        <AnalyticsNav currentSection="records" />

        <div className="w-full">
          <DescriptiveAnalytics />
        </div>
      </div>
    </>
  );
}
