"use client";

import { cn } from "@/lib/utils";
import { useMutation,useQueryClient } from "@tanstack/react-query";
import { ChevronDown,RefreshCw } from "lucide-react";
import { Suspense,startTransition,useCallback,useEffect,useMemo,useRef,useState } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { getAutomaticTutorialsEnabled, startGuidedTutorial } from "@/lib/tutorial-preferences";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs,TabsContent } from "@/components/ui/tabs";

import api from "@/lib/axios";
import {
type EntryType,
type InventoryApiItem,
type LivestockInventoryItem,
type LivestockType,
type StatusType,
type UpdateInventoryPayload,
useLivestockBatches,
useLivestockTypes,
useUserInventory,
} from "./livestock-inventory";

import HealthTrackerTab from "./health-tracker-tab";
import LivestockDetailsDialog from "./livestock-details-dialog";
import LivestockEditDialog from "./livestock-edit-dialog";
import LivestockRecordList from "./livestock-record-list";
import LivestockTypeCards from "./livestock-type-cards";

import {
DeleteLivestockDialog,
InventoryHeroBanner,
InventoryTabsNav,
InventoryTelemetryHeader,
RegisterLivestockDialog,
SpeciesDrilldownView,
} from "./components";

// Re-export types for any existing consumers
export type { EntryType,InventoryApiItem,LivestockInventoryItem,LivestockType,StatusType };

