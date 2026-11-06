"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import AuctionPreregistrations from "@/app/components/auction-preregistrations";

function PreregistrationQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return <AuctionPreregistrations staff requestedRegistrationId={searchParams.get("registration")} onRecordSale={async registration => {
    router.push(`/auction-ownership-transfers?preregistration=${registration.id}`);
  }} />;
}

export default function AuctionPreregistrationsPage() {
  return <>
    <PageHeader variant="auction" title="Auction Preregistrations" subtitle="Review farmer paperwork before arrival and prepare animals for the sale-recording step." />
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2.5 sm:p-3.5 shadow-2xs hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Step 1 */}
          <div className="flex flex-1 items-center gap-3.5 rounded-xl border border-[#BEE1C6] bg-[#EAF5EC] p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1E4D2B] text-sm font-bold text-white shadow-xs">
              1
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Review Paperwork</h2>
              <p className="mt-0.5 text-xs text-slate-600 leading-snug">
                Check the farmer&apos;s submitted details and documents.
              </p>
            </div>
          </div>

          <ChevronRight className="size-5 shrink-0 text-slate-400 hidden lg:block" aria-hidden="true" />

          {/* Step 2 */}
          <div className="flex flex-1 items-center gap-3.5 rounded-xl p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D7EEDD] text-sm font-bold text-[#1E4D2B]">
              2
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Confirm Arrival &amp; Checks</h2>
              <p className="mt-0.5 text-xs text-slate-600 leading-snug">
                Record the inspection reference after checking the animal.
              </p>
            </div>
          </div>

          <ChevronRight className="size-5 shrink-0 text-slate-400 hidden lg:block" aria-hidden="true" />

          {/* Step 3 */}
          <div className="flex flex-1 items-center gap-3.5 rounded-xl p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#D7EEDD] text-sm font-bold text-[#1E4D2B]">
              3
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Record the Sale</h2>
              <p className="mt-0.5 text-xs text-slate-600 leading-snug">
                Add buyer, actual price, and certificate details for MAO review.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Suspense fallback={<p className="p-4 text-sm text-slate-500">Loading preregistrations...</p>}><PreregistrationQueue /></Suspense>
    </main>
  </>;
}
