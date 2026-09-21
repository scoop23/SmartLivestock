"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserInventory } from "../livestock-inventory/livestock-inventory";
import { fetchProductionRecords, ProductionRecordItem } from "./production-analytics";
import ProductionEnterpriseHub from "./production-enterprise-hub";
import ProductionDashboardView from "./production-dashboard-view";
import EnterpriseEmptyState from "./components/enterprise-empty-state";

export default function ProductionDashboardPage() {
  const router = useRouter();

  // Fetch Inventory with standard hook & mapper
  const { data: inventories = [], isLoading: isInventoryLoading } = useUserInventory();

  // Fetch Production Records
  const { data: productionRecords = [], isLoading: isRecordsLoading } = useQuery<
    ProductionRecordItem[]
  >({
    queryKey: ["production_records"],
    queryFn: fetchProductionRecords,
  });

  const approvedInventories = useMemo(
    () => inventories.filter((item) => item.status === "APPROVED"),
    [inventories]
  );

  // Extract distinct species owned by the farmer
  const uniqueSpecies = useMemo(() => {
    return Array.from(
      new Set(
        approvedInventories
          .map((i) => i.livestockTypeName?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );
  }, [approvedInventories]);

  const isLoading = isInventoryLoading || isRecordsLoading;

  const handleSelectSpecies = (speciesName: string | null) => {
    if (!speciesName) {
      router.push("/production-dashboard");
    } else {
      router.push(`/production-dashboard/${encodeURIComponent(speciesName)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Production & Yield Telemetry"
        subtitle="Official LGU production logs, maternal lineage birthing registry, and biometric growth tracking"
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-3xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-44 rounded-3xl" />
              <Skeleton className="h-44 rounded-3xl" />
              <Skeleton className="h-44 rounded-3xl" />
            </div>
          </div>
        ) : uniqueSpecies.length === 0 ? (
          /* Case 0: No approved livestock registered yet */
          <EnterpriseEmptyState />
        ) : uniqueSpecies.length === 1 ? (
          /* Case 1: Exactly 1 livestock type owned -> Auto-bypass hub and show that species dashboard directly */
          <ProductionDashboardView
            selectedSpecies={uniqueSpecies[0]}
            onSpeciesChange={handleSelectSpecies}
            showEnterpriseSwitch={false}
          />
        ) : (
          /* Case 2: Greater than 1 livestock types owned -> Show Visual Enterprise Selector Hub */
          <ProductionEnterpriseHub
            inventories={approvedInventories}
            productionRecords={productionRecords}
            onSelectSpecies={handleSelectSpecies}
          />
        )}
      </div>
    </>
  );
}
