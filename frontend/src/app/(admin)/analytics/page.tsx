'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyticsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/analysis');
  }, [router]);

  return (
    <div className="flex h-[70vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        <p className="text-sm font-semibold text-slate-600">Navigating to Analytics & Insights...</p>
      </div>
    </div>
  );
}
