"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/page-header";
import { useUserInventory } from "../../livestock-inventory/livestock-inventory";
import ProductionDashboardView from "../production-dashboard-view";
import EnterpriseEmptyState from "../components/enterprise-empty-state";

export default function SpeciesProductionPage() {
  const params = useParams();
  const router = useRouter();

  const rawSpecies = params?.species;
  const species =
    typeof rawSpecies === "string" ? decodeURIComponent(rawSpecies) : "Cattle";

  const { data: inventories = [], isLoading } = useUserInventory();

  const approvedInventories = inventories.filter((i) => i.status === "APPROVED");
  const uniqueSpecies = useMemo(() => {
    return Array.from(
      new Set(
        approvedInventories
          .map((i) => i.livestockTypeName?.trim())
          .filter((name): name is string => Boolean(name))
      )
    );
  }, [approvedInventories]);

  const hasMultipleSpecies = uniqueSpecies.length > 1;

  const handleSpeciesChange = (newSpecies: string | null) => {
    if (!newSpecies) {
      router.push("/production-dashboard");
    } else {
      router.push(`/production-dashboard/${encodeURIComponent(newSpecies)}`);
    }
  };

  const handleBackToHub = () => {
    router.push("/production-dashboard");
  };

  return (
    <>
      <PageHeader
        title={`${species === "ALL" ? "Combined Herd" : species} Production Logs`}
        subtitle="Official LGU daily yield records, maternal lineage birthing logs, and weight gain tracking"
        variant="farmer"
        maxWidthClass="w-full"
      />

      <div className="p-4 md:p-8 w-full space-y-6">
        {!isLoading && approvedInventories.length === 0 ? (
          <EnterpriseEmptyState />
        ) : (
          <ProductionDashboardView
            selectedSpecies={species}
            onSpeciesChange={handleSpeciesChange}
            onBackToHub={handleBackToHub}
            showEnterpriseSwitch={hasMultipleSpecies}
          />
        )}
      </div>
    </>
  );
}
