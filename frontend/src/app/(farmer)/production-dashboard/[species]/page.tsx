"use client";

import { PageHeader } from "@/app/components/page-header";
import { useParams,useRouter,useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useUserInventory } from "../../livestock-inventory/livestock-inventory";
import EnterpriseEmptyState from "../components/enterprise-empty-state";
import ProductionDashboardView from "../production-dashboard-view";

export default function SpeciesProductionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedActivity = searchParams.get("activity");
  const activity = requestedActivity && ["milk", "meat", "eggs", "wool", "calving", "weights", "sales", "intent"].includes(requestedActivity)
    ? requestedActivity
    : null;
  const requestedMode = searchParams.get("mode");
  const activityMode = requestedMode === "record" || requestedMode === "history" ? requestedMode : null;

  const rawSpecies = params?.species;
  const species =
    typeof rawSpecies === "string" ? decodeURIComponent(rawSpecies) : "Cattle";

  const { data: inventories = [], isLoading } = useUserInventory();

  const approvedInventories = inventories.filter(
    (item) =>
      item.status === "APPROVED" &&
      (item.operationalStatus || "ACTIVE") === "ACTIVE" && item.quantity > 0,
  );
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
        subtitle="Production records, animal births, and weight history"
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
            initialActivity={activity}
            initialMode={activityMode}
            initialEligibleSpecies={searchParams.getAll("eligibleSpecies")}
          />
        )}
      </div>
    </>
  );
}
