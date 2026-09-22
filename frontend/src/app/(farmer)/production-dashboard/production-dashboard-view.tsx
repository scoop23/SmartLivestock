"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Baby,
  Calculator,
  ChevronRight,
  ClipboardCheck,
  Dna,
  Layers,
  LineChart as LineChartIcon,
  Milk,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";

import SpeciesHeroBanner from "./components/species-hero-banner";
import SpeciesKpiCards from "./components/species-kpi-cards";
import ProductionCharts from "./production-charts";
import ProductionRecent from "./production-recent";
import ProductionTypeSelector from "./production-type-selector";
import ProductionCalvingTab, {
  getBirthingTerminology,
  CalvingRecordItem,
} from "./production-calving-tab";
import ProductionWeightTab from "./production-weight-tab";
import ProductionSalesTab from "./production-sales-tab";
import ProductionForecastsTab from "./production-forecasts-tab";
import { ENTERPRISE_CONFIGS } from "./production-enterprise-hub";
import ProductionWizard from "./production-wizard";
import ProductionDeleteDialog from "./production-delete-dialog";

import {
  EMPTY_TYPE_ANALYTICS,
  computeProductionAnalytics,
  fetchProductionRecords,
  deleteProductionRecord,
  type ProductionRecordItem,
  type ProductionType,
} from "./production-analytics";
import type { ProductionPayload } from "./production-wizard";
import { useUserInventory, type LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";

export type UnitType = "liters" | "pieces" | "kilograms";

export type UpdateProductionPayload = {
  id: number;
  payload: ProductionPayload;
};

export type WizardMode = "create" | "edit";

interface ProductionDashboardViewProps {
  selectedSpecies: string | null;
  onSpeciesChange?: (species: string | null) => void;
  onBackToHub?: () => void;
  showEnterpriseSwitch?: boolean;
}

export default function ProductionDashboardView({
  selectedSpecies,
  onSpeciesChange,
  onBackToHub,
  showEnterpriseSwitch = true,
}: ProductionDashboardViewProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Partial<ProductionRecordItem> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionRecordItem | null>(null);
  const [productionType, setProductionType] = useState<ProductionType>("milk");
  const [clickedInventory, setClickedInventory] = useState<LivestockInventoryItem | null>(null);
  const [formState, setFormState] = useState<Record<string, string | number>>({});
  const [resetSignal, setResetSignal] = useState(0);

  // Main Tabs State: "production" | "calving" | "weights" | "sales" | "forecasts"
  const [activeMainTab, setActiveMainTab] = useState<
    "production" | "calving" | "weights" | "sales" | "forecasts"
  >("production");

  // Fetch Inventory with standard hook & mapper
  const { data: inventories = [], isLoading: isInventoryLoading } = useUserInventory();

  // Fetch Production Records
  const {
    data: productionRecords = [],
    isLoading: isRecordsLoading,
    refetch,
    isRefetching,
  } = useQuery<ProductionRecordItem[]>({
    queryKey: ["production_records"],
    queryFn: fetchProductionRecords,
  });

  // Fetch Calving Records
  const { data: calvingRecords = [] } = useQuery<CalvingRecordItem[]>({
    queryKey: ["calving_records"],
    queryFn: async () => {
      const res = await api.get("production/calving/");
      return res.data;
    },
  });

  // Fetch Weight Records
  const { data: weightRecords = [] } = useQuery<
    Array<{ weight: number; weighing_date: string; livestock: number }>
  >({
    queryKey: ["weight_records"],
    queryFn: async () => {
      const res = await api.get("production/weights/");
      return res.data;
    },
  });

  const approvedInventories = useMemo(() => {
    return inventories.filter((item) => item.status === "APPROVED");
  }, [inventories]);

  const filteredInventories = useMemo(() => {
    if (!selectedSpecies || selectedSpecies === "ALL")
      return inventories.filter((item) => item.status !== "SUBJECT_TO_REVISION" && item.status !== "REJECTED");
    return inventories
      .filter((item) => item.status !== "SUBJECT_TO_REVISION" && item.status !== "REJECTED")
      .filter((item) => item.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase());
  }, [inventories, selectedSpecies]);

  const filteredProductionRecords = useMemo(() => {
    if (!selectedSpecies || selectedSpecies === "ALL") return productionRecords;
    return productionRecords.filter(
      (item) => item.livestockTypeName?.toLowerCase() === selectedSpecies.toLowerCase()
    );
  }, [productionRecords, selectedSpecies]);

  const terms = getBirthingTerminology(selectedSpecies);

  // Sync initial productionType default when selectedSpecies changes
  useEffect(() => {
    if (selectedSpecies && selectedSpecies !== "ALL") {
      const s = selectedSpecies.toLowerCase();
      if (s.includes("swine") || s.includes("pig")) setProductionType("meat");
      else if (s.includes("poultry") || s.includes("chicken")) setProductionType("eggs");
      else if (s.includes("sheep")) setProductionType("wool");
      else setProductionType("milk");
    }
  }, [selectedSpecies]);

  // Dynamically adapt button label when user changes between Milk, Meat, Eggs, Wool
  const quickLogLabel = useMemo(() => {
    const s = (selectedSpecies || "").toLowerCase();
    switch (productionType) {
      case "meat":
        if (s.includes("swine") || s.includes("pig")) return "Log Pork & Carcass";
        if (s.includes("cattle")) return "Log Beef & Carcass";
        if (s.includes("carabao")) return "Log Carabeef & Carcass";
        if (s.includes("goat")) return "Log Chevon & Meat";
        if (s.includes("sheep")) return "Log Mutton & Meat";
        if (s.includes("poultry") || s.includes("chicken")) return "Log Poultry Meat";
        return "Log Meat & Carcass";
      case "eggs":
        return "Log Egg Collection";
      case "wool":
        return "Log Wool Shearing";
      case "milk":
      default:
        if (s.includes("goat")) return "Log Goat Milk Yield";
        if (s.includes("carabao")) return "Log Carabao Milk Yield";
        if (s.includes("cattle")) return "Log Cow Milk Yield";
        return "Log Daily Milk Yield";
    }
  }, [productionType, selectedSpecies]);

  const handleFieldChange = (field: string, val: string | number) => {
    setFormState((prev) => ({ ...prev, [field]: val }));
  };

  const handleTypeSelect = (type: ProductionType) => {
    setProductionType(type);
  };

  const handleOpenNewWizard = () => {
    setEditingRecord(null);
    setClickedInventory(null);
    // Keep currently active productionType selected by user!
    setFormState({
      prodDate: new Date().toISOString().split("T")[0],
      milkTime: "Morning",
      collectionTime: "Morning",
      meatPurpose: "Auction / Market Sale",
      notes: "",
    });
    setResetSignal((prev) => prev + 1);
    setIsWizardOpen(true);
  };

  const handleOpenEditWizard = (record: ProductionRecordItem) => {
    setEditingRecord(record);
    setProductionType(record.productionType);
    const targetLivestockId = String(record.livestockId || (record as any).livestock || "");
    const matchedInv =
      inventories.find((i) => String(i.id) === targetLivestockId) ||
      (targetLivestockId
        ? ({
            id: targetLivestockId,
            livestockTypeName: record.livestockTypeName || "Livestock",
            entryType: "INDIVIDUAL",
            status: "APPROVED",
            tagNumber: `ID #${targetLivestockId}`,
            breed: "",
            sex: "",
            farmerName: record.farmerName || "",
            quantity: 1,
            weight: null,
            lastVaccinationDate: null,
            createdAt: record.createdAt,
          } as LivestockInventoryItem)
        : null);

    setClickedInventory(matchedInv);

    let rawNotes = record.notes || "";
    let extractedMilkTime = "Morning";
    let extractedMeatPurpose = "Auction / Market Sale";

    if (record.productionType === "milk") {
      const timeMatch = rawNotes.match(/\[(Morning|Afternoon|Evening)\]/i);
      if (timeMatch) {
        extractedMilkTime =
          timeMatch[1].charAt(0).toUpperCase() + timeMatch[1].slice(1).toLowerCase();
        rawNotes = rawNotes.replace(timeMatch[0], "").trim();
      }
    } else if (record.productionType === "meat") {
      const purposeMatch = rawNotes.match(/\[Purpose:\s*([^\]]+)\]/i);
      if (purposeMatch) {
        extractedMeatPurpose = purposeMatch[1].trim();
        rawNotes = rawNotes.replace(purposeMatch[0], "").trim();
      }
    }

    const newFormState: Record<string, string | number> = {
      prodDate: record.recordDate,
      notes: rawNotes,
      milkTime: extractedMilkTime,
      meatPurpose: extractedMeatPurpose,
      collectionTime: "Morning",
    };

    if (record.productionType === "milk") {
      newFormState.milkQty = Number(record.quantity);
    } else if (record.productionType === "meat") {
      newFormState.meatQty = Number(record.quantity);
    } else if (record.productionType === "eggs") {
      newFormState.eggQty = Number(record.quantity);
    } else if (record.productionType === "wool") {
      newFormState.woolQty = Number(record.quantity);
    }

    setFormState(newFormState);
    setResetSignal((prev) => prev + 1);
    setIsWizardOpen(true);
  };

  // Mutations
  const submitMutation = useMutation({
    mutationFn: async (payload: ProductionPayload) => {
      const res = await api.post("production/records/", payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Production record logged successfully!");
      setIsWizardOpen(false);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
    },
    onError: () => {
      toast.error("Failed to log production record.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: UpdateProductionPayload) => {
      const res = await api.put(`production/records/${id}/`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Production record updated successfully!");
      setIsWizardOpen(false);
      setEditingRecord(null);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
    },
    onError: () => {
      toast.error("Failed to update production record.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProductionRecord,
    onSuccess: () => {
      toast.success("Production record deleted.");
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["production_records"] });
    },
    onError: () => {
      toast.error("Failed to delete record.");
    },
  });

  const handleConfirmDelete = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
  };

  const analytics = useMemo(
    () => computeProductionAnalytics(filteredProductionRecords),
    [filteredProductionRecords]
  );
  const currentSummary = analytics.by_type[productionType] ?? EMPTY_TYPE_ANALYTICS;
  const pendingCount = filteredProductionRecords.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      {/* Top Enterprise Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          {showEnterpriseSwitch && onBackToHub && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToHub}
              className="gap-1.5 rounded-xl border-slate-200 text-slate-700 hover:text-emerald-950 hover:bg-emerald-50 font-bold"
            >
              <ArrowLeft className="size-4" /> All Enterprises
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs font-bold px-2.5 py-0.5">
              {selectedSpecies === "ALL" || !selectedSpecies
                ? "Combined Herd"
                : `${selectedSpecies} Enterprise`}
            </Badge>
            <span className="text-xs font-semibold text-slate-500 hidden md:inline">
              {filteredInventories.length} Inventory Records (
              {filteredInventories.reduce(
                (a: number, b: LivestockInventoryItem) => a + (b.quantity || 1),
                0
              )}{" "}
              Heads)
            </span>
          </div>
        </div>

        {/* Quick Enterprise Switcher Pills */}
        {showEnterpriseSwitch && onSpeciesChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {Object.keys(ENTERPRISE_CONFIGS).map((sName) => (
              <button
                key={sName}
                type="button"
                onClick={() => onSpeciesChange(sName)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
                  selectedSpecies === sName
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {sName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onSpeciesChange("ALL")}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
                selectedSpecies === "ALL"
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      {/* Executive Species Telemetry Hero Banner */}
      <SpeciesHeroBanner
        species={selectedSpecies}
        terms={terms}
        filteredInventories={filteredInventories}
        filteredProductionRecords={filteredProductionRecords}
        calvingRecords={calvingRecords}
      />

      {/* Main Unified Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          type="button"
          onClick={() => setActiveMainTab("production")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
            activeMainTab === "production"
              ? "bg-emerald-800 text-white shadow-emerald-950/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
          }`}
        >
          <Milk className="size-4" />
          <span>Daily Yield Logs</span>
          {filteredProductionRecords.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeMainTab === "production"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {filteredProductionRecords.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("calving")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
            activeMainTab === "calving"
              ? "bg-emerald-800 text-white shadow-emerald-950/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
          }`}
        >
          <Baby className="size-4" />
          <span>{terms.eventName} & Offspring</span>
          {calvingRecords.length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeMainTab === "calving"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {calvingRecords.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("weights")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
            activeMainTab === "weights"
              ? "bg-emerald-800 text-white shadow-emerald-950/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
          }`}
        >
          <Scale className="size-4" />
          <span>Growth & ADG Tracker</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("sales")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
            activeMainTab === "sales"
              ? "bg-emerald-800 text-white shadow-emerald-950/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
          }`}
        >
          <ShoppingBag className="size-4" />
          <span>Live Sales & Outlets</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("forecasts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs ${
            activeMainTab === "forecasts"
              ? "bg-emerald-800 text-white shadow-emerald-950/20"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
          }`}
        >
          <LineChartIcon className="size-4" />
          <span>Herd Forecasting</span>
        </button>
      </div>

      {/* Tab 1: Daily Yield Logs */}
      {activeMainTab === "production" && (
        <div className="space-y-6">
          {/* Dynamic Species Telemetry KPI Cards (4 Cards) */}
          <SpeciesKpiCards
            species={selectedSpecies}
            inventories={filteredInventories}
            productionRecords={filteredProductionRecords}
            calvingRecords={calvingRecords}
            weightRecords={weightRecords}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <ProductionTypeSelector
              types={analytics.available_types}
              selected={productionType}
              onSelect={handleTypeSelect}
            />
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="gap-2 rounded-xl text-xs font-semibold text-slate-600 border-slate-200 cursor-pointer"
              >
                <RefreshCw className={`size-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                Refresh Feed
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenNewWizard}
                className="gap-1.5 rounded-xl text-xs font-black bg-[#2D5A27] hover:bg-[#23471f] text-white shadow-xs cursor-pointer h-9 px-3.5"
              >
                <Plus className="size-4" />
                <span>{quickLogLabel}</span>
              </Button>
            </div>
          </div>

          {isRecordsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <ProductionCharts
                  type={productionType}
                  data={analytics.by_type[productionType] ?? EMPTY_TYPE_ANALYTICS}
                />
              </div>

              <div className="space-y-6">
                <ProductionRecent
                  records={filteredProductionRecords}
                  onEdit={handleOpenEditWizard}
                  onDelete={(record) => setDeleteTarget(record)}
                />

                <Card className="border-slate-200 shadow-xs rounded-3xl overflow-hidden bg-slate-50/60">
                  <CardContent className="p-5 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <ShieldCheck className="size-4 text-emerald-700" />
                      <span>Official LGU Validation Protocol</span>
                    </div>
                    <p className="text-slate-500 leading-relaxed">
                      Submitted daily yields and {terms.eventName.toLowerCase()} records are
                      verified by the assigned <strong>SIBAT Agricultural Technologist</strong>{" "}
                      before aggregation into Municipal Agriculture Office (MAO) census reports.
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 font-semibold border-t border-slate-200/60">
                      <span>Pending Verification:</span>
                      <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                        {pendingCount} records
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Birthing & Offspring Registry */}
      {activeMainTab === "calving" && (
        <ProductionCalvingTab
          approvedInventories={approvedInventories}
          selectedSpecies={selectedSpecies}
        />
      )}

      {/* Tab 3: Weight & Growth Tracker */}
      {activeMainTab === "weights" && (
        <ProductionWeightTab approvedInventories={filteredInventories} />
      )}

      {/* Tab 4: Live Animal Sales & Commercial Outlets */}
      {activeMainTab === "sales" && (
        <ProductionSalesTab approvedInventories={approvedInventories} />
      )}

      {/* Tab 5: Forecasts & Analytics */}
      {activeMainTab === "forecasts" && (
        <ProductionForecastsTab
          inventories={filteredInventories}
          records={filteredProductionRecords}
        />
      )}

      {/* Preserved Production Entry Wizard (modal) */}
      <ProductionWizard
        productionType={productionType}
        onTypeChange={handleTypeSelect}
        clickedInventory={clickedInventory}
        onSelectInventory={setClickedInventory}
        formState={formState}
        onFieldChange={handleFieldChange}
        approvedInventories={approvedInventories}
        isLoading={isInventoryLoading}
        isSubmitting={submitMutation.isPending || updateMutation.isPending}
        resetSignal={resetSignal}
        onSubmit={(payload) => {
          if (editingRecord && editingRecord.id) {
            updateMutation.mutate({
              id: editingRecord.id as number,
              payload,
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
    </div>
  );
}
