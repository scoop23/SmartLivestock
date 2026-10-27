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
  const requestedType = searchParams.get("type");
  const rawActivity = (requestedActivity || requestedType)?.toLowerCase();
  const activity = rawActivity && ["milk", "meat", "eggs", "wool", "breeding", "insemination", "calving", "weights", "sales", "intent", "feedings", "feeding"].includes(rawActivity)
    ? (rawActivity === "insemination" ? "breeding" : (rawActivity === "feeding" ? "feedings" : rawActivity))
    : null;
  const requestedMode = searchParams.get("mode");
  const activityMode = requestedMode === "record" || requestedMode === "history" ? requestedMode : null;

  const rawSpecies = params?.species;
  const species =
    typeof rawSpecies === "string" ? decodeURIComponent(rawSpecies) : "Cattle";

  const activityTitle = useMemo(() => {
    const sName = species === "ALL" ? "Combined Herd" : species;
    if (activity === "meat") return `${sName} Meat Records`;
    if (activity === "milk") return `${sName} Dairy Milk Records`;
    if (activity === "eggs") return `${sName} Egg Collection Logs`;
    if (activity === "wool") return `${sName} Wool Shearing Logs`;
    if (activity === "breeding") return `${sName} Breeding & Insemination Records`;
    if (activity === "calving") return `${sName} Birthing & Calving Logs`;
    if (activity === "feedings" || activity === "feeding") return `${sName} Feeding & Ration Logs`;
    if (activity === "weights") return `${sName} Weight & Growth Records`;
    if (activity === "sales" || activity === "intent") return `${sName} Sale Intent Declarations`;
    return `${sName} Production Logs`;
  }, [activity, species]);

  const activitySubtitle = useMemo(() => {
    if (activity === "meat") return "Recorded meat output, yields in kilograms, and review status.";
    if (activity === "milk") return "Daily milking session logs, yield in liters, and review status.";
    if (activity === "eggs") return "Daily egg harvest logs and flock efficiency.";
    if (activity === "wool") return "Wool shearing logs and harvest weights.";
    if (activity === "breeding") return "Artificial insemination (AI), natural service records, and gestation countdowns.";
    if (activity === "feedings" || activity === "feeding") return "Daily feed intake, ration mix, and feed expenditure records.";
    return "Production records, animal births, and weight history";
  }, [activity]);

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
        title={activityTitle}
        subtitle={activitySubtitle}
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
