"use client";

import { PageHeader } from "@/app/components/page-header";
import { Scissors } from "lucide-react";
import { SlaughterReviewQueue } from "./slaughter-review-queue";

export default function SlaughterRecordReviewPage() {
  return <>
    <PageHeader title="Slaughter Record Review" subtitle="Review submitted aggregate facility totals" variant="admin" icon={<Scissors className="size-5" />} maxWidthClass="w-full" />
    <div className="w-full space-y-5 p-4 sm:p-6 lg:p-8">
      <SlaughterReviewQueue />
    </div>
  </>;
}