function LivestockInventoryContent() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const livestockTypeParam = searchParams.get("livestockType");
  const highlightTypeParam = searchParams.get("highlightType");
  const activityLivestockId = searchParams.get("livestockId");
  const [activeTab, setActiveTab] = useState<"types" | "all" | "health">("types");
  const [isKpiOpen, setIsKpiOpen] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(livestockTypeParam);
  const [highlightedType, setHighlightedType] = useState<string | null>(null);
  const handledActivityLinkRef = useRef<string | null>(null);
  const requestedInventoryTourRef = useRef<"manage" | "all" | "health" | null>(null);

  const startInventoryTour = useCallback(() => {
    setSelectedType(null);
    setActiveTab("types");
    setIsKpiOpen(true);

    window.setTimeout(() => {
      startGuidedTutorial({
        showProgress: true,
        animate: true,
        allowClose: true,
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        progressText: "{{current}} of {{total}}",
        steps: [
          {
            element: '[data-tour="register-livestock"]',
            popover: {
              title: "Register livestock",
              description: "Start here to add a livestock record to your farm inventory.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="inventory-tools"]',
            popover: {
              title: "Inventory tools",
              description: "Open More to view livestock history, ownership history, or export your list as a CSV file.",
              side: "bottom",
              align: "end",
            },
          },
          {
            element: '[data-tour="inventory-kpis"]',
            popover: {
              title: "Herd overview",
              description: "Review cattle and herd counts, sex breakdowns, and vaccination information. Use Hide or Show to collapse or expand these figures.",
              side: "bottom",
              align: "start",
            },
          },
          {
            element: '[data-tour="inventory-tabs"]',
            popover: {
              title: "Choose an inventory view",
              description: "Browse livestock by type, open the full list of records, or switch to health and vaccination information.",
              side: "bottom",
              align: "center",
            },
          },
          {
            element: '[data-tour="livestock-types"]',
            popover: {
              title: "Browse by livestock type",
              description: "Select a livestock type to view and manage the animals and herds in that group.",
              side: "top",
              align: "center",
            },
          },
        ],
      });
    }, 100);
  }, []);

  // Herd links preserve the livestock type so Back returns to the same
  // Manage Cattle (or other type) drilldown instead of the overview cards.
  useEffect(() => {
    if (livestockTypeParam) startTransition(() => setSelectedType(livestockTypeParam));
  }, [livestockTypeParam]);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading, isError, refetch, isFetching } = useUserInventory();
  const {
    data: allTagInventory = [],
    isLoading: isAllTagInventoryLoading,
    isError: isAllTagInventoryError,
    refetch: refetchAllTagInventory,
  } = useUserInventory({ includeInactive: true });
  const { data: userBatches = [], isLoading: isBatchesLoading } = useLivestockBatches({ includeRoster: false });

  useEffect(() => {
    if (!highlightTypeParam || isLoading || isError) return;
    setActiveTab("types");
    setSelectedType(null);
    setHighlightedType(highlightTypeParam);

    const timer = window.setTimeout(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-livestock-type]"))
        .find((element) => element.dataset.livestockType?.toLowerCase() === highlightTypeParam.toLowerCase());
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [highlightTypeParam, isLoading, isError]);

  useEffect(() => {
    if (isLoading || isError || livestockTypeParam || activityLivestockId || !getAutomaticTutorialsEnabled()) return;

    const timer = window.setTimeout(startInventoryTour, 600);

    return () => window.clearTimeout(timer);
  }, [isLoading, isError, livestockTypeParam, activityLivestockId, startInventoryTour]);

  useEffect(() => {
    const requestedTour = requestedInventoryTourRef.current;
    if (!requestedTour) return;
    if (requestedTour === "manage" && !selectedType) return;
    if ((requestedTour === "all" || requestedTour === "health") && activeTab !== requestedTour) return;

    requestedInventoryTourRef.current = null;
    const timer = window.setTimeout(() => {
      const steps: DriveStep[] = requestedTour === "manage"
        ? [
            {
              element: '[data-tour="species-header"]',
              popover: {
                title: `${selectedType} overview`,
                description: "This header summarizes the selected livestock type and shows its total animals and records.",
                side: "bottom" as const,
                align: "start" as const,
              },
            },
            {
              element: '[data-tour="species-herds"]',
              popover: {
                title: "Herds for this livestock type",
                description: "Use Check Herd to review group-managed animals, or continue to the individual and batch records below.",
                side: "bottom" as const,
                align: "start" as const,
              },
            },
            {
              element: '[data-tour="species-records"]',
              popover: {
                title: `${selectedType} records`,
                description: "This section contains the record cards for the selected livestock type. Scroll through the cards to review each animal.",
                side: "top" as const,
                align: "start" as const,
              },
            },
          ]
        : requestedTour === "all"
          ? [
              {
                element: '[data-tour="all-livestock-view"][data-state="active"] [data-tour="records-controls"]',
                popover: {
                  title: "Find and manage records",
                  description: "Search your livestock and filter by species, review status, or lifecycle. You can also change sorting and export the results.",
                  side: "bottom" as const,
                  align: "start" as const,
                },
              },
              {
                element: '[data-tour="all-livestock-view"][data-state="active"]',
                popover: {
                  title: "Your livestock records",
                  description: "Browse your matching animals here, then open a record to view its details or make an update.",
                  side: "top" as const,
                  align: "start" as const,
                },
              },
            ]
          : [
              {
                element: '[data-tour="health-view"][data-state="active"] [data-tour="health-summary"]',
                popover: {
                  title: "Vaccination summary",
                  description: "Review the herd immunization rate, vaccinated headcount, and animals that still need a vaccine record.",
                  side: "bottom" as const,
                  align: "start" as const,
                },
              },
              {
                element: '[data-tour="health-view"][data-state="active"] [data-tour="health-filters"]',
                popover: {
                  title: "Search and filter health records",
                  description: "Find an animal by tag, breed, or type, then filter the list to all animals, vaccinated animals, or those needing a vaccine.",
                  side: "bottom" as const,
                  align: "start" as const,
                },
              },
              {
                element: '[data-tour="health-view"][data-state="active"] [data-tour="health-records"]',
                popover: {
                  title: "Health and vaccination records",
                  description: "Check each animal’s vaccination status and last vaccine date. Use View or Update to open its record.",
                  side: "top" as const,
                  align: "start" as const,
                },
              },
            ];

      if (requestedTour === "manage") {
        const recordCards = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-tour="species-records"] [data-tour="livestock-record-card"]'
          )
        );
        const recordCard = recordCards.find((card) =>
          card.querySelector('[data-tour="record-card-remarks"]')
        ) ?? recordCards[0];

        if (recordCard) {
          steps.push({
            element: recordCard,
            popover: {
              title: "Livestock record card",
              description: "Each card represents one registered animal or livestock record. We’ll walk through the information shown on this card.",
              side: "top" as const,
              align: "start" as const,
            },
          });

          const addCardStep = (
            selector: string,
            title: string,
            description: string,
            side: "top" | "bottom" = "bottom"
          ) => {
            const element = recordCard.querySelector<HTMLElement>(selector);
            if (element) {
              steps.push({
                element,
                popover: { title, description, side, align: "start" as const },
              });
            }
          };

          addCardStep(
            '[data-tour="record-card-identity"]',
            "Photo, type, and tag",
            "This area identifies the animal. It can show a photo or avatar, livestock type, ear tag, and linked herd."
          );
          addCardStep(
            '[data-tour="record-card-review"]',
            "Record review status",
            "The badge shows the livestock office review status. The text below the animal name shows breed, sex, and age when recorded."
          );
          addCardStep(
            '[data-tour="record-card-weight"]',
            "Weight",
            "The recorded weight appears here; it says Unrecorded when no weight has been entered."
          );
          addCardStep(
            '[data-tour="record-card-immunization"]',
            "Immunization",
            "See the last recorded vaccination date, or a reminder when a vaccine is due."
          );
          addCardStep(
            '[data-tour="record-card-life-stage"]',
            "Life stage",
            "This field groups the animal by its age classification."
          );
          addCardStep(
            '[data-tour="record-card-birth"]',
            "Birth date or age",
            "The card displays the birth date when available, otherwise it shows the recorded age."
          );
          addCardStep(
            '[data-tour="record-card-remarks"]',
            "Officer note",
            "If the record was returned with remarks, the livestock office’s note appears here.",
            "top"
          );
          addCardStep(
            '[data-tour="record-card-actions"]',
            "Record actions",
            "Use Details to inspect the full record. Edit and delete are available when the record’s status allows them.",
            "top"
          );
        }
      }

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
    }, 250);

    return () => window.clearTimeout(timer);
  }, [activeTab, selectedType]);

  const handleSelectType = (type: string) => {
    requestedInventoryTourRef.current = "manage";
    setSelectedType(type);
  };

  const handleTabChange = (nextTab: "types" | "all" | "health") => {
    setActiveTab(nextTab);
    if (nextTab !== "types") setSelectedType(null);
    if (nextTab === "all" || nextTab === "health") {
      requestedInventoryTourRef.current = nextTab;
    }
  };

  // Recent-activity links contain only a livestock ID. Resolve it from the
  // farmer's own inventory query so the existing detail dialog gets the same
  // complete record object used by the normal inventory buttons.
  useEffect(() => {
    if (!activityLivestockId) {
      handledActivityLinkRef.current = null;
      return;
    }
    if (isLoading || isError || handledActivityLinkRef.current === activityLivestockId) return;

    const livestock = inventories.find((item) => String(item.id) === activityLivestockId);
    if (livestock) {
      startTransition(() => setDetailTarget(livestock));
    } else {
      toast.error("That livestock record could not be found in your inventory.");
    }
    handledActivityLinkRef.current = activityLivestockId;
  }, [inventories, isLoading, isError, activityLivestockId]);

  const clearActivityLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("livestockId");
    router.replace(`${pathname}${url.search}${url.hash}`, { scroll: false });
  };

  // Herd Telemetry calculations
  const totalHeads = useMemo(
    () => inventories.reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const vaccinatedHeads = useMemo(
    () =>
      inventories
        .filter((i) => Boolean(i.lastVaccinationDate))
        .reduce((acc, curr) => acc + curr.quantity, 0),
    [inventories]
  );
  const vaxRate = totalHeads > 0 ? Math.round((vaccinatedHeads / totalHeads) * 100) : 0;
  const speciesCount = useMemo(() => {
    const set = new Set(inventories.map((i) => i.livestockTypeName).filter(Boolean));
    return set.size || Object.keys(livestockTypes).length;
  }, [inventories, livestockTypes]);

  // Filtered inventories when a specific species is clicked
  const typeFilteredInventories = selectedType
    ? allTagInventory.filter(
        (item) => item.livestockTypeName.toLowerCase() === selectedType.toLowerCase()
      )
    : allTagInventory;

  // Herds belonging to the selected species, so the species drilldown can
  // surface group-managed batches alongside the individual registry records.
  const typeFilteredBatches = selectedType
    ? userBatches.filter(
        (batch) => batch.livestockTypeName.toLowerCase() === selectedType.toLowerCase()
      )
    : [];

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/livestock/inventory/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Livestock record deleted successfully");
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error("Failed to delete livestock record");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateInventoryPayload) => {
      if (!editTarget) throw new Error("No record selected");
      const response = await api.put(`/livestock/inventory/${editTarget.id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditTarget(null);
      toast.success("Livestock entry updated successfully");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update livestock entry");
    },
  });

  // CSV Export with UTF-8 BOM and RFC 4180 escaping
  const exportCSV = () => {
    if (inventories.length === 0) {
      toast.error("No livestock records available to export");
      return;
    }

    const headers = [
      "Ear Tag / ID",
      "Livestock Type",
      "Entry Mode",
      "Quantity",
      "Breed",
      "Sex",
      "Weight (kg)",
      "Vaccinated",
      "Last Vaccination Date",
      "Review Status",
      "Review Remarks",
      "Registration Date",
    ];

    const rows = inventories.map((item) => [
      `"${(item.tagNumber || "").replace(/"/g, '""')}"`,
      `"${(item.livestockTypeName || "").replace(/"/g, '""')}"`,
      `"${(item.entryType || "").replace(/"/g, '""')}"`,
      item.quantity,
      `"${(item.breed || "").replace(/"/g, '""')}"`,
      `"${(item.sex || "").replace(/"/g, '""')}"`,
      item.weight ?? "",
      item.lastVaccinationDate ? "Yes" : "No",
      item.lastVaccinationDate ?? "",
      `"${(item.status || "").replace(/"/g, '""')}"`,
      `"${(item.reviewRemarks || "").replace(/"/g, '""')}"`,
      `"${new Date(item.createdAt).toLocaleDateString()}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my_livestock_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Livestock list downloaded successfully");
  };

  return (
    <>
      <PageHeader
        title="My Livestock"
        subtitle="View your animals, check their health, and add new livestock."
        variant="farmer"
        maxWidthClass="w-full"
        action={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={startInventoryTour}
              className="h-11 rounded-xl bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25 hover:text-white sm:rounded-2xl"
              aria-label="Start livestock inventory tutorial"
            >
              Tutorial
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
              title="Refresh Inventory Records"
            >
              <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Livestock overview and inventory actions */}
        {!selectedType && (
          <div data-tour="inventory-hero">
          <InventoryHeroBanner
            totalRecords={inventories.length}
            onExportCsv={exportCSV}
            onOpenRegister={() => setIsAddOpen(true)}
          />
          </div>
        )}

        {/* Registration Modal Dialog */}
        <RegisterLivestockDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          livestockTypes={livestockTypes}
          userBatches={userBatches}
          existingTags={allTagInventory.map((item) => item.tagNumber).filter(Boolean)}
        />

        {/* Cattle and Herd KPIs: animated collapse/expand and fade/slide transition */}
        <div
          data-tour="inventory-kpis"
          className={cn(
            "grid transition-all duration-350 ease-in-out",
            !selectedType && activeTab === "types"
              ? "grid-rows-[1fr] opacity-100 scale-100 mb-2"
              : "grid-rows-[0fr] opacity-0 scale-[0.99] mb-0 pointer-events-none"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black tracking-tight text-slate-900">
                    Cattle and herd KPIs
                  </h3>
                  <p className="mt-0.5 text-xs font-normal text-slate-500">
                    Cattle head count, sex breakdown, active herds, and vaccination records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsKpiOpen(!isKpiOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
                  aria-expanded={isKpiOpen}
                >
                  <span>{isKpiOpen ? "Hide" : "Show"}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-200",
                      isKpiOpen && "rotate-180"
                    )}
                  />
                </button>
              </div>

              <div
                className={cn(
                  "grid transition-all duration-300 ease-in-out",
                  isKpiOpen
                    ? "grid-rows-[1fr] opacity-100 pt-4"
                    : "grid-rows-[0fr] opacity-0 pt-0 pointer-events-none"
                )}
              >
                <div className="overflow-hidden min-h-0">
                  <InventoryTelemetryHeader
                    inventories={inventories}
                    batches={userBatches}
                    isLoading={isLoading || isBatchesLoading}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keep the category tabs visible above both the type cards and drilldown. */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            const nextTab = val as "types" | "all" | "health";
            handleTabChange(nextTab);
          }}
          className="-space-y-2 w-full min-w-0 max-w-full pt-2"
        >
          {!selectedType && (
            <div data-tour="inventory-tabs">
            <InventoryTabsNav
              speciesCount={speciesCount}
              totalRecords={inventories.length}
              vaxRate={vaxRate}
              activeTab={activeTab}
              onTabChange={(nextTab) => {
                handleTabChange(nextTab);
              }}
            />
            </div>
          )}

          <TabsContent value="types" className="w-full min-w-0 max-w-full space-y-4 pt-2 outline-hidden">
            {selectedType ? (
              <SpeciesDrilldownView
                selectedType={selectedType}
                items={typeFilteredInventories}
                batches={typeFilteredBatches}
                isLoading={isAllTagInventoryLoading}
                isError={isAllTagInventoryError}
                onRetry={() => { void refetchAllTagInventory(); }}
                livestockTypes={livestockTypes}
                onBack={() => {
                  setSelectedType(null);
                  if (livestockTypeParam) {
                    const url = new URL(window.location.href);
                    url.searchParams.delete("livestockType");
                    router.replace(`${pathname}${url.search}${url.hash}`, { scroll: false });
                  }
                }}
                onView={(item) => setDetailTarget(item)}
                onEdit={(item) => setEditTarget(item)}
                onDelete={(item) => setDeleteTarget(item)}
                onAddRecord={() => setIsAddOpen(true)}
              />
            ) : (
              <div data-tour="livestock-types">
              <LivestockTypeCards
                inventories={inventories}
                batches={userBatches}
                isLoading={isLoading || isBatchesLoading}
                highlightedType={highlightedType}
                onSelectType={handleSelectType}
              />
              </div>
            )}
          </TabsContent>

          <TabsContent value="all" data-tour="all-livestock-view" className="space-y-4 pt-2 outline-hidden">
            <LivestockRecordList
              items={allTagInventory}
              isLoading={isAllTagInventoryLoading}
              isError={isAllTagInventoryError}
              onRetry={() => { void refetchAllTagInventory(); }}
              defaultOperationalFilter="ACTIVE"
              livestockTypes={livestockTypes}
              onView={(item) => setDetailTarget(item)}
              onEdit={(item) => setEditTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
              onAddRecord={() => setIsAddOpen(true)}
            />
          </TabsContent>

          <TabsContent value="health" data-tour="health-view" className="space-y-4 pt-2 outline-hidden">
            <HealthTrackerTab
              inventories={inventories}
              isLoading={isLoading}
              onView={(item) => setDetailTarget(item)}
              onEdit={(item) => setEditTarget(item)}
            />
          </TabsContent>
        </Tabs>

        {/* Confirm Delete Dialog */}
        <DeleteLivestockDialog
          target={deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          }}
          isDeleting={deleteMutation.isPending}
        />

        {/* View Details Dialog */}
        <LivestockDetailsDialog
          livestock={detailTarget}
          open={!!detailTarget}
          onOpenChange={() => {
            setDetailTarget(null);
            if (activityLivestockId) {
              handledActivityLinkRef.current = activityLivestockId;
              clearActivityLink();
            }
          }}
        />

        {/* Edit Dialog */}
        <LivestockEditDialog
          key={editTarget?.id ?? "closed"}
          item={editTarget}
          open={!!editTarget}
          hideBirthDate={activeTab === "health"}
          onOpenChange={(open) => {
            if (!open) setEditTarget(null);
          }}
          livestockTypes={livestockTypes}
          isSubmitting={updateMutation.isPending}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />
      </div>
    </>
  );
}

export default function LivestockInventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading livestock inventory...</div>}>
      <LivestockInventoryContent />
    </Suspense>
  );
}
