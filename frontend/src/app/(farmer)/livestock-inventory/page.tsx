"use client";

import { cn } from "@/lib/utils";
import { useMutation,useQueryClient } from "@tanstack/react-query";
import { ChevronDown,RefreshCw } from "lucide-react";
import { useEffect,useMemo,useState } from "react";
import { toast } from "sonner";

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

export default function LivestockInventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"types" | "all" | "health">("types");
  const [isKpiOpen, setIsKpiOpen] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [handledActivityLink, setHandledActivityLink] = useState(false);

  // Herd links preserve the livestock type so Back returns to the same
  // Manage Cattle (or other type) drilldown instead of the overview cards.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const livestockType = new URLSearchParams(window.location.search).get("livestockType");
    if (livestockType) setSelectedType(livestockType);
  }, []);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading, isError, refetch, isFetching } = useUserInventory();
  const { data: allTagInventory = [] } = useUserInventory({ includeInactive: true });
  const { data: userBatches = [], isLoading: isBatchesLoading } = useLivestockBatches({ includeRoster: false });

  // Recent-activity links contain only a livestock ID. Resolve it from the
  // farmer's own inventory query so the existing detail dialog gets the same
  // complete record object used by the normal inventory buttons.
  useEffect(() => {
    if (typeof window === "undefined" || isLoading || isError || handledActivityLink) return;

    const livestockId = new URLSearchParams(window.location.search).get("livestockId");
    if (!livestockId) {
      setHandledActivityLink(true);
      return;
    }

    const livestock = inventories.find((item) => String(item.id) === livestockId);
    if (livestock) {
      setDetailTarget(livestock);
    } else {
      toast.error("That livestock record could not be found in your inventory.");
    }
    setHandledActivityLink(true);
  }, [inventories, isLoading, isError, handledActivityLink]);

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
    ? inventories.filter((item) => item.livestockTypeName === selectedType)
    : inventories;

  // Herds belonging to the selected species, so the species drilldown can
  // surface group-managed batches alongside the individual registry records.
  const typeFilteredBatches = selectedType
    ? userBatches.filter((batch) => batch.livestockTypeName === selectedType)
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="w-11 h-11 rounded-xl sm:rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white active:scale-95 cursor-pointer backdrop-blur-xs transition-all shadow-xs shrink-0"
            title="Refresh Inventory Records"
          >
            <RefreshCw className={`size-5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />

      <div className="w-full min-w-0 max-w-full space-y-2 p-4 md:p-8">
        {/* Livestock overview and inventory actions */}
        {!selectedType && (
          <InventoryHeroBanner
            totalRecords={inventories.length}
            onExportCsv={exportCSV}
            onOpenRegister={() => setIsAddOpen(true)}
          />
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
            setActiveTab(nextTab);
            if (nextTab !== "types") setSelectedType(null);
          }}
          className="-space-y-2 w-full min-w-0 max-w-full pt-2"
        >
          {!selectedType && (
            <InventoryTabsNav
              speciesCount={speciesCount}
              totalRecords={inventories.length}
              vaxRate={vaxRate}
              activeTab={activeTab}
              onTabChange={(nextTab) => {
                setActiveTab(nextTab);
                if (nextTab !== "types") setSelectedType(null);
              }}
            />
          )}

          <TabsContent value="types" className="w-full min-w-0 max-w-full space-y-4 pt-2 outline-hidden">
            {selectedType ? (
              <SpeciesDrilldownView
                selectedType={selectedType}
                items={typeFilteredInventories}
                batches={typeFilteredBatches}
                isLoading={isLoading}
                livestockTypes={livestockTypes}
                onBack={() => setSelectedType(null)}
                onView={(item) => setDetailTarget(item)}
                onEdit={(item) => setEditTarget(item)}
                onDelete={(item) => setDeleteTarget(item)}
                onAddRecord={() => setIsAddOpen(true)}
              />
            ) : (
              <LivestockTypeCards
                inventories={inventories}
                batches={userBatches}
                isLoading={isLoading || isBatchesLoading}
                onSelectType={setSelectedType}
              />
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4 pt-2 outline-hidden">
            <LivestockRecordList
              items={inventories}
              isLoading={isLoading}
              livestockTypes={livestockTypes}
              onView={(item) => setDetailTarget(item)}
              onEdit={(item) => setEditTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
              onAddRecord={() => setIsAddOpen(true)}
            />
          </TabsContent>

          <TabsContent value="health" className="space-y-4 pt-2 outline-hidden">
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
          onOpenChange={() => setDetailTarget(null)}
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
