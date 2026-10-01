"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Info } from "lucide-react";
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
  console.log(productionRecords)

  const approvedInventories = useMemo(
    () =>
      inventories.filter(
        (item) =>
          item.status === "APPROVED" &&
          (item.operationalStatus || "ACTIVE") === "ACTIVE" && item.quantity > 0,
      ),
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

  // Explain missing species without making unapproved animals selectable.
  const awaitingSpecies = useMemo(() => {
    const eligible = new Set(uniqueSpecies.map((name) => name.toLowerCase()));
    return Array.from(new Set(inventories
      .filter((item) => ["PENDING", "VERIFIED"].includes(item.status)
        && (item.operationalStatus || "ACTIVE") === "ACTIVE")
      .map((item) => item.livestockTypeName.trim())
      .filter((name) => name && !eligible.has(name.toLowerCase()))));
  }, [inventories, uniqueSpecies]);

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
        title="Production"
        subtitle="Report production when information is available, record births, and review your submissions."
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {!isInventoryLoading && awaitingSpecies.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Awaiting inventory approval: {awaitingSpecies.join(", ")}</p>
              <p className="text-xs leading-relaxed">These livestock types become available for production after SIBAT verification and MAO approval. Only active, approved animals can be selected.</p>
              <Link href="/livestock-inventory" className="inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">View livestock inventory</Link>
            </div>
          </div>
        )}
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
