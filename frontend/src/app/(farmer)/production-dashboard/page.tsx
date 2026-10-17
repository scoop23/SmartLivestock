"use client";

import { PageHeader } from "@/app/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Info } from "lucide-react";
import Link from "next/link";
import { useMemo,useState } from "react";
import { useUserInventory } from "../livestock-inventory/livestock-inventory";
import EnterpriseEmptyState from "./components/enterprise-empty-state";
import type { ProductionType } from "./production-analytics";
import ProductionDashboardView from "./production-dashboard-view";
import RecordActivityChooser from "./record-activity-chooser";

type SelectedRecordActivity = {
  id: string;
  species: string[];
  productionType?: ProductionType;
};

export default function ProductionDashboardPage() {
  const [selectedActivity, setSelectedActivity] = useState<SelectedRecordActivity | null>(null);
  const { data: inventories = [], isLoading } = useUserInventory();
  const approvedInventories = useMemo(
    () => inventories.filter((item) => item.status === "APPROVED" && (item.operationalStatus || "ACTIVE") === "ACTIVE" && item.quantity > 0),
    [inventories],
  );
  const awaitingSpecies = useMemo(() => {
    const available = new Set(approvedInventories.map((item) => item.livestockTypeName.trim().toLowerCase()));
    return Array.from(new Set(inventories
      .filter((item) => ["PENDING", "VERIFIED"].includes(item.status) && (item.operationalStatus || "ACTIVE") === "ACTIVE")
      .map((item) => item.livestockTypeName.trim())
      .filter((name) => name && !available.has(name.toLowerCase()))));
  }, [approvedInventories, inventories]);

  return (
    <>
      <PageHeader title="Record" variant="farmer" maxWidthClass="w-full" />
      <div className="w-full space-y-5 p-4 md:p-8">
        {!isLoading && awaitingSpecies.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Livestock awaiting approval: {awaitingSpecies.join(", ")}</p>
              <p className="text-xs leading-relaxed">You can record activities after the livestock is approved.</p>
              <Link href="/livestock-inventory" className="inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4">View My Livestock</Link>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading livestock activities">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}
          </div>
        ) : approvedInventories.length === 0 ? (
          <EnterpriseEmptyState />
        ) : (
          <>
            <RecordActivityChooser inventories={approvedInventories} onRecord={setSelectedActivity} />
            {selectedActivity && (
              <div className="hidden">
                <ProductionDashboardView
                  key={`${selectedActivity.id}-${selectedActivity.species.join("-")}`}
                  selectedSpecies={selectedActivity.species.length === 1 ? selectedActivity.species[0] : "ALL"}
                  showEnterpriseSwitch={false}
                  initialActivity={selectedActivity.id}
                  initialMode="record"
                  initialEligibleSpecies={selectedActivity.species}
                  onReturnToChooser={() => setSelectedActivity(null)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
