"use client";

import { PageHeader } from "@/app/components/page-header";
import { ValidationLoadingScreen } from "@/components/validation-loading-screen";
import { Layers, MapPin, ShieldCheck, Tag } from "lucide-react";

export default function LivestockRecordsLoading() {
  return (
    <>
      <PageHeader
        title="Livestock Management"
        subtitle="Official Municipal Agriculture Office (MAO) livestock registry, herd inspection, and animal tracking"
        variant="admin"
        maxWidthClass="w-full"
      />
      <div className="relative isolate min-h-[calc(100vh-8rem)] w-full px-4 sm:px-6 lg:px-8 py-6 pb-16 sm:pb-8">
        <ValidationLoadingScreen
          isLoading={true}
          title="Synchronizing Municipal Livestock Registry"
          subtitle="Retrieving official herd records, individual ear tag biometrics, barangay directories, and field verification ledgers..."
          badgeLabel="Livestock Registry Sync"
          authorityText="Municipal Agriculture Office • Padre Garcia, Batangas"
          items={[
            {
              id: "batches",
              label: "Herd Batches Registry",
              sublabel: "Registered herd groups & biometric profiles",
              icon: <Layers className="size-4 shrink-0 text-emerald-700" />,
              loaded: false,
            },
            {
              id: "individual",
              label: "Individual Ear Tag Records",
              sublabel: "Individual identification, breed & status",
              icon: <Tag className="size-4 shrink-0 text-sky-700" />,
              loaded: false,
            },
            {
              id: "references",
              label: "Reference Metadata",
              sublabel: "17 Padre Garcia barangays & species options",
              icon: <MapPin className="size-4 shrink-0 text-purple-700" />,
              loaded: false,
            },
            {
              id: "verification",
              label: "Field Verification Ledger",
              sublabel: "CBAT / SIBAT inspector audit trail",
              icon: <ShieldCheck className="size-4 shrink-0 text-amber-700" />,
              loaded: false,
            },
          ]}
        />
      </div>
    </>
  );
}
