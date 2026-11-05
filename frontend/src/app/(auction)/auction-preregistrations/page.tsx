"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["1. Review paperwork", "Check the farmer's submitted details and documents. Request corrections here."],
          ["2. Confirm arrival and checks", "Use the AP reference to find the submission. Record the inspection reference after checking the animal."],
          ["3. Record the completed sale", "Open the transfer form with the farmer and animal already selected. Add the buyer, actual price, and certificate details for MAO review."],
        ].map(([title, description]) => <div key={title} className="rounded-xl border border-emerald-100 bg-white p-4"><h2 className="text-sm font-bold text-emerald-900">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p></div>)}
      </div>
      <Suspense fallback={<p className="p-4 text-sm text-slate-500">Loading preregistrations...</p>}><PreregistrationQueue /></Suspense>
    </main>
  </>;
}
