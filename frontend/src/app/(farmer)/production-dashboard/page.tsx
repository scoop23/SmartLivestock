"use client";

import { PageHeader } from "@/app/components/page-header";
import { AskSmartLivestock } from "@/app/components/ask-smartlivestock";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";
import { useAutomaticTutorialsEnabled } from "@/hooks/use-automatic-tutorials-enabled";
import { useUserInventory } from "../livestock-inventory/livestock-inventory";
import EnterpriseEmptyState from "./components/enterprise-empty-state";
import type { ProductionType } from "./production-analytics";
import RecordActivityChooser from "./record-activity-chooser";

const ProductionDashboardView = dynamic(() => import("./production-dashboard-view"), {
  loading: () => <Skeleton className="h-48 w-full rounded-2xl" />,
});

type SelectedRecordActivity = {
  id: string;
  species: string[];
  productionType?: ProductionType;
};

export default function ProductionDashboardPage() {
  const tutorialsEnabled = useAutomaticTutorialsEnabled();
  const [selectedActivity, setSelectedActivity] = useState<SelectedRecordActivity | null>(null);
  const [recordDialogInstance, setRecordDialogInstance] = useState(0);
  const { data: inventories = [], isLoading } = useUserInventory();
  const approvedInventories = useMemo(
    () => inventories.filter((item) => item.status === "APPROVED" && (item.operationalStatus || "ACTIVE") === "ACTIVE" && item.quantity > 0),
    [inventories],
  );
  const activeIntentInventories = useMemo(
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

  const startProductionTour = useCallback(() => {
    const hasActivities = approvedInventories.length > 0 || activeIntentInventories.length > 0;
    const activityCardStep: DriveStep | null = document.querySelector('[data-tour="production-activity-card"]')
      ? {
          element: '[data-tour="production-activity-card"]',
          popover: {
            title: "Use an activity card",
            description: "This card identifies the activity and eligible livestock. Choose Record to start a new entry, or View records to open this activity’s records.",
            side: "top",
            align: "center",
          },
        }
      : null;
    const activityEligibilityStep: DriveStep | null = document.querySelector('[data-tour="production-activity-eligibility"]')
      ? {
          element: '[data-tour="production-activity-eligibility"]',
          popover: {
            title: "Check which livestock can use this activity",
            description: "The Available for badges list the livestock types eligible for this activity. For example, a card showing Cattle and Sheep applies to those two types.",
            side: "top",
            align: "center",
          },
        }
      : null;
    const steps: DriveStep[] = [
      {
        element: '[data-tour="production-page-header"]',
        popover: {
          title: "Your farm activity log",
          description: "Record farm activities here. The available options depend on your active livestock and its approval status.",
          side: "bottom",
          align: "center",
        },
      },
      ...(hasActivities
        ? [
            {
              element: '[data-tour="production-activity-hero"]',
              popover: {
                title: "Choose where to go",
                description: "Use All production records to review your submitted activities, history, and forecasts.",
                side: "bottom" as const,
                align: "center" as const,
              },
            },
            {
              element: '[data-tour="production-activity-list"]',
              popover: {
                title: "Available activities",
                description: "Each card shows what you can record for your livestock. Select Record to open the form, or View records to open that activity’s history.",
                side: "top" as const,
                align: "center" as const,
              },
            },
            ...(activityCardStep ? [activityCardStep] : []),
            ...(activityEligibilityStep ? [activityEligibilityStep] : []),
            {
              element: '[data-tour="production-activity-guidance"]',
              popover: {
                title: "Why some activities may be missing",
                description: "Only activities supported by active livestock are listed. Most activities require the livestock to be approved first.",
                side: "top" as const,
                align: "start" as const,
              },
            },
          ]
        : [
            {
              element: '[data-tour="production-no-livestock"]',
              popover: {
                title: "Add approved livestock first",
                description: "Production activities appear after you add livestock and the livestock office approves it. Use this link to open your inventory.",
                side: "bottom" as const,
                align: "center" as const,
              },
            },
          ]),
    ];

    startGuidedTutorial({
      showProgress: true,
      animate: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      progressText: "{{current}} of {{total}}",
      steps,
    });
  }, [activeIntentInventories.length, approvedInventories.length]);

  useEffect(() => {
    if (isLoading || !getAutomaticTutorialsEnabled()) return;
    const timer = window.setTimeout(() => {
      startProductionTour();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isLoading, startProductionTour]);

  return (
    <>
      <PageHeader
        title={<span data-tour="production-page-header">Record</span>}
        subtitle="Log daily farm activities and livestock production."
        variant="farmer"
        maxWidthClass="w-full"
        mobileActionsRow
        action={tutorialsEnabled ? (
          <Button type="button" onClick={startProductionTour} disabled={isLoading} variant="outline" className="min-h-11 gap-2 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Sparkles className="size-4" aria-hidden="true" /> Tutorial
          </Button>
        ) : undefined}
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ease-out motion-reduce:animate-none">
        <AskSmartLivestock />
        {!isLoading && awaitingSpecies.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Livestock awaiting approval: {awaitingSpecies.join(", ")}</p>
              <p className="text-xs leading-relaxed">You can record activities and declare sale intent after the livestock is approved.</p>
              <div className="flex flex-wrap gap-x-4">
                {awaitingSpecies.map((species) => (
                  <Link
                    key={species}
                    href={`/livestock-inventory?highlightType=${encodeURIComponent(species)}`}
                    className="inline-flex min-h-11 items-center text-xs font-medium underline underline-offset-4"
                  >
                    View {species} livestock
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading livestock activities">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}
          </div>
        ) : approvedInventories.length === 0 && activeIntentInventories.length === 0 ? (
          <EnterpriseEmptyState />
        ) : (
          <>
            <RecordActivityChooser
              inventories={approvedInventories}
              intentInventories={activeIntentInventories}
              onRecord={(activity) => {
                setRecordDialogInstance((instance) => instance + 1);
                setSelectedActivity(activity);
              }}
            />
            {selectedActivity && (
              <div className="hidden">
                <ProductionDashboardView
                  key={`${recordDialogInstance}-${selectedActivity.id}-${selectedActivity.species.join("-")}`}
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
