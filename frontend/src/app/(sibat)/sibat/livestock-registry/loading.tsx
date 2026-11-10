"use client";

import { PageHeader } from "@/app/components/page-header";
import { ValidationLoadingScreen } from "@/components/validation-loading-screen";
import { Layers, MapPin, Tag } from "lucide-react";

export default function LivestockRegistryLoading() {
  return (
    <>
      <PageHeader
        title="Livestock Records"
        subtitle="Animals, Herds, and Census records in one place"
        variant="farmer"
        maxWidthClass="w-full"
        hideIconOnMobile
        showTutorialToggle={false}
        mobileActionsInline
      />
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <ValidationLoadingScreen
          isLoading={true}
          role="CBAT"
          title="Loading Farmer Records"
          subtitle="Preparing individual livestock, herd submissions, and barangay records..."
          badgeLabel="Livestock Records Sync"
          authorityText="CBAT Field Validation · Padre Garcia, Batangas"
          items={[
            { id: "individual", label: "Individual Livestock", sublabel: "Animal identification and registration records", icon: <Tag className="size-4 text-emerald-700" />, loaded: false },
            { id: "herds", label: "Herd Submissions", sublabel: "Herd rosters and field verification records", icon: <Layers className="size-4 text-sky-600" />, loaded: false },
            { id: "barangay", label: "Barangay Coverage", sublabel: "Preparing your assigned coverage", icon: <MapPin className="size-4 text-amber-600" />, loaded: false },
          ]}
        />
      </div>
    </>
  );
}
