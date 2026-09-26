"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";

import api from "@/lib/axios";
import {
  type EntryType,
  type StatusType,
  type LivestockInventoryItem,
  type LivestockType,
  type InventoryApiItem,
  type UpdateInventoryPayload,
  useLivestockTypes,
  useUserInventory,
  useLivestockBatches,
} from "./livestock-inventory";

import LivestockDetailsDialog from "./livestock-details-dialog";
import LivestockEditDialog from "./livestock-edit-dialog";
import LivestockRecordList from "./livestock-record-list";
import LivestockTypeCards from "./livestock-type-cards";
import HealthTrackerTab from "./health-tracker-tab";

import {
  RegisterLivestockDialog,
  InventoryHeroBanner,
  InventoryTelemetryHeader,
  DeleteLivestockDialog,
  SpeciesDrilldownView,
  InventoryTabsNav,
} from "./components";

// Re-export types for any existing consumers
export type { EntryType, StatusType, LivestockInventoryItem, LivestockType, InventoryApiItem };

export default function LivestockInventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"types" | "all" | "health">("types");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading, refetch, isFetching } = useUserInventory();
  const { data: userBatches = [] } = useLivestockBatches();

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
      "Registry Status",
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
    link.download = `livestock_registry_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Livestock registry exported successfully as CSV");
  };

  return (
    <>
      <PageHeader
        title="Livestock Inventory"
        subtitle="Manage your livestock entries, track biometrics, and monitor herd health"
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

      <div className="p-4 md:p-8 w-full space-y-2">
        {/* Executive Farm Telemetry Hero Banner (Collapsible) */}
        <InventoryHeroBanner
          totalRecords={inventories.length}
          onExportCsv={exportCSV}
          onOpenRegister={() => setIsAddOpen(true)}
        />

        {/* Registration Modal Dialog */}
        <RegisterLivestockDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          livestockTypes={livestockTypes}
          userBatches={userBatches}
        />

        {/* Herd Telemetry & Biometrics KPI Bar (Collapsible) */}
        <InventoryTelemetryHeader
          inventories={inventories}
          isLoading={isLoading}
        />

        {/* Main Content: Species Drill-Down or Tabbed Roster */}
        {selectedType ? (
          <SpeciesDrilldownView
            selectedType={selectedType}
            items={typeFilteredInventories}
            isLoading={isLoading}
            livestockTypes={livestockTypes}
            onBack={() => setSelectedType(null)}
            onView={(item) => setDetailTarget(item)}
            onEdit={(item) => setEditTarget(item)}
            onDelete={(item) => setDeleteTarget(item)}
            onAddRecord={() => setIsAddOpen(true)}
          />
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "types" | "all" | "health")}
            className="-space-y-2 pt-2"
          >
            {/* Segmented Tab Navigation Strip */}
            <InventoryTabsNav
              speciesCount={speciesCount}
              totalRecords={inventories.length}
              vaxRate={vaxRate}
            />

            <TabsContent value="types" className="space-y-4 pt-2 outline-hidden w-full">
              <LivestockTypeCards
                inventories={inventories}
                isLoading={isLoading}
                onSelectType={setSelectedType}
              />
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
        )}

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
