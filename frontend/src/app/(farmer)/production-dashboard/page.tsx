"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Milk, Plus, RefreshCw } from "lucide-react";
import type { ProductionType } from "./production-form-fields";
import ProductionStats from "./production-stats";
import ProductionCharts from "./production-charts";
import ProductionRecent from "./production-recent";
import ProductionTypeSelector from "./production-type-selector";
import {
  EMPTY_TYPE_ANALYTICS,
  fetchProductionRecords,
  deleteProductionRecord,
  type ProductionRecordItem,
  useProductionAnalytics,
} from "./production-analytics";
import ProductionWizard from "./production-wizard";
import ProductionDeleteDialog from "./production-delete-dialog";
import type { ProductionPayload } from "./production-wizard";
import { LivestockInventoryItem } from "../livestock-inventory/page";
import api from "@/lib/axios";

export type UnitType = "liters" | "pieces" | "kilograms";

export type UpdateProductionPayload = {
  id: number;
  payload: ProductionPayload;
};


export type WizardMode = "create" | "edit";

function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card
            key={i}
            className="border-2 border-amber-900/10 bg-amber-50/30 shadow-sm rounded-2xl"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="size-9 rounded-xl" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-[260px] w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductionLoggerPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [productionType, setProductionType] = useState<ProductionType>("milk");
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>({});
  const [resetSignal, setResetSignal] = useState(0);
  const [analyticsType, setAnalyticsType] = useState<ProductionType | null>(null);
  const [editingRecord, setEditingRecord] = useState<ProductionRecordItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionRecordItem | null>(null);



  const queryClient = useQueryClient();

  const {
    data: analytics,
    isLoading,
    isError,
    refetch,
  } = useProductionAnalytics();

  const { data: inventories = [], isLoading: isInventoryLoading } = useQuery<
    LivestockInventoryItem[]
  >({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await api.get("livestock/inventory/");
      const result: LivestockInventoryItem[] = [];
      for (const item of res.data) {
        result.push({
          id: item.id,
          farmerName: item.farmer_name,
          livestockTypeName: item.livestock_type_name,
          entryType: item.entry_type,
          quantity: item.quantity,
          tagNumber: item.tag_number,
          breed: item.breed,
          sex: item.sex,
          weight: item.weight,
          lastVaccinationDate: item.last_vaccination_date,
          status: item.status,
          reviewRemarks: item.review_remarks,
          createdAt: item.created_at,
        });
      }
      return result;
    },
  });

  const { data: productionRecords = [] } = useQuery<ProductionRecordItem[]>({
    queryKey: ["production"],
    queryFn: fetchProductionRecords,
    staleTime: 30_000,
  });

  const approvedInventories = inventories.filter((item) => item.status === "APPROVED");

  const handleFieldChange = (field: string, val: string | number) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const handleTypeSelect = (type: ProductionType) => {
    setProductionType(type);
    setClickedInventory(null);
  };

  // Opens the wizard pre-filled with an existing record's data. Approved
  // records never reach this path (the dialog hides the Edit button).
  // TODO(backend): `/production/create/` only creates new records. True
  // editing needs a PATCH /production/{id}/ endpoint.
  const handleEditRecord = (record: ProductionRecordItem) => {
    setEditingRecord(record);
    const inventory =
      approvedInventories.find((item) => Number(item.id) === record.livestockId) ?? null;
    setProductionType(record.productionType);
    setClickedInventory(inventory);
    setFormState({ // formState handles the inputted values
      prodDate: record.recordDate,
      notes: record.notes ?? "",
      ...(record.productionType === "milk" ? { milkQty: record.quantity } : {}),
      ...(record.productionType === "eggs" ? { eggQty: record.quantity } : {}),
      ...(record.productionType === "wool" ? { woolQty: record.quantity } : {}),
    });
    setResetSignal((n) => n + 1); // reset the wizard to step 0
    setIsWizardOpen(true);
  };

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post("/production/create/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Production record submitted for approval");
      setClickedInventory(null);
      setFormState({});
      setProductionType("milk");
      setResetSignal((n) => n + 1); // so that the parent will know that the child should reset its form state.
      setIsWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to submit production record");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: UpdateProductionPayload) => {
      const response = await api.patch(`/production/update_record/${id}/`, payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Production record updated before approval");
      setIsWizardOpen(false);
      setClickedInventory(null);
      setFormState({});
      setProductionType("milk");
      setResetSignal((n) => n + 1); // so that the parent will know that the child should reset its form state.
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
    },
    onError: (err: Error) => {
      console.log(err);
      toast.error("Failed to update production record");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await deleteProductionRecord(id);
    },
    onSuccess: () => {
      toast.success("Production record deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["production_analytics"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.detail ??
        "Failed to delete production record";
      toast.error(msg);
    },
  });

  const handleDeleteRecord = (record: ProductionRecordItem) => {
    if (record.status === "APPROVED") {
      toast.error("Approved records cannot be deleted.");
      return;
    }
    setDeleteTarget(record);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
      },
    });
  };

  const availableTypes = analytics?.available_types ?? [];
  const activeType =
    analyticsType && availableTypes.includes(analyticsType)
      ? analyticsType
      : availableTypes.includes("milk")
        ? "milk"
        : (availableTypes[0] ?? "milk");
  const activeTypeData =
    analytics?.by_type?.[activeType] ?? EMPTY_TYPE_ANALYTICS;

  /*
   * action={
          <Button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="bg-white text-[#2D5A27] hover:bg-white/90 shadow-sm px-4"
          >
            <Plus className="size-4" /> Log Production
          </Button>
        }

   * */

  return (
    <>
      <PageHeader
        title="Production Analytics"
        subtitle="Monitor your livestock production, trends, and estimated value."
        variant="farmer"
        maxWidthClass="max-w-6xl"
      />

      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        {isLoading ? (
          <AnalyticsLoading />
        ) : isError ? (
          <Card className="p-10 text-center border-red-200 bg-red-50">
            <h3 className="font-semibold text-red-700">
              Unable to load production analytics.
            </h3>
            <p className="text-sm text-red-600 mt-2">
              Please try again.
            </p>
            <Button
              className="mt-4"
              onClick={() => refetch()}
            >
              <RefreshCw className="size-4" /> Retry
            </Button>
          </Card>
        ) : availableTypes.length === 0 ? (

          <Card className="p-10 text-center border-dashed border-slate-200">
            <div className="mx-auto flex items-center justify-center size-14 rounded-full bg-sky-100/80 mb-4">
              <Milk className="w-7 h-7 text-sky-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              No production data yet
            </h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              You haven&apos;t recorded any approved production records.
              Start by recording your first production entry.
            </p>
            <Button
              className="mt-5 bg-[#2D5A27] hover:bg-[#244a20] text-white"
              onClick={() => setIsWizardOpen(true)}
            >
              <Plus className="size-4" /> Record Production
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between transition-all duration-500">
              {availableTypes.length > 1 ? (
                <div className="w-full md:w-auto">
                  <ProductionTypeSelector
                    types={availableTypes}
                    selected={activeType}
                    onSelect={setAnalyticsType}
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button
                  type="button"
                  onClick={() => setIsWizardOpen(true)}
                  className=" bg-emerald-700 text-white hover:bg-[#2D5A27]/90 shadow-sm w-full sm:w-auto p-8"
                >
                  <Plus className="size-4" /> Log Production
                </Button>
              </div>
            </div>
            <ProductionStats type={activeType} summary={activeTypeData.summary} />
            <ProductionCharts type={activeType} data={activeTypeData} />
            <ProductionRecent
              records={productionRecords}
              showViewMore={availableTypes.some((t) => t !== "milk")}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
            />
          </>
        )}
      </div>

      {/* Production Entry Wizard (modal) */}
      <ProductionWizard
        productionType={productionType}
        onTypeChange={handleTypeSelect}
        clickedInventory={clickedInventory}
        onSelectInventory={setClickedInventory}
        formState={formState}
        onFieldChange={handleFieldChange}
        approvedInventories={approvedInventories}
        isLoading={isInventoryLoading}
        isSubmitting={submitMutation.isPending}
        resetSignal={resetSignal} // do this so the child sends a signal to reset the form when the parent state changes
        onSubmit={(payload) => {
          if (editingRecord) {
            updateMutation.mutate({
              id: editingRecord.id,
              payload
            });
          } else {
            submitMutation.mutate(payload);
          }
        }}
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        mode={editingRecord ? "edit" : "create"}
        editingRecord={editingRecord}
      />

      <ProductionDeleteDialog
        record={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </>
  );
}
